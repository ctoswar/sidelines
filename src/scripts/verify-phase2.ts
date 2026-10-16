/**
 * Phase 2 verification: exercises the real auth HTTP flow against a running
 * dev server (`npm run dev` on port 3000) backed by the Pi database.
 *
 * Covers: sign-in with the seeded fixture accounts, session read-through,
 * sign-up (player + organizer), duplicate rejection, and the middleware
 * redirect for signed-out workspace visits.
 *
 * Usage:  npm run dev            (in one shell)
 *         npx tsx src/scripts/verify-phase2.ts
 */

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "sidelines-demo";

// Better Auth rejects state-changing requests without an Origin header
// (CSRF). A real browser sends it on every POST; Node's fetch does not, so
// the script has to add it by hand.
const ORIGIN_HEADERS = { Origin: BASE, Referer: `${BASE}/` };

/** Short unique suffix that keeps generated usernames inside the 20-char cap. */
const STAMP = Math.random().toString(36).slice(2, 8);

type CookieJar = Map<string, string>;

/** Minimal cookie jar so each actor (player/organizer/new user) is separate. */
function jarHeader(jar: CookieJar): string {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(jar: CookieJar, response: Response) {
  // getSetCookie gives every Set-Cookie line; a single join would merge them.
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function signIn(email: string, password: string, jar: CookieJar) {
  // Better Auth's production default rate-limits sign-in to 3 attempts per
  // 10 seconds per IP, and this harness signs in several times in a burst —
  // especially when run right after another harness. Back off on 429 rather
  // than disabling the limiter in the app.
  let response!: Response;
  for (let attempt = 1; ; attempt++) {
    response = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN_HEADERS },
      body: JSON.stringify({ email, password }),
    });
    if (response.status !== 429 || attempt >= 4) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    await new Promise((resolve) => setTimeout(resolve, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10) * 1000));
  }
  storeCookies(jar, response);
  return { response, body: await response.json().catch(() => null) as Record<string, unknown> | null };
}

async function signUp(payload: Record<string, unknown>, jar: CookieJar) {
  const response = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN_HEADERS },
    body: JSON.stringify(payload),
  });
  storeCookies(jar, response);
  return { response, body: await response.json().catch(() => null) as Record<string, unknown> | null };
}

async function getSession(jar: CookieJar) {
  const response = await fetch(`${BASE}/api/auth/get-session`, {
    headers: { Cookie: jarHeader(jar) },
  });
  return { response, body: await response.json().catch(() => null) as Record<string, unknown> | null };
}

async function visit(path: string, jar: CookieJar) {
  return fetch(`${BASE}${path}`, {
    headers: { Cookie: jarHeader(jar) },
    redirect: "manual",
  });
}

function playerPayload(username: string, email: string) {
  return {
    role: "player",
    username,
    name: "Phase Two Tester",
    email,
    password: DEMO_PASSWORD,
    confirm: DEMO_PASSWORD,
    terms: true,
    nickname: "Tester",
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
    bio: "Here for phase two.",
    profileColor: "#c8ef70",
    code: "",
  };
}

