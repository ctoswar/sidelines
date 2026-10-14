/**
 * Phase 4 verification: exercises the events/registrations/announcements API
 * and the capability-token scoring endpoints against a running server
 * (`npm run dev` or `npm run start` on port 3000).
 *
 * Covers: catalogue + detail parity with the static modules the pages render
 * from, the registration lifecycle (register, idempotency, organizer inbox,
 * role column, removal, self-cancel), the announcement lifecycle (organizer
 * publish with server-set author, filters, delete, gates), and QR scoring
 * (crew feed, name save, token mint/rotation, the score page resolving
 * tokens server-side, and the result endpoint accepting only a valid
 * same-game token or an organizer session).
 *
 * End state: g1 keeps its seeded crew names and mock score (11–8); no
 * registrations or announcements remain.
 *
 * Usage:  npm run start         (in one shell)
 *         npx tsx src/scripts/verify-phase4.ts
 */

import { getEventDetail } from "../lib/event-detail";
import { keepers } from "../lib/mock-data";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "sidelines-demo";
const SLUG = "harbor-spring-open";
const GAME_ID = "g1";
const TITLE = (n: number) => `PH4 announcement ${n}`;

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

async function signIn(email: string, password: string, jar: CookieJar) {
  // Better Auth's production default rate-limits sign-in to 3 attempts per
  // 10 seconds per IP. The harness runs several sign-ins in a burst (and
  // often right after another harness), so back off and retry on 429 rather
  // than fighting the limiter or disabling it in the app.
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN_HEADERS },
      body: JSON.stringify({ email, password }),
    });
    if (response.status !== 429 || attempt >= 4) {
      storeCookies(jar, response);
      return response;
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await new Promise((resolve) => setTimeout(resolve, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10) * 1000));
  }
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

