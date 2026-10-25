// Event reads over Postgres.
//
// The catalogue (`events`) and the generated aggregate (`event_details`) are
// seeded from the same static modules the pages used to render from, so this
// mapper is the bridge between the two worlds: API consumers and the event
// pages both read the DB copy (Phase 6), while src/lib/event-detail.ts stays
// as the seed source and the type home. verify-phase4.ts asserts the two
// representations stay identical.

import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import type { EventItem, OpenTournament } from "@/types";
import { parseFinalScore } from "@/lib/game-results";
import { teamColor, poolSlotLabel, bracketFeedLabel, type Crew, type EventDetail, type MatchInfo, type Mvp, type PlayerStat, type PoolRow, type TeamInfo } from "@/lib/event-detail";
import { timeFromLabel, minutesFromTime, labelFromMinutes, SLOT_MINUTES } from "@/lib/schedule-config";
import { loadPool } from "@/server/pool";
import { loadGamesForTournament } from "@/server/schedule";

/**
 * The `events` columns as the EventItem wire shape, for API routes that join
 * events into another table's rows (registrations, announcements). Same
 * mapping as eventRowToItem, expressed as a drizzle selection instead of a
 * row transform.
 */
export const eventSelection = {
  slug: t.events.slug,
  name: t.events.name,
  start: t.events.startDate,
  end: t.events.endDate,
  city: t.events.city,
  country: t.events.country,
  code: t.events.code,
  tags: t.events.tags,
  status: t.events.status,
  featured: t.events.featured,
  live: t.events.live,
  teams: t.events.teamCount,
  color: t.events.color,
  monogram: t.events.monogram,
  hasLogo: t.events.hasLogo,
} as const;

/** `events` row → the EventItem shape every consumer already speaks. */
export function eventRowToItem(row: typeof t.events.$inferSelect): EventItem {
  return {
    slug: row.slug,
    name: row.name,
    start: row.startDate,
    end: row.endDate,
    city: row.city,
    country: row.country,
    code: row.code,
    tags: [...row.tags],
    status: row.status,
    featured: row.featured,
    live: row.live,
    teams: row.teamCount,
    color: row.color,
    monogram: row.monogram,
    hasLogo: row.hasLogo,
  };
}

/**
 * Loads the full EventDetail for a slug from the database, or null when the
 * event (or its detail row) is not seeded.
 */
export async function loadEventDetail(slug: string): Promise<EventDetail | null> {
  const [eventRow] = await db.select().from(t.events).where(eq(t.events.slug, slug)).limit(1);
  if (!eventRow) return null;

  const [detailRow] = await db
    .select()
    .from(t.eventDetails)
    .where(eq(t.eventDetails.eventId, slug))
    .limit(1);
  if (!detailRow) return null;

  const detail: EventDetail = {
    event: eventRowToItem(eventRow),
    about: detailRow.about,
    venue: {
      name: detailRow.venueName,
      address: detailRow.venueAddress,
      mapUrl: detailRow.venueMapUrl,
    },
    tz: { label: detailRow.tzLabel, offset: detailRow.tzOffset },
    hasResults: detailRow.hasResults,
    days: detailRow.days,
    fields: detailRow.fields,
    facts: detailRow.facts,
    announcements: [...detailRow.announcements],
    teams: detailRow.teams as unknown as TeamInfo[],
    matches: detailRow.matches as unknown as MatchInfo[],
    pools: detailRow.pools as unknown as Record<"A" | "B", PoolRow[]>,
    overall: detailRow.overall as unknown as PoolRow[],
    bracket: detailRow.bracket as unknown as MatchInfo[],
    players: detailRow.players as unknown as PlayerStat[],
    mvp: detailRow.mvp as unknown as Mvp[],
    crew: detailRow.crew as unknown as Crew[],
  };

  // A published event's detail row is written empty and never filled in, so
  // the workspace becomes the source for everything the seed left blank.
  if (detail.teams.length === 0 && detail.matches.length === 0) {
    await overlayFromWorkspace(detail, slug);
  }
  return detail;
}