async function main() {
  const checks: [string, boolean, unknown][] = [];
  const record = (label: string, ok: boolean, actual: unknown) => checks.push([label, ok, actual]);

  // --- 1. seeded player signs in ---
  const playerJar: CookieJar = new Map();
  const playerIn = await signIn(`player@example.com`, DEMO_PASSWORD, playerJar);
  record("fixture player sign-in ok", playerIn.response.ok, playerIn.body);

  const playerSession = await getSession(playerJar);
  const playerUser = (playerSession.body?.user ?? null) as Record<string, unknown> | null;
  record(
    "player session has role=player",
    playerUser?.email === "player@example.com" && playerUser?.role === "player",
    playerUser,
  );

  // --- 2. seeded organizer signs in ---
  const orgJar: CookieJar = new Map();
  const orgIn = await signIn("organizer@example.com", DEMO_PASSWORD, orgJar);
  record("fixture organizer sign-in ok", orgIn.response.ok, orgIn.body);

  const orgSession = await getSession(orgJar);
  const orgUser = (orgSession.body?.user ?? null) as Record<string, unknown> | null;
  record(
    "organizer session has role=organizer",
    orgUser?.email === "organizer@example.com" && orgUser?.role === "organizer",
    orgUser,
  );

  // --- 3. wrong password is rejected ---
  const badJar: CookieJar = new Map();
  const bad = await signIn("player@example.com", "not-the-password", badJar);
  record("wrong password rejected", !bad.response.ok, bad.body);

  // --- 4. new player signs up (credential + profile row) ---
  const newJar: CookieJar = new Map();
  const created = await signUp(playerPayload(`phase.two.${STAMP}`, `phase.two.${STAMP}@example.com`), newJar);
  record("new player sign-up ok", created.response.ok, created.body);

  const newSession = await getSession(newJar);
  const newUser = (newSession.body?.user ?? null) as Record<string, unknown> | null;
  record("signed in right after sign-up", newUser?.email === `phase.two.${STAMP}@example.com`, newUser);

  // --- 5. duplicate email / username rejected with a readable message ---
  const dupeJar: CookieJar = new Map();
  const dupeEmail = await signUp(playerPayload(`other.${STAMP}`, `player@example.com`), dupeJar);
  record(
    "duplicate email rejected",
    !dupeEmail.response.ok && String((dupeEmail.body as Record<string, unknown> | null)?.message ?? "").includes("already exists"),
    dupeEmail.body,
  );

  const dupeUserJar: CookieJar = new Map();
  const dupeUser = await signUp(
    playerPayload(`alex.rivera`, `fresh.${STAMP}@example.com`),
    dupeUserJar,
  );
  record(
    "duplicate username rejected",
    !dupeUser.response.ok && String((dupeUser.body as Record<string, unknown> | null)?.message ?? "").includes("username"),
    dupeUser.body,
  );

  // --- 6. middleware: signed-out workspace visit redirects to /login ---
  const anon: CookieJar = new Map();
  const anonPlayer = await visit("/player", anon);
  record(
    "signed-out /player redirects to /login",
    [301, 302, 303, 307, 308].includes(anonPlayer.status) &&
      (anonPlayer.headers.get("location") ?? "").includes("/login"),
    { status: anonPlayer.status, location: anonPlayer.headers.get("location") },
  );

  const anonOrganizer = await visit("/organizer", anon);
  record(
    "signed-out /organizer redirects to /login",
    [301, 302, 303, 307, 308].includes(anonOrganizer.status) &&
      (anonOrganizer.headers.get("location") ?? "").includes("/login"),
    { status: anonOrganizer.status, location: anonOrganizer.headers.get("location") },
  );

  // --- 7. signed-in player can load /player; /organizer refuses to render ---
  const playerHome = await visit("/player", playerJar);
  record(
    "signed-in player loads /player",
    playerHome.status === 200,
    { status: playerHome.status, location: playerHome.headers.get("location") },
  );

  // The layout throws Next's redirect() for a role mismatch. During streaming
  // that arrives inside the RSC payload rather than as a 3xx status, so the
  // real security property to assert is that no organizer workspace content
  // is composed into the response at all.
  const playerOnOrganizer = await visit("/organizer", playerJar);
  const organizerHtml = await playerOnOrganizer.text();
  const leaksWorkspace = /Event hub|Scorekeepers|Registration inbox|Harbor Pickleball/.test(organizerHtml);
  const carriesRedirect = organizerHtml.includes("NEXT_REDIRECT");
  record(
    "player gets no organizer content",
    !leaksWorkspace && (playerOnOrganizer.status !== 200 || carriesRedirect),
    { status: playerOnOrganizer.status, leaksWorkspace, carriesRedirect },
  );

  // --- 8. sign-out clears the session ---
  const outResponse = await fetch(`${BASE}/api/auth/sign-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN_HEADERS, Cookie: jarHeader(playerJar) },
    body: JSON.stringify({}),
  });
  storeCookies(playerJar, outResponse);
  const afterOut = await getSession(playerJar);
  record(
    "session cleared after sign-out",
    outResponse.ok && !afterOut.body?.user,
    { status: outResponse.status, body: afterOut.body },
  );

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
  console.log("Phase 2 verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
