/**
 * Phase 6 verification: exercises the DB-swapped event pages and the realtime
 * stream against a running server (`npm run dev` or `npm run start` on port
 * 3000) plus the client subscription logic (no browser needed).
 *
 * Covers: the public event page rendering from Postgres (mutate a row, watch
 * the HTML follow, restore), the 404 for unknown slugs, the SSE endpoint
 * (content-type, hello frame, and one named event per published topic —
 * results, announcements, registrations, crew, schedule — all on a single
 * open stream), and the client's polling fallback when EventSource is
 * unavailable or the connection dies.
 *
 * End state: the event name/about are restored, the test announcement is
 * deleted, the player's registration is removed, and g1 keeps its seeded crew
 * names and mock score (11-8) and schedule start.
 *
 * Usage:  npm run start         (in one shell)
 *         npx tsx src/scripts/verify-phase6.ts
 */

import { eq } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";
import { keepers } from "../lib/mock-data";
import { subscribeLive } from "../lib/realtime";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "sidelines-demo";
const SLUG = "harbor-spring-open";
const GAME_ID = "g1";
const ANN_TITLE = "PH6 stream announcement";

// Sentinels are HTML-safe and unique enough to never collide with real copy.
const SENTINEL_NAME = "PH6 DB Swap Proof";
const SENTINEL_ABOUT = "PH6-DB-SWAP-PROOF about text";

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

async function pageHtml(route: string): Promise<{ status: number; html: string }> {
  const response = await fetch(`${BASE}${route}`);
  return { status: response.status, html: await response.text() };
}

/** A live SSE connection whose accumulated text the assertions read. */
type StreamCapture = {
  contentType: string | null;
  waitFor: (needle: string, timeoutMs?: number) => Promise<boolean>;
  text: () => string;
  abort: () => void;
};

async function openStream(): Promise<StreamCapture | null> {
  const controller = new AbortController();
  const response = await fetch(`${BASE}/api/stream`, {
    headers: { Accept: "text/event-stream" },
    signal: controller.signal,
  });
  if (!response.ok || !response.body) {
    controller.abort();
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // Drains the connection in the background until abort() ends it.
  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
    } catch {
      /* aborted - expected during cleanup */
    }
  })();

  return {
    contentType: response.headers.get("content-type"),
    text: () => buffer,
    waitFor: async (needle, timeoutMs = 6000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (buffer.includes(needle)) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return buffer.includes(needle);
    },
    abort: () => controller.abort(),
  };
}

// ---- fakes for the client-side subscription tests --------------------------

/** EventSource stand-in the harness scripts: stays open until closed. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readyState = 1; // OPEN
  onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, (() => void)[]>();
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close() {
    this.closed = true;
    this.readyState = 2; // CLOSED
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

/** EventSource stand-in that dies right after connecting. */
class DyingEventSource {
  readyState = 2; // CLOSED
  onerror: ((event: Event) => void) | null = null;
  constructor(_url: string) {
    // Fires after the subscriber has assigned its onerror handler.
    setTimeout(() => this.onerror?.(new Event("error")), 0);
  }
  addEventListener() {
    /* never delivers - the connection is dead */
  }
  close() {
    this.readyState = 2;
  }
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

  // ============ event pages read the database ============

  const [eventRow] = await db.select().from(t.events).where(eq(t.events.slug, SLUG)).limit(1);
  const [detailRow] = await db
    .select()
    .from(t.eventDetails)
    .where(eq(t.eventDetails.eventId, SLUG))
    .limit(1);
  if (!eventRow || !detailRow) {
    console.error(`FATAL: ${SLUG} is not seeded - run npm run db:seed first.`);
    process.exit(1);
  }
  const originalName = eventRow.name;
  const originalAbout = detailRow.about;

  const before = await pageHtml(`/events/${SLUG}`);
  record(
    "event page renders the seeded row before the swap",
    before.status === 200 && before.html.includes(originalAbout),
    { status: before.status },
  );