/**
 * Lays the tournament workspace over a published event's placeholder detail
 * row: `publishTournamentEvent` writes `teams`, `matches`, `pools`, `overall`
 * and `crew` as empty arrays and nothing ever updates them, while the pool
 * table and the schedule keep growing in the organizer workspace. That split
 * is why the tab badge could read "Teams 2" above a "No teams listed yet"
 * panel — the badge reads `events.teamCount` (synced from the pool) and the
 * panel read the untouched array.
 *
 * Only fires when the row is still empty: a seeded detail row (the demo
 * fixtures) already carries its own teams, matches and results, and must keep
 * rendering exactly as stored.
 */
async function overlayFromWorkspace(detail: EventDetail, eventSlug: string): Promise<void> {
  const [tournament] = await db
    .select({ id: t.tournaments.id })
    .from(t.tournaments)
    .where(eq(t.tournaments.eventSlug, eventSlug))
    .limit(1);
  if (!tournament) return;

  const [pool, games, crewRows] = await Promise.all([
    loadPool(tournament.id),
    loadGamesForTournament(tournament.id),
    db
      .select({ scorekeeper: t.gameCrew.scorekeeper, umpire: t.gameCrew.umpire })
      .from(t.gameCrew)
      .innerJoin(t.games, eq(t.gameCrew.gameId, t.games.id))
      .where(eq(t.games.tournamentId, tournament.id)),
  ]);
  // Nothing drawn up yet — the row's own empty states describe it better than
  // a stack of zero-valued tables would.
  if (pool.length === 0 && games.length === 0) return;

  const teams: TeamInfo[] = pool.map((row) => ({
    name: row.name,
    pool: row.pool,
    seed: row.seed,
    // An entrant bridged from a signup is one player. A manually added or
    // CSV-imported team's roster is tracked nowhere, so it stays 0 and the
    // Teams tab omits the count instead of printing "0 players".
    roster: row.source === "signups" ? 1 : 0,
    // No sportsmanship scoring exists in the schema yet; 0 keeps the column
    // hidden rather than inventing a number.
    sportsmanship: 0,
    color: teamColor(row.name),
  }));
  const poolOf = new Map(teams.map((team) => [team.name, team.pool]));

  const matches: MatchInfo[] = games.map((game) => {
    const score = parseFinalScore(game.score);
    return {
      id: game.id,
      // `games` has no date column: the auto-filled draw runs from the
      // tournament's schedule start, on the event's opening day.
      date: detail.event.start,
      time: timeFromLabel(game.time) ?? "00:00",
      field: game.field,
      round: poolOf.has(game.teamA) ? `Pool ${poolOf.get(game.teamA)}` : "Pool play",
      a: game.teamA,
      b: game.teamB,
      sa: score?.[0] ?? null,
      sb: score?.[1] ?? null,
      status: game.status === "final" ? "final" : game.status === "live" ? "live" : "scheduled",
    };
  });

  const named = (value: string) => value.trim();
  const scorekeepers = [...new Set(crewRows.map((row) => named(row.scorekeeper)).filter(Boolean))];
  const umpires = [...new Set(crewRows.map((row) => named(row.umpire)).filter(Boolean))];

  const { pools, overall } = standingsOf(teams, matches);
  detail.teams = teams;
  detail.matches = matches;
  detail.pools = pools;
  detail.overall = overall;
  // The knockout rounds the pool table implies, right after the pool games —
  // display-only until the workspace can draw and score them for real.
  let lastSlot: number | null = null;
  for (const game of games) {
    const minutes = minutesFromTime(timeFromLabel(game.time) ?? "");
    if (minutes !== null) lastSlot = lastSlot === null ? minutes : Math.max(lastSlot, minutes);
  }
  detail.bracket = bracketOf({
    pools,
    matches,
    event: detail.event,
    // The knockout follows the last pool game; a draw with no games yet starts
    // where the auto-fill would have begun.
    slotTime: (afterMinutes) =>
      timeFromLabel(labelFromMinutes((lastSlot ?? minutesFromTime("09:00") ?? 540) + SLOT_MINUTES + afterMinutes)) ?? "10:30",
  });
  detail.crew = [
    { role: "Scorekeepers", people: scorekeepers },
    { role: "Umpires", people: umpires },
  ].filter((group) => group.people.length > 0);
  // Results unlock the standings section (and only that: sportsmanship, stats
  // and MVP stay out of the tab strip until something writes their rows).
  detail.hasResults =
    detail.hasResults ||
    matches.some((match) => match.status === "final" && match.sa !== null && match.sb !== null);
}

