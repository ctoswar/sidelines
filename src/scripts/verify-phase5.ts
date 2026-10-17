/**
 * Phase 5 verification: exercises the team profile API, the multipart banner
 * upload, and the live-tournament schedule config against a running server
 * (`npm run dev` or `npm run start` on port 3000).
 *
 * Covers: per-user team reads and saves (gates, validation, round-trip), a
 * freshly signed-up player receiving the neutral defaults and creating the
 * first row through both write paths (banner-first insert, form save), the
 * banner lifecycle (magic bytes, size cap, its own on-disk tree, replace,
 * delete) and the schedule start-time endpoints (gates, validation,
 * persistence), plus workspace page smokes.
 *
 * End state: the demo player's team fields and the schedule start time are
 * restored, and both banners are deleted. (An image uploaded outside the
 * harness is not restorable — this run deletes banners on purpose; `npm run
 * db:seed` resets the team fields either way. The fresh signup user stays,
 * as in Phase 2.)
 *
 * Usage:  npm run start         (in one shell)
 *         npx tsx src/scripts/verify-phase5.ts
 */

import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { MY_TEAM } from "../lib/mock-data";
import { DEFAULT_TEAM } from "../lib/team";
import { DEFAULT_PRESET, BANNER_PRESETS } from "../lib/team-banner";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "sidelines-demo";

// Better Auth rejects state-changing requests without an Origin header
// (CSRF). A real browser sends it on every POST; Node's fetch does not.
const ORIGIN_HEADERS = { Origin: BASE, Referer: `${BASE}/` };

type CookieJar = Map<string, string>;

function jarHeader(jar: CookieJar): string {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(jar: CookieJar, response: Response) {
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function withCsrfBackoff(url: string, init: RequestInit, jar: CookieJar) {
  // Better Auth's production default rate-limits auth endpoints to 3 attempts
  // per 10 seconds per IP. The harness runs several in a burst (and often
  // right after another harness), so back off and retry on 429 rather than
  // fighting the limiter or disabling it in the app.
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt >= 4) {
      storeCookies(jar, response);
      return response;
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await new Promise((resolve) => setTimeout(resolve, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10) * 1000));
  }
}

async function signIn(email: string, password: string, jar: CookieJar) {
  return withCsrfBackoff(
    `${BASE}/api/auth/sign-in/email`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN_HEADERS },
      body: JSON.stringify({ email, password }),
    },
    jar,
  );
}

