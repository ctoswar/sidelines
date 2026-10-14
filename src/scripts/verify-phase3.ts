/**
 * Phase 3 verification: exercises the player profile API against a running
 * server (`npm run dev` or `npm run start` on port 3000).
 *
 * Covers: reading the seeded profile, updating fields (with duplicate
 * email/username rejection), photo upload (magic-byte validation, size cap),
 * serving the photo, deleting it, and role/auth gates.
 *
 * Usage:  npm run start         (in one shell)
 *         npx tsx src/scripts/verify-phase3.ts
 */

import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

async function api(jar: CookieJar, method: string, route: string, body?: unknown) {
  return fetch(`${BASE}${route}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...ORIGIN_HEADERS,
      Cookie: jarHeader(jar),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function uploadPhoto(jar: CookieJar, file: Blob, name: string) {
  const form = new FormData();
  form.append("photo", file, name);
  return fetch(`${BASE}/api/profile/photo`, {
    method: "POST",
    headers: { ...ORIGIN_HEADERS, Cookie: jarHeader(jar) },
    body: form,
  });
}

/** Minimal valid 1x1 PNG. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  // Start from a clean upload root — leftover files from an earlier run would
  // skew the on-disk assertions. Dev-only local disk, safe to clear.
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "./var/uploads");
  await mkdir(uploadRoot, { recursive: true });
  for (const entry of await readdir(uploadRoot).catch(() => [] as string[])) {
    await rm(path.join(uploadRoot, entry), { recursive: true, force: true });
  }

  const checks: [string, boolean, unknown][] = [];
  const record = (label: string, ok: boolean, actual: unknown) => checks.push([label, ok, actual]);

  // --- sign in as the seeded player ---
  const jar: CookieJar = new Map();
  const login = await signIn("player@example.com", DEMO_PASSWORD, jar);
  record("demo player sign-in ok", login.ok, login.status);

  // --- 1. GET returns the seeded profile ---
  const initial = await api(jar, "GET", "/api/profile");
  const initialBody = await initial.json().catch(() => null) as { profile?: Record<string, unknown> } | null;
  const initialProfile = initialBody?.profile;
  record(
    "GET returns seeded profile",
    initial.ok && initialProfile?.username === "alex.rivera" && initialProfile?.city === "Imus, Cavite",
    initialProfile,
  );

  // --- 2. PUT updates fields ---
  const stamp = randomUUID().slice(0, 8);
  const updated = await api(jar, "PUT", "/api/profile", {
    ...initialProfile,
    bio: `Phase three ${stamp}`,
    city: "Cebu City",
  });
  const updatedBody = await updated.json().catch(() => null) as { profile?: Record<string, unknown> } | null;
  record(
    "PUT updates bio and city",
    updated.ok && updatedBody?.profile?.bio === `Phase three ${stamp}` && updatedBody?.profile?.city === "Cebu City",
    updatedBody?.profile,
  );

  // --- 3. PUT with a duplicate username/email is rejected ---
  const dupeUser = await api(jar, "PUT", "/api/profile", { ...initialProfile, username: "sam.organizer" });
  const dupeUserBody = await dupeUser.json().catch(() => null) as { message?: string } | null;
  record(
    "duplicate username rejected",
    dupeUser.status === 409 && String(dupeUserBody?.message ?? "").includes("username"),
    dupeUserBody,
  );

  const dupeEmail = await api(jar, "PUT", "/api/profile", { ...initialProfile, email: "organizer@example.com" });
  const dupeEmailBody = await dupeEmail.json().catch(() => null) as { message?: string } | null;
  record(
    "duplicate email rejected",
    dupeEmail.status === 409 && String(dupeEmailBody?.message ?? "").includes("email"),
    dupeEmailBody,
  );

  // --- 4. invalid enum value is rejected with a readable message ---
  const badEnum = await api(jar, "PUT", "/api/profile", { ...updatedBody?.profile, gender: "Robot" });
  const badEnumBody = await badEnum.json().catch(() => null) as { message?: string } | null;
  record(
    "invalid gender rejected",
    badEnum.status === 400 && Boolean(badEnumBody?.message),
    badEnumBody,
  );

  // --- 5. no photo yet ---
  const noPhoto = await fetch(`${BASE}/api/profile/photo`, { headers: { Cookie: jarHeader(jar) } });
  record("GET photo 404 before upload", noPhoto.status === 404, noPhoto.status);

  // --- 6. fake image (wrong magic bytes) rejected ---
  const fake = await uploadPhoto(jar, new Blob(["definitely not an image"], { type: "image/png" }), "fake.png");
  const fakeBody = await fake.json().catch(() => null) as { message?: string } | null;
  record(
    "non-image bytes rejected",
    fake.status === 415 && String(fakeBody?.message ?? "").includes("JPG"),
    { status: fake.status, body: fakeBody },
  );

  // --- 7. oversized upload rejected ---
  const big = await uploadPhoto(jar, new Blob([Buffer.concat([PNG_1PX, Buffer.alloc(3 * 1024 * 1024)])], { type: "image/png" }), "big.png");
  record("oversized upload rejected", big.status === 413, big.status);

  // --- 8. real PNG uploads ---
  const upload = await uploadPhoto(jar, new Blob([PNG_1PX], { type: "image/png" }), "me.png");
  const uploadBody = await upload.json().catch(() => null) as { photoPath?: string } | null;
  record(
    "photo uploads",
    upload.ok && typeof uploadBody?.photoPath === "string" && uploadBody.photoPath.endsWith(".png"),
    uploadBody,
  );

  // --- 9. profile now carries the photo URL ---
  const withPhoto = await api(jar, "GET", "/api/profile");
  const withPhotoBody = await withPhoto.json().catch(() => null) as { profile?: { photoPath?: string | null } } | null;
  record(
    "profile carries photoPath",
    withPhotoBody?.profile?.photoPath === uploadBody?.photoPath,
    withPhotoBody?.profile,
  );

  // --- 10. photo serves as image/png ---
  const served = await fetch(`${BASE}/api/profile/photo`, { headers: { Cookie: jarHeader(jar) } });
  const servedBytes = Buffer.from(await served.arrayBuffer());
  record(
    "photo serves as image/png",
    served.ok && served.headers.get("content-type") === "image/png" && servedBytes.equals(PNG_1PX),
    { status: served.status, type: served.headers.get("content-type"), length: servedBytes.length },
  );

  // --- 11. the file exists on disk under the upload root, scoped to the user ---
  const userDirs = await readdir(uploadRoot).catch(() => [] as string[]);
  const withFiles = [] as string[];
  for (const dir of userDirs) {
    const files = await readdir(path.join(uploadRoot, dir)).catch(() => [] as string[]);
    if (files.length > 0) withFiles.push(dir);
  }
  record("photo file on disk under upload root", withFiles.length > 0, withFiles);

  // --- 12. re-upload replaces; only one file remains for this user ---
  await uploadPhoto(jar, new Blob([PNG_1PX], { type: "image/png" }), "me-again.png");
  const playerDir = path.join(uploadRoot, String(uploadBody?.photoPath ?? "").split("/")[0]);
  const remaining = await readdir(playerDir).catch(() => [] as string[]);
  record("re-upload leaves exactly one file", remaining.length === 1, remaining);

  // --- 13. DELETE removes photo + file ---
  const del = await api(jar, "DELETE", "/api/profile/photo");
  const afterDelete = await fetch(`${BASE}/api/profile/photo`, { headers: { Cookie: jarHeader(jar) } });
  const dirAfter = await readdir(playerDir).catch(() => [] as string[]);
  record(
    "DELETE removes photo and file",
    del.ok && afterDelete.status === 404 && dirAfter.length === 0,
    { del: del.status, serve: afterDelete.status, files: dirAfter },
  );

  // --- 13b. email change keeps sign-in working ---
  // Better Auth resolves the credential account through the user id, so a new
  // email must not orphan it. (It once did: the PUT rewrote account.accountId
  // and the account became un-signable-in.)
  const newEmail = `moved.${stamp}@example.com`;
  const moved = await api(jar, "PUT", "/api/profile", { ...initialProfile, email: newEmail });
  const movedOut: CookieJar = new Map();
  const movedLogin = await signIn(newEmail, DEMO_PASSWORD, movedOut);
  const oldLogin = await signIn("player@example.com", DEMO_PASSWORD, new Map());
  record(
    "email change: new email signs in, old does not",
    moved.ok && movedLogin.ok && !oldLogin.ok,
    { put: moved.status, newLogin: movedLogin.status, oldLogin: oldLogin.status },
  );

  // --- 14. gates: signed out and wrong role ---
  const anon = await fetch(`${BASE}/api/profile`);
  record("GET profile signed out -> 401", anon.status === 401, anon.status);

  const orgJar: CookieJar = new Map();
  await signIn("organizer@example.com", DEMO_PASSWORD, orgJar);
  const orgGet = await api(orgJar, "GET", "/api/profile");
  record("organizer GET profile -> 403", orgGet.status === 403, orgGet.status);

  const orgUpload = await uploadPhoto(orgJar, new Blob([PNG_1PX], { type: "image/png" }), "x.png");
  record("organizer photo upload -> 403", orgUpload.status === 403, orgUpload.status);

  // --- cleanup: restore the seeded bio/city so the seed stays truthful ---
  const restored = await api(jar, "PUT", "/api/profile", { ...initialProfile, bio: initialProfile?.bio ?? "" });
  record("profile restored for seeding", restored.ok, restored.status);

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
  console.log("Phase 3 verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