/** Result submission as the public score page does it: Bearer capability token. */
async function submitWithToken(gameId: string, token: string, score: string) {
  return fetch(`${BASE}/api/score/games/${gameId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ score }),
  });
}

async function main() {
  const checks: [string, boolean, unknown][] = [];
  const record = (label: string, ok: boolean, actual: unknown) => checks.push([label, ok, actual]);

  // --- sign in: one player, one organizer ---
  const player: CookieJar = new Map();
  const org: CookieJar = new Map();
  const playerLogin = await signIn("player@example.com", DEMO_PASSWORD, player);
  const orgLogin = await signIn("organizer@example.com", DEMO_PASSWORD, org);
  record("demo player sign-in ok", playerLogin.ok, playerLogin.status);
  record("demo organizer sign-in ok", orgLogin.ok, orgLogin.status);
  const orgName =
    ((await orgLogin.json().catch(() => null)) as { user?: { name?: string } } | null)?.user?.name ?? "Sam Organizer";

  // ============ events catalogue + detail ============

  // --- 1. public catalogue with live counts ---
  const cat = await api(null, "GET", "/api/events");
  const catBody = (await cat.json().catch(() => null)) as {
    events?: Array<{ slug: string; registrationCount: number }>;
  } | null;
  const catEntry = catBody?.events?.find((e) => e.slug === SLUG);
  record(
    "signed-out GET /api/events lists the catalogue",
    cat.ok && Boolean(catEntry) && typeof catEntry?.registrationCount === "number",
    catEntry ?? catBody,
  );

  // --- 2. DB detail is identical to what the static pages render ---
  const detailRes = await api(null, "GET", `/api/events/${SLUG}`);
  const detailBody = (await detailRes.json().catch(() => null)) as { detail?: Record<string, any> } | null;
  const db = detailBody?.detail;
  const stat = getEventDetail(SLUG);
  const lengths = (d: Record<string, any> | undefined) =>
    d &&
    [
      d.teams?.length,
      d.matches?.length,
      d.pools?.A?.length,
      d.pools?.B?.length,
      d.overall?.length,
      d.bracket?.length,
      d.players?.length,
      d.mvp?.length,
      d.crew?.length,
      d.facts?.length,
      d.announcements?.length,
    ].join(",");
  record(
    "DB detail matches the static module (parity)",
    detailRes.ok &&
      stat !== null &&
      db?.event?.name === stat.event.name &&
      db?.about === stat.about &&
      db?.venue?.name === stat.venue.name &&
      db?.tz?.label === stat.tz.label &&
      db?.days === stat.days &&
      db?.fields === stat.fields &&
      lengths(db) === lengths(stat as unknown as Record<string, any>),
    { db: lengths(db), static: lengths(stat as unknown as Record<string, any>) },
  );

  // --- 3. unknown slug is a 404 ---
  const bogus = await api(null, "GET", "/api/events/no-such-event");
  record("GET unknown event -> 404", bogus.status === 404, bogus.status);

  // ============ registrations ============

  type RegState = { count: number; registered: boolean; registrations: unknown[] | null };
  const stateOf = async (jar: CookieJar | null) =>
    (await (await api(jar, "GET", `/api/events/${SLUG}/registrations`)).json()) as RegState;

  // Start from "this player has no registration" so counts are predictable
  // even if a previous run was interrupted.
  await api(player, "DELETE", `/api/events/${SLUG}/registrations`);

  const anonState = await stateOf(null);
  record(
    "signed-out state: count present, registered false, list withheld",
    typeof anonState.count === "number" && anonState.registered === false && anonState.registrations === null,
    anonState,
  );

  const anonPost = await api(null, "POST", `/api/events/${SLUG}/registrations`);
  record("signed-out register -> 401", anonPost.status === 401, anonPost.status);

  const before = await stateOf(player);
  const reg1 = await api(player, "POST", `/api/events/${SLUG}/registrations`);
  const reg1Body = (await reg1.json()) as RegState;
  record(
    "player registers: registered true, count +1",
    reg1.ok && reg1Body.registered === true && reg1Body.count === before.count + 1,
    { before: before.count, after: reg1Body.count },
  );

  const reg2 = await api(player, "POST", `/api/events/${SLUG}/registrations`);
  const reg2Body = (await reg2.json()) as RegState;
  record(
    "double registration is idempotent",
    reg2.ok && reg2Body.count === reg1Body.count,
    reg2Body,
  );

  const mine = (await (await api(player, "GET", "/api/registrations")).json()) as {
    registrations: Array<{ slug: string; role: string | null }>;
  };
  record(
    "GET /api/registrations returns my row",
    mine.registrations.some((r) => r.slug === SLUG),
    mine.registrations,
  );

  const orgList = (await (await api(org, "GET", `/api/events/${SLUG}/registrations`)).json()) as {
    count: number;
    registrations: Array<{ id: string; email: string; role: string | null }> | null;
  };
  const myRow = orgList.registrations?.find((r) => r.email === "player@example.com");
  record(
    "organizer inbox lists the registration with the real role",
    orgList.registrations !== null && orgList.count === reg1Body.count && myRow?.role === "player",
    orgList.registrations,
  );

  const counts = (await (await api(org, "GET", "/api/events")).json()) as {
    events: Array<{ slug: string; registrationCount: number }>;
  };
  record(
    "catalogue carries the live registration count",
    counts.events.find((e) => e.slug === SLUG)?.registrationCount === reg1Body.count,
    counts.events.find((e) => e.slug === SLUG),
  );

  const playerRemoves = await api(player, "DELETE", `/api/events/${SLUG}/registrations/${myRow?.id ?? "none"}`);
  record("player removing someone else's row -> 403", playerRemoves.status === 403, playerRemoves.status);

  const orgRemove = await api(org, "DELETE", `/api/events/${SLUG}/registrations/${myRow?.id ?? "none"}`);
  const afterOrgRemove = await stateOf(null);
  record(
    "organizer removes from the inbox",
    orgRemove.ok && afterOrgRemove.count === reg1Body.count - 1,
    { remove: orgRemove.status, count: afterOrgRemove.count },
  );

  await api(player, "POST", `/api/events/${SLUG}/registrations`);
  const selfCancel = await api(player, "DELETE", `/api/events/${SLUG}/registrations`);
  const afterCancel = (await selfCancel.json()) as RegState;
  const mineAfter = (await (await api(player, "GET", "/api/registrations")).json()) as {
    registrations: Array<{ slug: string }>;
  };
  record(
    "player cancels their own registration",
    selfCancel.ok && afterCancel.registered === false && !mineAfter.registrations.some((r) => r.slug === SLUG),
    afterCancel,
  );

  const bogusReg = await api(player, "GET", "/api/events/no-such-event/registrations");
  record("registration state for unknown event -> 404", bogusReg.status === 404, bogusReg.status);

  // ============ announcements ============

  type Ann = { id: string; slug: string; title: string; body: string; author: string; at: string };
  const listAnns = async (query = "") =>
    (await (await api(null, "GET", `/api/announcements${query}`)).json()) as { announcements: Ann[] };

  // Clear leftovers from an interrupted earlier run so counts are ours alone.
  for (const a of (await listAnns()).announcements.filter((x) => x.title.startsWith("PH4 "))) {
    await api(org, "DELETE", `/api/announcements/${a.id}`);
  }

  const anonAnns = await listAnns();
  record("signed-out GET /api/announcements -> 200", Array.isArray(anonAnns.announcements), anonAnns.announcements?.length);

  const playerPost = await api(player, "POST", "/api/announcements", { slug: SLUG, title: "nope", body: "nope" });
  record("player publishing -> 403", playerPost.status === 403, playerPost.status);

  const anonPostAnn = await api(null, "POST", "/api/announcements", { slug: SLUG, title: "nope", body: "nope" });
  record("signed-out publishing -> 401", anonPostAnn.status === 401, anonPostAnn.status);

  const invalidAnn = await api(org, "POST", "/api/announcements", { slug: SLUG, title: "", body: "body" });
  const invalidAnnBody = (await invalidAnn.json().catch(() => null)) as { message?: string } | null;
  record(
    "empty title rejected with a readable message",
    invalidAnn.status === 400 && Boolean(invalidAnnBody?.message),
    invalidAnnBody,
  );

  const created1 = (await (
    await api(org, "POST", "/api/announcements", { slug: SLUG, title: TITLE(1), body: "Court 1 resurfaced." })
  ).json()) as { announcement: Ann };
  record(
    "organizer publishes; author comes from the session",
    created1.announcement?.author === orgName && created1.announcement?.slug === SLUG,
    created1.announcement,
  );

  const created2 = (await (
    await api(org, "POST", "/api/announcements", { slug: SLUG, title: TITLE(2), body: "Warm-up moved indoors." })
  ).json()) as { announcement: Ann };

  const filtered = await listAnns(`?slug=${SLUG}`);
  record(
    "slug filter returns both of ours, nothing else",
    [TITLE(1), TITLE(2)].every((t) => filtered.announcements.some((a) => a.title === t)) &&
      filtered.announcements.every((a) => a.slug === SLUG),
    filtered.announcements.map((a) => a.title),
  );

  const limited = await listAnns(`?slug=${SLUG}&limit=1`);
  record(
    "limit=1 returns exactly one, newest first",
    limited.announcements.length === 1 &&
      [TITLE(1), TITLE(2)].includes(limited.announcements[0]?.title ?? "") &&
      limited.announcements[0]?.id === created2.announcement.id,
    limited.announcements.map((a) => a.title),
  );

  const delAnn = await api(org, "DELETE", `/api/announcements/${created1.announcement.id}`);
  const afterDel = await listAnns(`?slug=${SLUG}`);
  record(
    "organizer deletes an announcement",
    delAnn.ok && !afterDel.announcements.some((a) => a.id === created1.announcement.id),
    afterDel.announcements.map((a) => a.title),
  );

  const delBogus = await api(org, "DELETE", "/api/announcements/not-a-real-id");
  record("delete unknown announcement -> 404", delBogus.status === 404, delBogus.status);

  const playerDeletes = await api(player, "DELETE", `/api/announcements/${created2.announcement.id}`);
  record("player deleting an announcement -> 403", playerDeletes.status === 403, playerDeletes.status);

  // Cleanup so the demo table stays ours-only.
  await api(org, "DELETE", `/api/announcements/${created2.announcement.id}`);

  // ============ capability-token scoring ============

  const seededScorer = keepers.find((k) => k.gameId === GAME_ID && k.role === "Scorer")?.name ?? "Maya Reyes";
  const seededUmpire = keepers.find((k) => k.gameId === GAME_ID && k.role === "Umpire")?.name ?? "Jon Park";

  const anonCrew = await api(null, "GET", "/api/score/games");
  record("signed-out crew feed -> 401", anonCrew.status === 401, anonCrew.status);

  const playerCrew = await api(player, "GET", "/api/score/games");
  record("player crew feed -> 403", playerCrew.status === 403, playerCrew.status);

  const crewFeed = (await (await api(org, "GET", "/api/score/games")).json()) as {
    crew: Record<string, { scorekeeper: string; umpire: string }>;
  };
  record(
    "organizer crew feed carries the seeded names",
    crewFeed.crew?.[GAME_ID]?.scorekeeper === seededScorer && crewFeed.crew?.[GAME_ID]?.umpire === seededUmpire,
    crewFeed.crew?.[GAME_ID],
  );

  const anonPut = await api(null, "PUT", `/api/score/games/${GAME_ID}/crew`, { scorekeeper: "X", umpire: "Y" });
  record("signed-out crew save -> 401", anonPut.status === 401, anonPut.status);

  const emptyCrew = await api(org, "PUT", `/api/score/games/${GAME_ID}/crew`, { scorekeeper: "", umpire: "Y" });
  record("empty crew name rejected", emptyCrew.status === 400, emptyCrew.status);

  // Round-trip the seeded names so the demo DB is unchanged afterwards.
  const putCrew = (await (
    await api(org, "PUT", `/api/score/games/${GAME_ID}/crew`, { scorekeeper: seededScorer, umpire: seededUmpire })
  ).json()) as { crew: { scorekeeper: string; umpire: string } };
  record(
    "organizer saves crew names",
    putCrew.crew?.scorekeeper === seededScorer && putCrew.crew?.umpire === seededUmpire,
    putCrew.crew,
  );

  const tokens = (await (
    await api(org, "POST", `/api/score/games/${GAME_ID}/tokens`, { scorekeeper: seededScorer, umpire: seededUmpire })
  ).json()) as { scoreToken: string; umpireToken: string };
  record(
    "mint returns two long, distinct tokens",
    tokens.scoreToken?.length >= 20 && tokens.umpireToken?.length >= 20 && tokens.scoreToken !== tokens.umpireToken,
    { score: tokens.scoreToken?.length, umpire: tokens.umpireToken?.length },
  );

  const page = (t?: string) =>
    fetch(`${BASE}/score/${GAME_ID}${t ? `?t=${encodeURIComponent(t)}` : ""}`).then(async (r) => ({
      status: r.status,
      html: await r.text(),
    }));

  const scorerPage = await page(tokens.scoreToken);
  record(
    "scorer token renders the panel as that person",
    scorerPage.status === 200 &&
      scorerPage.html.includes(seededScorer) &&
      scorerPage.html.includes("Scorekeeper") &&
      scorerPage.html.includes("score-point-button") &&
      !scorerPage.html.includes('data-score-access="invalid"'),
    { status: scorerPage.status, hasName: scorerPage.html.includes(seededScorer) },
  );

  const umpirePage = await page(tokens.umpireToken);
  record(
    "umpire token renders as the umpire",
    umpirePage.status === 200 && umpirePage.html.includes(seededUmpire) && umpirePage.html.includes("Umpire"),
    { status: umpirePage.status, hasName: umpirePage.html.includes(seededUmpire) },
  );

  // The panel is identified by its +1 button's class — the literal "+1"
  // appears in Next's inline Flight script either way, so it is not a marker.
  const garbagePage = await page("not-a-real-token");
  record(
    "garbage token gets the invalid screen, no scoring panel",
    garbagePage.status === 200 &&
      garbagePage.html.includes('data-score-access="invalid"') &&
      !garbagePage.html.includes("score-point-button"),
    { invalid: garbagePage.html.includes('data-score-access="invalid"'), panel: garbagePage.html.includes("score-point-button") },
  );

  const noTokenPage = await page();
  record(
    "missing token gets the invalid screen too",
    noTokenPage.html.includes('data-score-access="invalid"') && !noTokenPage.html.includes("score-point-button"),
    { invalid: noTokenPage.html.includes('data-score-access="invalid"') },
  );

  // Rotation: minting again revokes the printed links.
  const rotated = (await (
    await api(org, "POST", `/api/score/games/${GAME_ID}/tokens`, { scorekeeper: seededScorer, umpire: seededUmpire })
  ).json()) as { scoreToken: string; umpireToken: string };
  const oldTokenPage = await page(tokens.scoreToken);
  const newTokenPage = await page(rotated.scoreToken);
  record(
    "re-minting rotates: old link dies, new link works",
    rotated.scoreToken !== tokens.scoreToken &&
      oldTokenPage.html.includes('data-score-access="invalid"') &&
      newTokenPage.html.includes(seededScorer),
    { rotated: rotated.scoreToken !== tokens.scoreToken, oldInvalid: oldTokenPage.html.includes('data-score-access="invalid"') },
  );

  const crossGamePage = await fetch(`${BASE}/score/g2?t=${encodeURIComponent(rotated.scoreToken)}`);
  const crossGameHtml = await crossGamePage.text();
  record(
    "a token from another game does not open this one",
    crossGameHtml.includes('data-score-access="invalid"') && !crossGameHtml.includes("score-point-button"),
    { invalid: crossGameHtml.includes('data-score-access="invalid"') },
  );

  // --- result endpoint ---
  const noCred = await fetch(`${BASE}/api/score/games/${GAME_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN_HEADERS },
    body: JSON.stringify({ score: "11–8" }),
  });
  record("signed-out result submit -> 401", noCred.status === 401, noCred.status);

  const playerSubmit = await api(player, "POST", `/api/score/games/${GAME_ID}`, { score: "11–8" });
  record("player session without token -> 403", playerSubmit.status === 403, playerSubmit.status);

  const garbageToken = await submitWithToken(GAME_ID, "garbage-token", "11–8");
  record("garbage Bearer token -> 401", garbageToken.status === 401, garbageToken.status);

  const crossGame = await submitWithToken("g2", rotated.scoreToken, "11–8");
  record("valid token, wrong game -> 403", crossGame.status === 403, crossGame.status);

  const badScore = await submitWithToken(GAME_ID, rotated.umpireToken, "eleven");
  const badScoreBody = (await badScore.json().catch(() => null)) as { message?: string } | null;
  record(
    "malformed score rejected with a readable message",
    badScore.status === 400 && Boolean(badScoreBody?.message),
    badScoreBody,
  );

  const tokenSubmit = await submitWithToken(GAME_ID, rotated.scoreToken, "11–8");
  const tokenSubmitBody = (await tokenSubmit.json().catch(() => null)) as {
    result?: { score: string; completedAt: string };
  } | null;
  record(
    "scorer token submits the final score",
    tokenSubmit.ok && tokenSubmitBody?.result?.score === "11–8",
    tokenSubmitBody,
  );

  const results = (await (await api(null, "GET", "/api/score/results")).json()) as {
    results: Record<string, { score: string }>;
  };
  record(
    "results feed carries the saved score",
    results.results?.[GAME_ID]?.score === "11–8",
    results.results?.[GAME_ID],
  );

  const orgSubmit = await api(org, "POST", `/api/score/games/${GAME_ID}`, { score: "11–8" });
  record("organizer session submits without a token (workspace path)", orgSubmit.ok, orgSubmit.status);

  const unknownGame = await api(org, "POST", "/api/score/games/g-nope", { score: "11–8" });
  record("result for unknown game -> 404", unknownGame.status === 404, unknownGame.status);

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
  console.log("Phase 4 verification passed.");
  console.log(`Note: ${GAME_ID} keeps a saved result (11–8, its seeded score); npm run db:seed clears it.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