async function signUp(payload: Record<string, unknown>, jar: CookieJar) {
  return withCsrfBackoff(
    `${BASE}/api/auth/signup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN_HEADERS },
      body: JSON.stringify(payload),
    },
    jar,
  );
}

async function api(jar: CookieJar | null, method: string, route: string, body?: unknown) {
  return fetch(`${BASE}${route}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...ORIGIN_HEADERS,
      ...(jar ? { Cookie: jarHeader(jar) } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function uploadBanner(jar: CookieJar | null, file: Blob, name: string) {
  const form = new FormData();
  form.append("banner", file, name);
  return fetch(`${BASE}/api/team/banner`, {
    method: "POST",
    headers: { ...ORIGIN_HEADERS, ...(jar ? { Cookie: jarHeader(jar) } : {}) },
    body: form,
  });
}

/** Minimal valid 1x1 PNG. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** JPEG-shaped bytes: the sniff checks FF D8 FF, and nothing re-encodes uploads. */
const JPEG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from("JFIF\0"),
  Buffer.alloc(24),
]);

type WireTeam = {
  name: string;
  tagline: string;
  bannerPath: string;
  preset: string;
  accent: string;
  division: string;
  seed: number;
};

async function getTeam(jar: CookieJar): Promise<WireTeam | null> {
  const response = await api(jar, "GET", "/api/team");
  const body = (await response.json().catch(() => null)) as { team?: WireTeam } | null;
  return body?.team ?? null;
}

const VALID_TEAM = {
  name: "Phase5 United",
  tagline: "Cleared for Phase 5",
  preset: "sunset",
  accent: "#ef653d",
  division: "womens",
  seed: 12,
};

const teamPut = (jar: CookieJar, overrides: Record<string, unknown>) =>
  api(jar, "PUT", "/api/team", { ...VALID_TEAM, ...overrides });

async function main() {
  const checks: [string, boolean, unknown][] = [];
  const record = (label: string, ok: boolean, actual: unknown) => checks.push([label, ok, actual]);

  // Banner assertions read the disk like Phase 3 did — but only the banner
  // trees (`team-*`), so the photo dirs keep the other harness's lifecycle.
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "./var/uploads");
  await mkdir(uploadRoot, { recursive: true });
  for (const entry of await readdir(uploadRoot).catch(() => [] as string[])) {
    if (entry.startsWith("team-")) await rm(path.join(uploadRoot, entry), { recursive: true, force: true });
  }

  const dirOf = (bannerPath: string) => path.join(uploadRoot, bannerPath.split("/")[0] ?? "");
  const filesIn = (dir: string) => readdir(dir).catch(() => [] as string[]);

  // --- sign in: one player, one organizer ---
  const player: CookieJar = new Map();
  const org: CookieJar = new Map();
  const playerLogin = await signIn("player@example.com", DEMO_PASSWORD, player);
  const orgLogin = await signIn("organizer@example.com", DEMO_PASSWORD, org);
  record("demo player sign-in ok", playerLogin.ok, playerLogin.status);
  record("demo organizer sign-in ok", orgLogin.ok, orgLogin.status);

  // ============ fresh player: defaults + both row-creation paths ============

  const stamp = Date.now().toString(36);
  const fresh: CookieJar = new Map();
  const signup = await signUp(
    {
      role: "player",
      username: `phase5.${stamp}`,
      name: "Phase Five",
      email: `phase5.${stamp}@example.com`,
      password: DEMO_PASSWORD,
      confirm: DEMO_PASSWORD,
      terms: true,
      nickname: "",
      dateOfBirth: "1995-04-02",
      gender: "Prefer not to say",
      nationality: "Filipino",
      city: "Cebu",
      position: "Doubles",
      level: "Recreational",
      dominantHand: "Right",
      playingSince: "2023",
      match: "Open",
      number: "12",
      bio: "",
      profileColor: "#c8ef70",
      code: "",
    },
    fresh,
  );
  record("fresh player signs up", signup.ok, signup.status);

  const freshDefaults = await getTeam(fresh);
  record(
    "never-saved player gets the neutral defaults",
    freshDefaults?.name === DEFAULT_TEAM.name &&
      freshDefaults?.seed === 1 &&
      freshDefaults?.bannerPath === "" &&
      freshDefaults?.preset === DEFAULT_PRESET,
    freshDefaults,
  );

  const freshUpload = await uploadBanner(fresh, new Blob([PNG_1PX], { type: "image/png" }), "fresh.png");
  const freshUploadBody = (await freshUpload.json().catch(() => null)) as { team?: WireTeam } | null;
  record(
    "banner-first save creates the row with default fields",
    freshUpload.ok &&
      freshUploadBody?.team?.name === DEFAULT_TEAM.name &&
      Boolean(freshUploadBody?.team?.bannerPath?.endsWith(".png")),
    freshUploadBody?.team,
  );

  const freshSaved = await api(fresh, "PUT", "/api/team", {
    name: "Fresh Lane FC",
    tagline: "",
    preset: DEFAULT_PRESET,
    accent: "#c8ef70",
    division: "mens",
    seed: 7,
  });
  const freshSavedBody = (await freshSaved.json().catch(() => null)) as { team?: WireTeam } | null;
  record(
    "form save writes that player's own row and keeps the banner",
    freshSaved.ok &&
      freshSavedBody?.team?.name === "Fresh Lane FC" &&
      freshSavedBody?.team?.bannerPath?.endsWith(".png") === true,
    freshSavedBody?.team,
  );

  // ============ demo player team ============

  const original = await getTeam(player);
  record(
    "demo player GET /api/team -> full shape",
    Boolean(original) &&
      typeof original?.name === "string" && original.name.length > 0 &&
      typeof original?.bannerPath === "string" &&
      ["mens", "womens", "mixed"].includes(String(original?.division)) &&
      typeof original?.seed === "number",
    original,
  );
  const originalFields = original
    ? { name: original.name, tagline: original.tagline, preset: original.preset, accent: original.accent, division: original.division, seed: original.seed }
    : { name: "", tagline: "", preset: DEFAULT_PRESET, accent: "#c8ef70", division: "mens", seed: 1 };

  const saved = (await (await teamPut(player, {})).json().catch(() => null)) as { team?: WireTeam } | null;
  record(
    "player saves the full profile",
    saved?.team?.name === VALID_TEAM.name &&
      saved?.team?.tagline === VALID_TEAM.tagline &&
      saved?.team?.preset === VALID_TEAM.preset &&
      saved?.team?.accent === VALID_TEAM.accent &&
      saved?.team?.division === VALID_TEAM.division &&
      saved?.team?.seed === VALID_TEAM.seed,
    saved?.team,
  );

  const freshStill = await getTeam(fresh);
  record(
    "teams are per-user (the fresh row is untouched)",
    freshStill?.name === "Fresh Lane FC",
    freshStill?.name,
  );

  const roundTrip = await getTeam(player);
  record(
    "GET reflects the save (persistence)",
    roundTrip?.name === VALID_TEAM.name &&
      roundTrip?.tagline === VALID_TEAM.tagline &&
      roundTrip?.seed === VALID_TEAM.seed &&
      roundTrip?.bannerPath === original?.bannerPath,
    roundTrip,
  );

  const tooShort = await teamPut(player, { name: "X" });
  const tooShortBody = (await tooShort.json().catch(() => null)) as { message?: string } | null;
  record(
    "name too short rejected with a readable message",
    tooShort.status === 400 && Boolean(tooShortBody?.message),
    tooShortBody,
  );

  const tooLong = await teamPut(player, { name: "x".repeat(41) });
  record("name too long rejected", tooLong.status === 400, tooLong.status);

  const badPreset = await teamPut(player, { preset: "rainbow" });
  record("unknown banner preset rejected", badPreset.status === 400, badPreset.status);

  const badAccent = await teamPut(player, { accent: "lime" });
  record("non-hex accent rejected", badAccent.status === 400, badAccent.status);

  const badDivision = await teamPut(player, { division: "kids" });
  record("unknown division rejected", badDivision.status === 400, badDivision.status);

  const badSeed = await teamPut(player, { seed: 65 });
  record("seed out of range rejected", badSeed.status === 400, badSeed.status);

  const noBody = await api(player, "PUT", "/api/team");
  record("PUT without a body -> 400", noBody.status === 400, noBody.status);

  const anonGet = await api(null, "GET", "/api/team");
  record("signed-out GET /api/team -> 401", anonGet.status === 401, anonGet.status);

  const orgGet = await api(org, "GET", "/api/team");
  record("organizer GET /api/team -> 403", orgGet.status === 403, orgGet.status);

  // ============ banner lifecycle ============

  const anonUpload = await uploadBanner(null, new Blob([PNG_1PX], { type: "image/png" }), "x.png");
  record("signed-out banner upload -> 401", anonUpload.status === 401, anonUpload.status);

  const anonBanner = await fetch(`${BASE}/api/team/banner`);
  record("signed-out banner GET -> 401", anonBanner.status === 401, anonBanner.status);

  const noBanner = await fetch(`${BASE}/api/team/banner`, { headers: { Cookie: jarHeader(player) } });
  record("GET banner -> 404 while none exists", noBanner.status === 404, noBanner.status);

  const junk = await uploadBanner(player, new Blob([Buffer.from("definitely not an image")], { type: "image/png" }), "junk.png");
  record("non-image bytes -> 415", junk.status === 415, junk.status);

  const huge = await uploadBanner(
    player,
    new Blob([Buffer.concat([PNG_1PX, Buffer.alloc(3 * 1024 * 1024)])], { type: "image/png" }),
    "huge.png",
  );
  record("oversized upload -> 413", huge.status === 413, huge.status);

  const up = await uploadBanner(player, new Blob([PNG_1PX], { type: "image/png" }), "banner.png");
  const upBody = (await up.json().catch(() => null)) as { team?: WireTeam } | null;
  const firstPath = upBody?.team?.bannerPath ?? "";
  record(
    "PNG banner uploads into the team tree",
    up.ok && firstPath.startsWith("team-") && firstPath.endsWith(".png"),
    upBody?.team,
  );

  const servedPng = await fetch(`${BASE}/api/team/banner`, { headers: { Cookie: jarHeader(player) } });
  const servedPngBytes = Buffer.from(await servedPng.arrayBuffer());
  record(
    "banner serves as image/png with the stored bytes",
    servedPng.ok &&
      servedPng.headers.get("content-type") === "image/png" &&
      servedPngBytes.equals(PNG_1PX),
    { status: servedPng.status, type: servedPng.headers.get("content-type"), length: servedPngBytes.length },
  );

  const withBanner = await getTeam(player);
  record("GET /api/team carries bannerPath", withBanner?.bannerPath === firstPath, withBanner?.bannerPath);

  const firstDir = dirOf(firstPath);
  const filesAfterFirst = await filesIn(firstDir);
  record(
    "banner file on disk under its own tree",
    filesAfterFirst.length === 1 && firstPath.startsWith("team-"),
    { dir: path.relative(uploadRoot, firstDir), files: filesAfterFirst },
  );

  const reUp = await uploadBanner(player, new Blob([JPEG_BYTES], { type: "image/jpeg" }), "banner.jpg");
  const reUpBody = (await reUp.json().catch(() => null)) as { team?: WireTeam } | null;
  const secondPath = reUpBody?.team?.bannerPath ?? "";
  const filesAfterSecond = await filesIn(firstDir);
  record(
    "re-upload replaces; exactly one file remains",
    reUp.ok && secondPath.endsWith(".jpg") && secondPath !== firstPath && filesAfterSecond.length === 1,
    { path: secondPath, files: filesAfterSecond },
  );

  const servedJpeg = await fetch(`${BASE}/api/team/banner`, { headers: { Cookie: jarHeader(player) } });
  const servedJpegBytes = Buffer.from(await servedJpeg.arrayBuffer());
  record(
    "banner now serves as image/jpeg",
    servedJpeg.ok &&
      servedJpeg.headers.get("content-type") === "image/jpeg" &&
      servedJpegBytes.equals(JPEG_BYTES),
    { status: servedJpeg.status, type: servedJpeg.headers.get("content-type") },
  );

  const del = (await (await api(player, "DELETE", "/api/team/banner")).json().catch(() => null)) as { team?: WireTeam } | null;
  record("DELETE clears the banner", del?.team?.bannerPath === "", del?.team);

  const afterDel = await fetch(`${BASE}/api/team/banner`, { headers: { Cookie: jarHeader(player) } });
  record("GET banner -> 404 after delete", afterDel.status === 404, afterDel.status);

  const delAgain = await api(player, "DELETE", "/api/team/banner");
  record("DELETE again is idempotent", delAgain.ok, delAgain.status);

  const filesAfterDel = await filesIn(firstDir);
  record("banner file removed from disk", filesAfterDel.length === 0, filesAfterDel);

  // ============ schedule start time ============

  const anonLive = await api(null, "GET", "/api/tournaments/live");
  record("signed-out GET /api/tournaments/live -> 401", anonLive.status === 401, anonLive.status);

  const playerLive = await api(player, "GET", "/api/tournaments/live");
  record("player GET /api/tournaments/live -> 403", playerLive.status === 403, playerLive.status);

  const liveRes = await api(org, "GET", "/api/tournaments/live");
  const liveBody = (await liveRes.json().catch(() => null)) as { tournament?: { id: string; name: string; scheduleStart: string } } | null;
  const originalStart = liveBody?.tournament?.scheduleStart ?? "09:00";
  record(
    "organizer reads the live tournament with an HH:MM start",
    liveRes.ok && /^([01]\d|2[0-3]):[0-5]\d$/.test(originalStart) && Boolean(liveBody?.tournament?.id),
    liveBody?.tournament,
  );

  const anonPutStart = await api(null, "PUT", "/api/tournaments/live", { scheduleStart: "10:00" });
  record("signed-out PUT schedule start -> 401", anonPutStart.status === 401, anonPutStart.status);

  const playerPutStart = await api(player, "PUT", "/api/tournaments/live", { scheduleStart: "10:00" });
  record("player PUT schedule start -> 403", playerPutStart.status === 403, playerPutStart.status);

  const noStartBody = await api(org, "PUT", "/api/tournaments/live");
  record("PUT schedule start without a body -> 400", noStartBody.status === 400, noStartBody.status);

  const badHour = await api(org, "PUT", "/api/tournaments/live", { scheduleStart: "25:00" });
  const badHourBody = (await badHour.json().catch(() => null)) as { message?: string } | null;
  record(
    "invalid time 25:00 rejected with a readable message",
    badHour.status === 400 && Boolean(badHourBody?.message),
    badHourBody,
  );

  const badFormat = await api(org, "PUT", "/api/tournaments/live", { scheduleStart: "9:00 am" });
  record("invalid time 9:00 am rejected", badFormat.status === 400, badFormat.status);

  const setStart = (await (
    await api(org, "PUT", "/api/tournaments/live", { scheduleStart: "10:30" })
  ).json().catch(() => null)) as { tournament?: { scheduleStart: string } } | null;
  record("organizer sets the start time", setStart?.tournament?.scheduleStart === "10:30", setStart?.tournament);

  const startAgain = await api(org, "GET", "/api/tournaments/live");
  const startAgainBody = (await startAgain.json().catch(() => null)) as { tournament?: { scheduleStart: string } } | null;
  record(
    "GET reflects the new start (persistence)",
    startAgainBody?.tournament?.scheduleStart === "10:30",
    startAgainBody?.tournament,
  );

  // ============ workspace page smokes ============

  const teamPage = await fetch(`${BASE}/player/team`, { headers: { Cookie: jarHeader(player) } });
  const teamHtml = await teamPage.text();
  record(
    "player team page renders (signed in)",
    teamPage.status === 200 && teamHtml.includes("Team join code"),
    { status: teamPage.status, marker: teamHtml.includes("Team join code") },
  );

  const schedulePage = await fetch(`${BASE}/organizer/schedule`, { headers: { Cookie: jarHeader(org) } });
  const scheduleHtml = await schedulePage.text();
  record(
    "organizer schedule page renders (signed in)",
    schedulePage.status === 200 && scheduleHtml.includes("Auto-fill schedule"),
    { status: schedulePage.status, marker: scheduleHtml.includes("Auto-fill schedule") },
  );

  // ============ restore ============

  const restored = await api(player, "PUT", "/api/team", originalFields);
  const restoredBody = (await restored.json().catch(() => null)) as { team?: WireTeam } | null;
  const matchesOriginal =
    restoredBody?.team?.name === originalFields.name &&
    restoredBody?.team?.tagline === originalFields.tagline &&
    restoredBody?.team?.preset === originalFields.preset &&
    restoredBody?.team?.accent === originalFields.accent &&
    restoredBody?.team?.division === originalFields.division &&
    restoredBody?.team?.seed === originalFields.seed;
  record("demo player fields restored", restored.ok && matchesOriginal, restoredBody?.team);

  const restoredStart = await api(org, "PUT", "/api/tournaments/live", { scheduleStart: originalStart });
  const restoredStartBody = (await restoredStart.json().catch(() => null)) as { tournament?: { scheduleStart: string } } | null;
  record(
    "schedule start restored",
    restoredStart.ok && restoredStartBody?.tournament?.scheduleStart === originalStart,
    restoredStartBody?.tournament,
  );

  // Silent cleanup: the fresh signup's banner and fields go back to defaults
  // so only the account itself remains, as in Phase 2.
  await api(fresh, "DELETE", "/api/team/banner");
  await api(fresh, "PUT", "/api/team", {
    name: MY_TEAM,
    tagline: "",
    preset: BANNER_PRESETS[0].id,
    accent: "#c8ef70",
    division: "mens",
    seed: 1,
  });

  // --- report ---
  let failed = 0;
  for (const [label, ok, actual] of checks) {
    if (ok) console.log(`  ok    ${label}`);
    else {
      failed++;
      console.error(`  FAIL  ${label}:`, JSON.stringify(actual));
    }
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed > 0) process.exit(1);
  console.log("Phase 5 verification passed.");
  console.log("Note: all nine sidelines.demo.* localStorage keys are now retired.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