  // --- 1. mutate the DB: the page must follow (it renders from Postgres) ---
  try {
    await db.update(t.events).set({ name: SENTINEL_NAME }).where(eq(t.events.slug, SLUG));
    await db
      .update(t.eventDetails)
      .set({ about: SENTINEL_ABOUT })
      .where(eq(t.eventDetails.eventId, SLUG));

    const mutated = await pageHtml(`/events/${SLUG}`);
    record(
      "page HTML follows a database mutation (name in <title>, about in body)",
      mutated.status === 200 &&
        mutated.html.includes(SENTINEL_ABOUT) &&
        mutated.html.includes(`<title>${SENTINEL_NAME}`),
      { status: mutated.status, about: mutated.html.includes(SENTINEL_ABOUT), title: mutated.html.includes(`<title>${SENTINEL_NAME}`) },
    );

    const hub = await pageHtml(`/organizer/events/${SLUG}`);
    record(
      "organizer hub route renders (organizer-gated shell, DB detail)",
      hub.status === 200,
      hub.status,
    );
  } finally {
    await db.update(t.events).set({ name: originalName }).where(eq(t.events.slug, SLUG));
    await db
      .update(t.eventDetails)
      .set({ about: originalAbout })
      .where(eq(t.eventDetails.eventId, SLUG));
  }

  // --- 2. restored row renders back, sentinel gone ---
  const restored = await pageHtml(`/events/${SLUG}`);
  record(
    "restored database row renders back, sentinel gone",
    restored.status === 200 &&
      restored.html.includes(originalAbout) &&
      !restored.html.includes(SENTINEL_ABOUT) &&
      restored.html.includes(`<title>${originalName}`),
    { status: restored.status, sentinelLeft: restored.html.includes(SENTINEL_ABOUT) },
  );

  // --- 3. unknown slug renders the 404 UI, not an event page ---
  // App Router streams the shell (200) before the page's notFound() lands, so
  // the status can be 200 with the not-found UI inside - that is the app's
  // long-standing behaviour (same as the redirect-during-streaming note in
  // src/middleware.ts). What matters: the 404 UI shows and no event page does.
  const bogus = await pageHtml("/events/ph6-no-such-event");
  record(
    "unknown event slug renders the 404 UI, no event page content",
    (bogus.status === 200 || bogus.status === 404) &&
      bogus.html.includes("This page could not be found") &&
      !bogus.html.includes("event-detail-page"),
    { status: bogus.status, notFoundUi: bogus.html.includes("This page could not be found") },
  );

  // ============ the realtime stream ============

  // Pre-clean so the publishes we assert on are the ones we trigger.
  await api(player, "DELETE", `/api/events/${SLUG}/registrations`);

  const stream = await openStream();
  record(
    "GET /api/stream opens an event-stream",
    stream !== null && (stream.contentType ?? "").includes("text/event-stream"),
    stream?.contentType ?? "no stream",
  );

