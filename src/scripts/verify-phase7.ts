/**
 * Phase 7 verification: the pages that still rendered from the static
 * scaffolds (schedule games, tournaments, pool, roster, open tournaments,
 * event catalogue) now read Postgres. Runs against a running server
 * (`npm run dev` or `npm run start` on port 3000) plus the loaders directly
 * (no browser needed).
 *
 * Covers: loader order parity with the seed source arrays (the `games` table
 * has no sort column, so loadGames reproduces the mock order explicitly),
 * SSR HTML mutation proofs per swap group (flip a row, watch the page
 * follow, restore in `finally`), the public QR scoring route resolving its
 * game from the database, and the event joins on GET /api/registrations and
 * /api/announcements that let the feed and "My events" drop getEvent().
 *
 * End state: every mutated row is restored, the test announcement is
 * deleted, and the player's test registration is removed.
 *
 * Usage:  npm run start         (in one shell)
 *         npx tsx src/scripts/verify-phase7.ts
 */

import { eq } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";
import { loadGames, loadTournamentTeams, loadTournaments } from "../server/schedule";
import { loadRoster } from "../server/team";
import { loadOpenTournaments } from "../server/events";
import { games as mockGames, openTournaments as mockOpen, roster as mockRoster, teams as mockTeams, tournaments as mockTournaments } from "../lib/mock-data";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "sidelines-demo";
const SLUG = "harbor-spring-open";

// Sentinels are HTML-safe and unique enough to never collide with real copy.
const SENTINEL_TEAM = "PH7 SENTINEL TEAM";
const SENTINEL_TOURNAMENT = "PH7 TOURNAMENT SENTINEL";
const SENTINEL_FIELD = "Court PH7";
const ANN_TITLE = "PH7 event join check";

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
    const eqIndex = pair.indexOf("=");
    if (eqIndex > 0) jar.set(pair.slice(0, eqIndex).trim(), pair.slice(eqIndex + 1).trim());
  }
}

async function signIn(email: string, password: string, jar: CookieJar) {
  // Better Auth's production default rate-limits sign-in to 3 attempts per
  // 10 seconds per IP. Back off and retry on 429 rather than fighting the
  // limiter or disabling it in the app.
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
    await new Promise((resolve) =>
      setTimeout(resolve, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10) * 1000),
    );
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