/**
 * W/L/PF/PA per entrant from the finished games, ranked the way the seeded
 * tables rank: wins first, then point difference, then points scored, then
 * seed. Games whose entrant has since left the pool are skipped rather than
 * throwing, and a game without a parseable score never counts as played.
 */
function standingsOf(teams: TeamInfo[], matches: MatchInfo[]): {
  pools: Record<"A" | "B", PoolRow[]>;
  overall: PoolRow[];
} {
  const rows = new Map(
    teams.map((team) => [team.name, { team: team.name, pool: team.pool, w: 0, l: 0, pf: 0, pa: 0 }]),
  );
  const seedOf = new Map(teams.map((team) => [team.name, team.seed]));

  for (const match of matches) {
    if (match.status !== "final" || match.sa === null || match.sb === null) continue;
    const a = rows.get(match.a);
    const b = rows.get(match.b);
    if (!a || !b) continue;
    a.pf += match.sa; a.pa += match.sb;
    b.pf += match.sb; b.pa += match.sa;
    if (match.sa > match.sb) { a.w++; b.l++; } else { b.w++; a.l++; }
  }

  const rank = (p: PoolRow, q: PoolRow) =>
    q.w - p.w ||
    (q.pf - q.pa) - (p.pf - p.pa) ||
    q.pf - p.pf ||
    (seedOf.get(p.team) ?? 0) - (seedOf.get(q.team) ?? 0);

  const overall = [...rows.values()].sort(rank);
  return {
    pools: {
      A: overall.filter((row) => row.pool === "A"),
      B: overall.filter((row) => row.pool === "B"),
    },
    overall,
  };
}

/**
 * The knockout a published event's pool table implies — the live counterpart
 * of the seed's bracket builder in src/lib/event-detail.ts.
 *
 * A published event's detail row stores `bracket: []`, the workspace schedule
 * only ever holds pool games, and nothing draws knockout games — so the
 * Bracket tab stayed frozen on "not drawn yet" above a pool table that
 * already implied the matchups. Derived here instead, the same way pools and
 * standings are recomputed on every load, so it follows the draw as it
 * happens without a write path of its own; these are display rows, not
 * scheduled games, and stay out of `matches`.
 *
 * Two pools of two or more see the classic draw: SF1 sends the top of pool A
 * against the runner-up of pool B, SF2 mirrors it, and the winners and losers
 * meet again in the final and the third-place match. A smaller draw (the
 * whole field in one pool, or one entrant per pool) leans straight into a
 * single final between the two best-placed entrants — semifinals would
 * halve a field that size.
 *
 * `pools` must be the ranked lists standingsOf returns (best first): the
 * ranks in these labels mean standings position, not seed order.
 *
 * Team names come from the standings the tabs already render, which double as
 * the seeding: the current order while pool play runs, the final table once
 * every scheduled game has a result. Until then the slots read as the places
 * they still stand for ("1st Pool A"), and the final's participants stay
 * "Winner SF1" placeholders even after pool play, because semifinal results
 * live nowhere the workspace can read.
 */