  if (stream) {
    record(
      "stream greets with retry + hello before any mutation",
      await stream.waitFor("retry: 3000") && await stream.waitFor("event: hello"),
      stream.text().slice(0, 120),
    );

    // --- results: an organizer submitting a final score ---
    const result = await api(org, "POST", `/api/score/games/${GAME_ID}`, { score: "11-8" });
    record(
      "result submit accepted (same seeded score)",
      result.ok,
      result.status,
    );
    record("publishes a results frame", await stream.waitFor("event: results"), stream.text().includes("event: results"));

    // --- crew: saving g1's seeded names publishes, end state unchanged ---
    const g1Keeper = keepers.find((k) => k.gameId === GAME_ID && k.role === "Scorer")?.name ?? "Maya Reyes";
    const g1Umpire = keepers.find((k) => k.gameId === GAME_ID && k.role === "Umpire")?.name ?? "Jon Park";
    const crew = await api(org, "PUT", `/api/score/games/${GAME_ID}/crew`, {
      scorekeeper: g1Keeper,
      umpire: g1Umpire,
    });
    record("crew save accepted", crew.ok, crew.status);
    record("publishes a crew frame", await stream.waitFor("event: crew"), stream.text().includes("event: crew"));

    // --- schedule: re-setting the current start publishes, end state unchanged ---
    const live = (await (await api(org, "GET", "/api/tournaments/live")).json()) as {
      tournament?: { scheduleStart?: string };
    };
    const schedule = await api(org, "PUT", "/api/tournaments/live", {
      scheduleStart: live.tournament?.scheduleStart ?? "09:00",
    });
    record("schedule-start re-set accepted", schedule.ok, schedule.status);
    record("publishes a schedule frame", await stream.waitFor("event: schedule"), stream.text().includes("event: schedule"));

    // --- registrations: the player registering ---
    const registration = await api(player, "POST", `/api/events/${SLUG}/registrations`);
    record("registration accepted", registration.ok, registration.status);
    record(
      "publishes a registrations frame",
      await stream.waitFor("event: registrations"),
      stream.text().includes("event: registrations"),
    );

    // --- announcements: the organizer publishing ---
    const announcement = (await (
      await api(org, "POST", "/api/announcements", {
        slug: SLUG,
        title: ANN_TITLE,
        body: "Phase 6 stream check.",
      })
    ).json()) as { announcement?: { id?: string } };
    record(
      "announcement accepted",
      Boolean(announcement.announcement?.id),
      announcement.announcement?.id ?? "no id",
    );
    record(
      "publishes an announcements frame on the same open stream",
      await stream.waitFor("event: announcements"),
      stream.text().includes("event: announcements"),
    );

    // Cleanup: delete the announcement, unregister the player.
    if (announcement.announcement?.id) {
      await api(org, "DELETE", `/api/announcements/${announcement.announcement.id}`);
    }
    await api(player, "DELETE", `/api/events/${SLUG}/registrations`);

    stream.abort();
  }

  // ============ client polling fallback ============

  // --- 1. a healthy EventSource routes named events to the callback ---
  FakeEventSource.instances = [];
  const seen: string[] = [];
  const stopHealthy = subscribeLive(["results", "announcements"], (topic) => seen.push(topic), {
    EventSourceImpl: FakeEventSource as unknown as new (url: string) => EventSource,
    pollMs: 10_000,
  });
  const source = FakeEventSource.instances[0];
  source?.emit("results");
  source?.emit("announcements");
  source?.emit("crew"); // not subscribed - must be ignored
  record(
    "healthy stream delivers subscribed topics only",
    seen.includes("results") && seen.includes("announcements") && !seen.includes("crew"),
    seen,
  );
  stopHealthy();
  source?.emit("results");
  record(
    "unsubscribe closes the stream and stops delivery",
    source?.closed === true && seen.filter((x) => x === "results").length === 1,
    { closed: source?.closed, results: seen.filter((x) => x === "results").length },
  );

  // --- 2. a dead connection falls back to polling on the interval ---
  const polled: string[] = [];
  const stopDying = subscribeLive(["results"], (topic) => polled.push(topic), {
    EventSourceImpl: DyingEventSource as unknown as new (url: string) => EventSource,
    pollMs: 120,
  });
  await new Promise((resolve) => setTimeout(resolve, 420));
  const pollsWhileOpen = polled.length;
  stopDying();
  await new Promise((resolve) => setTimeout(resolve, 300));
  record(
    "dead connection falls back to polling, and cleanup stops it",
    pollsWhileOpen >= 2 && polled.length === pollsWhileOpen,
    { pollsWhileOpen, pollsAfterCleanup: polled.length },
  );

  // --- 3. no EventSource at all (SSR/old browser) polls immediately ---
  const immediate: string[] = [];
  const stopNoEs = subscribeLive(["announcements"], (topic) => immediate.push(topic), {
    EventSourceImpl: null,
    pollMs: 60_000,
  });
  record(
    "missing EventSource polls immediately",
    immediate.length === 1 && immediate[0] === "announcements",
    immediate,
  );
  stopNoEs();

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
  console.error("verify-phase6 crashed:", error);
  process.exit(1);
});