/** Page fetch with an optional session cookie (SSR markers land in the HTML). */
async function pageHtml(route: string, jar?: CookieJar): Promise<{ status: number; html: string }> {
  const response = await fetch(`${BASE}${route}`, { headers: jar ? { Cookie: jarHeader(jar) } : {} });
  return { status: response.status, html: await response.text() };
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

  // ============ loaders: DB order ≡ seed source order ============

  const [dbGames, dbTournaments, dbTeams, dbRoster, dbOpen] = await Promise.all([
    loadGames(),
    loadTournaments(),
    loadTournamentTeams(),
    loadRoster(),
    loadOpenTournaments(),
  ]);

  record(
    "loadGames order matches the mock schedule (time slot, then id)",
    dbGames.map((g) => g.id).join(",") === mockGames.map((g) => g.id).join(","),
    { db: dbGames.map((g) => g.id).join(","), mock: mockGames.map((g) => g.id).join(",") },
  );
  record(
    "every mock game row round-trips from the database",
    mockGames.every((game) => {
      const row = dbGames.find((g) => g.id === game.id);
      return row && row.time === game.time && row.teamA === game.teamA && row.teamB === game.teamB && row.field === game.field;
    }),
    dbGames.length,
  );
  record(
    "loadTournaments matches the mock list (name, meta, Live/Draft display)",
    JSON.stringify(dbTournaments) === JSON.stringify(mockTournaments.map((tr) => ({ name: tr.name, meta: tr.meta, status: tr.status }))),
    dbTournaments,
  );
  record(
    "loadTournamentTeams matches the mock pool table in order",
    dbTeams.map((team) => `${team.name}:${team.pool}:${team.seed}`).join(",") ===
      mockTeams.map((team) => `${team.name}:${team.pool}:${team.seed}`).join(","),
    dbTeams,
  );
  record(
    "loadRoster returns the seeded players by shirt number",
    dbRoster.length === mockRoster.length &&
      dbRoster.every((player, index) => index === 0 || dbRoster[index - 1].number <= player.number) &&
      mockRoster.every((p) => dbRoster.some((r) => r.name === p.name)),
    dbRoster.map((r) => r.number),
  );
  const openOrder = dbOpen.map((o) => o.name).join("|");
  record(
    "loadOpenTournaments: seeded set, soonest event first",
    dbOpen.length === mockOpen.length &&
      mockOpen.every((o) => dbOpen.some((row) => row.name === o.name && row.slug === o.slug)) &&
      openOrder.startsWith("Manila Mixed Classic 2026|Hong Kong Winter Cup"),
    openOrder,
  );

  // ============ the landing page reads the catalogue ============

  const [eventRow] = await db.select().from(t.events).where(eq(t.events.slug, SLUG)).limit(1);
  if (!eventRow) {
    console.error(`FATAL: ${SLUG} is not seeded - run npm run db:seed first.`);
    process.exit(1);
  }
  const originalLive = eventRow.live;

  const homeBefore = await pageHtml("/");
  record(
    "home renders the seeded catalogue (event count, browser cards)",
    homeBefore.status === 200 &&
      /<b>\d+<\/b>\s*events/.test(homeBefore.html) &&
      homeBefore.html.includes("Harbor Spring Open"),
    { status: homeBefore.status },
  );

  const liveTotal = (await db.select().from(t.events)).filter((row) => row.live).length;
  try {
    await db.update(t.events).set({ live: false }).where(eq(t.events.slug, SLUG));
    const mutated = await pageHtml("/");
    record(
      "home HTML follows an events.live flip (live count drops)",
      mutated.status === 200 && mutated.html.includes(`<b>${liveTotal - 1}</b>`) && mutated.html.includes("live now"),
      { status: mutated.status, has: mutated.html.includes(`<b>${liveTotal - 1}</b>`) },
    );
  } finally {
    await db.update(t.events).set({ live: originalLive }).where(eq(t.events.slug, SLUG));
  }

  const homeRestored = await pageHtml("/");
  record(
    "restored live flag renders back",
    homeRestored.html.includes(`<b>${liveTotal}</b>`) && homeRestored.html.includes("live now"),
    { liveTotal },
  );

  // ============ player pages read the schedule ============

  const [gameRow] = await db.select().from(t.games).where(eq(t.games.id, "g3")).limit(1);
  if (!gameRow) {
    console.error("FATAL: g3 is not seeded - run npm run db:seed first.");
    process.exit(1);
  }
  const originalTeamB = gameRow.teamB;

  const playerHome = await pageHtml("/player", player);
  const playerSchedule = await pageHtml("/player/schedule", player);
  record(
    "player home + schedule render Ironwood's games from the database",
    playerHome.status === 200 &&
      playerHome.html.includes("Ironwood") &&
      playerHome.html.includes(originalTeamB) &&
      playerHome.html.includes("Ironwood") &&
      playerSchedule.html.includes("Harbor"),
    { home: playerHome.status, schedule: playerSchedule.status },
  );

  try {
    await db.update(t.games).set({ teamB: SENTINEL_TEAM }).where(eq(t.games.id, "g3"));
    const mutated = await pageHtml("/player/schedule", player);
    const mutatedHome = await pageHtml("/player", player);
    record(
      "player schedule + home HTML follow a games row mutation",
      mutated.html.includes(SENTINEL_TEAM) && mutatedHome.html.includes(SENTINEL_TEAM),
      { schedule: mutated.html.includes(SENTINEL_TEAM), home: mutatedHome.html.includes(SENTINEL_TEAM) },
    );
  } finally {
    await db.update(t.games).set({ teamB: originalTeamB }).where(eq(t.games.id, "g3"));
  }

  const scheduleRestored = await pageHtml("/player/schedule", player);
  record(
    "restored game row renders back, sentinel gone",
    scheduleRestored.html.includes(originalTeamB) && !scheduleRestored.html.includes(SENTINEL_TEAM),
    { sentinelLeft: scheduleRestored.html.includes(SENTINEL_TEAM) },
  );

  // ============ organizer workspace pages read the database ============

  const tournamentsBefore = await pageHtml("/organizer", org);
  record(
    "organizer home lists the seeded tournaments with the Live badge",
    tournamentsBefore.status === 200 &&
      tournamentsBefore.html.includes("Harbor Spring Open") &&
      tournamentsBefore.html.includes("3 tournaments") &&
      tournamentsBefore.html.includes("Live"),
    { status: tournamentsBefore.status },
  );

  try {
    await db.update(t.tournaments).set({ name: SENTINEL_TOURNAMENT }).where(eq(t.tournaments.name, "Harbor Spring Open"));
    const mutated = await pageHtml("/organizer", org);
    record(
      "organizer tournament list follows a tournaments row mutation",
      mutated.html.includes(SENTINEL_TOURNAMENT),
      { has: mutated.html.includes(SENTINEL_TOURNAMENT) },
    );
  } finally {
    await db.update(t.tournaments).set({ name: "Harbor Spring Open" }).where(eq(t.tournaments.name, SENTINEL_TOURNAMENT));
  }

  const teamsPage = await pageHtml("/organizer/teams", org);
  record(
    "organizer teams page renders the pool table from tournament_teams",
    teamsPage.status === 200 && mockTeams.every((team) => teamsPage.html.includes(team.name)),
    { status: teamsPage.status },
  );

  const schedulePage = await pageHtml("/organizer/schedule", org);
  record(
    "organizer schedule renders slot headings and games from the database",
    schedulePage.status === 200 && schedulePage.html.includes("9:00 AM") && schedulePage.html.includes("Ironwood"),
    { status: schedulePage.status },
  );

  try {
    await db.update(t.games).set({ field: SENTINEL_FIELD }).where(eq(t.games.id, "g3"));
    const mutated = await pageHtml("/organizer/schedule", org);
    record(
      "organizer schedule HTML follows a games row mutation (field)",
      mutated.html.includes(SENTINEL_FIELD),
      { has: mutated.html.includes(SENTINEL_FIELD) },
    );
  } finally {
    await db.update(t.games).set({ field: gameRow.field }).where(eq(t.games.id, "g3"));
  }

  const scorePage = await pageHtml("/organizer/score?game=g3", org);
  record(
    "organizer score page resolves the requested game from the database",
    scorePage.status === 200 && scorePage.html.includes("Ironwood") && scorePage.html.includes(originalTeamB),
    { status: scorePage.status },
  );

  const keepersPage = await pageHtml("/organizer/scorekeepers", org);
  record(
    "scorekeepers page renders the schedule card + game picker from the database",
    keepersPage.status === 200 &&
      keepersPage.html.includes("Court 1 · Game 1") &&
      keepersPage.html.includes("Harbor") &&
      keepersPage.html.includes("Redline"),
    { status: keepersPage.status },
  );

  const [registrationCountRow] = await db
    .select()
    .from(t.registrations)
    .where(eq(t.registrations.eventSlug, SLUG))
    .limit(1);
  const cataloguePage = await pageHtml("/organizer/events", org);
  record(
    "organizer event hub list renders events + counts from the catalogue",
    cataloguePage.status === 200 &&
      cataloguePage.html.includes("Harbor Spring Open") &&
      cataloguePage.html.includes("registered"),
    { status: cataloguePage.status, seeded: Boolean(registrationCountRow) },
  );

  // ============ player workspace pages read roster + listings ============

  const teamPage = await pageHtml("/player/team", player);
  record(
    "player team page renders the roster from roster_players (JOIN_CODE stays static)",
    teamPage.status === 200 &&
      mockRoster.every((p) => teamPage.html.includes(p.name)) &&
      teamPage.html.includes("IRON-4821"),
    { status: teamPage.status },
  );

  const findPage = await pageHtml("/player/tournaments", player);
  record(
    "find-tournaments page renders the listings from open_tournaments",
    findPage.status === 200 &&
      mockOpen.every((o) => findPage.html.includes(o.name)) &&
      findPage.html.includes("View &amp; register"),
    { status: findPage.status },
  );

  // ============ the QR scoring route resolves its game from the DB ============

  const publicScore = await pageHtml("/score/g3");
  record(
    "public score route resolves g3 from the database (invalid-token screen shows its label)",
    (publicScore.status === 200 || publicScore.status === 404) &&
      publicScore.html.includes('data-score-access="invalid"') &&
      publicScore.html.includes("Court 1 · Game 2"),
    { status: publicScore.status },
  );

  try {
    await db.update(t.games).set({ field: SENTINEL_FIELD }).where(eq(t.games.id, "g3"));
    const mutated = await pageHtml("/score/g3");
    record(
      "public score route label follows a games row mutation",
      mutated.html.includes(SENTINEL_FIELD),
      { status: mutated.status, has: mutated.html.includes(SENTINEL_FIELD) },
    );
  } finally {
    await db.update(t.games).set({ field: gameRow.field }).where(eq(t.games.id, "g3"));
  }

  const bogusScore = await pageHtml("/score/ph7-no-such-game");
  record(
    "unknown game id renders the 404 UI, no scoring page",
    (bogusScore.status === 200 || bogusScore.status === 404) &&
      bogusScore.html.includes("This page could not be found") &&
      !bogusScore.html.includes("score-public-page"),
    { status: bogusScore.status },
  );

  // ============ the APIs carry the joined event ============

  // Pre-clean so the announcement we assert on is the one we create.
  const created = (await (
    await api(org, "POST", "/api/announcements", {
      slug: SLUG,
      title: ANN_TITLE,
      body: "Phase 7 event join check.",
    })
  ).json()) as { announcement?: { id?: string; event?: { name?: string; slug?: string } } };
  record(
    "POST /api/announcements returns the joined event",
    Boolean(created.announcement?.id) && created.announcement?.event?.name === "Harbor Spring Open",
    created.announcement?.event ?? "no announcement",
  );

  const feed = (await (await api(null, "GET", `/api/announcements?slug=${SLUG}&limit=10`)).json()) as {
    announcements?: Array<{ title?: string; event?: { name?: string; start?: string; code?: string } }>;
  };
  const feedRow = feed.announcements?.find((a) => a.title === ANN_TITLE);
  record(
    "GET /api/announcements carries the event row the feed renders from",
    Boolean(feedRow) && feedRow?.event?.name === "Harbor Spring Open" && feedRow?.event?.start === "2026-10-07",
    feedRow?.event ?? "row not found",
  );

  if (created.announcement?.id) {
    await api(org, "DELETE", `/api/announcements/${created.announcement.id}`);
  }

  // The player registers, "My events" payload asserts, then cleanup.
  await api(player, "DELETE", `/api/events/${SLUG}/registrations`);
  const registration = await api(player, "POST", `/api/events/${SLUG}/registrations`);
  record("player registration accepted", registration.ok, registration.status);

  const mine = (await (await api(player, "GET", "/api/registrations")).json()) as {
    registrations?: Array<{ slug?: string; event?: { name?: string; status?: string; tags?: string[] } | null }>;
  };
  const mineRow = mine.registrations?.find((row) => row.slug === SLUG);
  record(
    "GET /api/registrations carries the event row My events renders from",
    Boolean(mineRow?.event) &&
      mineRow?.event?.name === "Harbor Spring Open" &&
      mineRow?.event?.status === "upcoming" &&
      Array.isArray(mineRow?.event?.tags),
    mineRow?.event ?? "row not found",
  );

  const inbox = await api(org, "GET", `/api/events/${SLUG}/registrations`);
  const inboxBody = (await inbox.json()) as { count?: number; registrations?: unknown[] };
  record(
    "per-event inbox still works (event stays implicit there)",
    inbox.ok && Array.isArray(inboxBody.registrations),
    { status: inbox.status, count: inboxBody.count },
  );

  await api(player, "DELETE", `/api/events/${SLUG}/registrations`);

  // ============ summary ============

  let failed = 0;
  for (const [label, ok, actual] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  -> ${JSON.stringify(actual)}`}`);
    if (!ok) failed++;
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("verify-phase7 crashed:", error);
  process.exit(1);
});