function bracketOf(input: {
  pools: Record<"A" | "B", PoolRow[]>;
  matches: MatchInfo[];
  event: EventItem;
  /** Time of a knockout round, `afterMinutes` past the first knockout slot. */
  slotTime: (afterMinutes: number) => string;
}): MatchInfo[] {
  const { pools, matches, event, slotTime } = input;
  if (pools.A.length + pools.B.length < 2) return [];

  // Pool play is decided once every scheduled game carries a result — the
  // ranking the tabs already show is then final, good enough to name teams.
  const settled = matches.length > 0 && matches.every((m) => m.status === "final" && m.sa !== null && m.sb !== null);

  const mk = (id: string, round: string, afterMinutes: number, field: string, a: string, b: string): MatchInfo => ({
    id,
    // Knockout day is the closing day; the pool games fill the days before.
    date: event.end,
    time: slotTime(afterMinutes),
    field,
    round,
    a,
    b,
    sa: null,
    sb: null,
    status: "scheduled",
  });
  /** The team that holds a slot, or the place it still stands for. */
  const name = (pool: "A" | "B", rank: number) =>
    (settled ? pools[pool][rank]?.team : undefined) ?? poolSlotLabel(rank as 0 | 1, pool);

  if (pools.A.length >= 2 && pools.B.length >= 2) {
    return [
      mk("br-sf1", "Semifinal", 0, "Court 1", name("A", 0), name("B", 1)),
      mk("br-sf2", "Semifinal", 0, "Court 2", name("B", 0), name("A", 1)),
      mk("br-third", "Third place", 2 * SLOT_MINUTES, "Court 2", bracketFeedLabel("Loser", 1), bracketFeedLabel("Loser", 2)),
      mk("br-final", "Final", 3 * SLOT_MINUTES, "Court 1", bracketFeedLabel("Winner", 1), bracketFeedLabel("Winner", 2)),
    ];
  }

  const finalists =
    pools.A.length >= 1 && pools.B.length >= 1
      ? [name("A", 0), name("B", 0)]
      : pools.A.length >= 2
        ? [name("A", 0), name("A", 1)]
        : [name("B", 0), name("B", 1)];
  return [mk("br-final", "Final", 0, "Court 1", finalists[0], finalists[1])];
}

/** Every event with its live registration count — the event hub list feed. */
export async function loadCatalogue() {
  const [eventRows, counts] = await Promise.all([
    db.select().from(t.events).orderBy(t.events.slug),
    db
      .select({ slug: t.registrations.eventSlug, count: sql<number>`count(*)::int` })
      .from(t.registrations)
      .groupBy(t.registrations.eventSlug),
  ]);
  const countBySlug = new Map(counts.map((c) => [c.slug, c.count]));
  return eventRows.map((row) => ({
    ...eventRowToItem(row),
    registrationCount: countBySlug.get(row.slug) ?? 0,
  }));
}

/** One event as the wire EventItem, or null when the slug is unknown. */
export async function loadEvent(slug: string): Promise<EventItem | null> {
  const [row] = await db.select().from(t.events).where(eq(t.events.slug, slug)).limit(1);
  return row ? eventRowToItem(row) : null;
}

/**
 * Player-facing "find tournaments" listings, soonest event first. The id is
 * the name slugified (seed logic), the FK points at the event the card's
 * "View & register" button opens.
 */
export async function loadOpenTournaments(): Promise<OpenTournament[]> {
  const rows = await db
    .select({
      name: t.openTournaments.name,
      meta: t.openTournaments.meta,
      fee: t.openTournaments.fee,
      spots: t.openTournaments.spots,
      slug: t.openTournaments.eventSlug,
      startDate: t.events.startDate,
    })
    .from(t.openTournaments)
    .leftJoin(t.events, eq(t.openTournaments.eventSlug, t.events.slug))
    // ASC puts NULLs last: listings without an event follow the dated ones.
    .orderBy(asc(t.events.startDate));
  return rows.map((row) => ({
    name: row.name,
    meta: row.meta,
    fee: row.fee,
    spots: row.spots,
    slug: row.slug ?? undefined,
  }));
}

/** Does the event exist? Cheap guard shared by the registration routes. */
export async function eventExists(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ slug: t.events.slug })
    .from(t.events)
    .where(eq(t.events.slug, slug))
    .limit(1);
  return Boolean(row);
}
