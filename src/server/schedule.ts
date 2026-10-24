// Tournament workspace reads over Postgres (Phase 7).
//
// The tables are seeded from src/lib/mock-data.ts — the same module the
// pages used to render from — so this module is the bridge, the way
// server/events.ts is for events-data.ts: it returns the exact shapes those
// pages spoke (Game, Team, Tournament) in the display order their static
// arrays had. The `games` table has no sort column, so loadGames reproduces
// the seed order explicitly and verify-phase7.ts asserts DB order ≡ mock
// order, the same way verify-phase4 asserts detail parity.

import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { loadLiveTournament, loadPool, type PoolTeamRow } from "@/server/pool";
import { DEFAULT_START_TIME, labelFromMinutes, minutesFromTime } from "@/lib/schedule-config";
import type { Game, Team, Tournament } from "@/types";

/** "9:00 AM" → minutes since midnight; null for labels this does not parse. */
function minutesFromLabel(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})\s(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12 || minutes > 59) return null;
  if (match[3].toUpperCase() === "AM") hours = hours === 12 ? 0 : hours;
  else hours = hours === 12 ? 12 : hours + 12;
  return hours * 60 + minutes;
}

/** Numeric rank of a game id ("g10" → 10); ids without digits sort last. */
function idRank(id: string): number {
  const digits = id.match(/\d+/g)?.join("");
  const value = Number(digits);
  return digits && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

/** The seed source's array order: chronological slots, ids ascending within. */
function byScheduleOrder(a: Game, b: Game): number {
  const am = minutesFromLabel(a.time) ?? Number.MAX_SAFE_INTEGER;
  const bm = minutesFromLabel(b.time) ?? Number.MAX_SAFE_INTEGER;
  if (am !== bm) return am - bm;
  const rank = idRank(a.id) - idRank(b.id);
  return rank !== 0 ? rank : a.id.localeCompare(b.id);
}

/** `games` row → the Game shape the schedule pages speak (columns are 1:1). */
function gameRowToItem(row: typeof t.games.$inferSelect): Game {
  return {
    id: row.id,
    field: row.field,
    time: row.time,
    teamA: row.teamA,
    teamB: row.teamB,
    score: row.score,
    status: row.status,
    division: row.division,
    tier: row.tier,
  };
}

/**
 * Every game of the live tournament's schedule, in display order. Consumers
 * depend on it: applyScheduleStartTime derives the shift from schedule[0],
 * per-field game numbers count in array order, and the grids render slot
 * groups in first-appearance order.
 *
 * Scoped to the one live tournament, the same way loadTournamentTeams scopes
 * the pool table. `games` is global and only cascades when a tournament row
 * is deleted, so demoting a tournament to draft (making another one live)
 * leaves its games behind — without this filter every schedule surface mixed
 * the stale tournament's matches into the live one's draw. No live
 * tournament reads as an empty schedule, which is what the pages' empty
 * states already describe.
 */
export async function loadGames(): Promise<Game[]> {
  const rows = await db
    .select({ game: t.games })
    .from(t.games)
    .innerJoin(t.tournaments, eq(t.games.tournamentId, t.tournaments.id))
    .where(eq(t.tournaments.status, "live"));
  return rows.map(({ game }) => gameRowToItem(game)).sort(byScheduleOrder);
}

/**
 * One tournament's own schedule, in the same display order as loadGames.
 *
 * The workspace scopes everything to the single live tournament, but the
 * public event page addresses its event's tournament directly (a draft keeps
 * publishing its event), so the page needs a scoped read rather than the
 * workspace's implicit "whichever tournament is live".
 */
export async function loadGamesForTournament(tournamentId: string): Promise<Game[]> {
  const rows = await db
    .select({ game: t.games })
    .from(t.games)
    .where(eq(t.games.tournamentId, tournamentId));
  return rows.map(({ game }) => gameRowToItem(game)).sort(byScheduleOrder);
}

/** A tournament as the dashboard lists it: the display fields plus the id the status action needs. */
export type TournamentListItem = Tournament & {
  id: string;
  scheduleStart: string;
  /** Its event's homepage-Spotlight flag; null while a draft has no event. */
  featured: boolean;
  /** The published event this tournament drives; null while it is a draft. */
  eventSlug: string | null;
};

/**
 * Every tournament, live first, then by name. `name`/`meta`/`Live|Draft` are
 * what the old mock list carried; `id` and `scheduleStart` ride along so the
 * dashboard can flip a tournament's status.
 *
 * Joins the published event for the Spotlight flag — it lives on `events`,
 * not on the tournament, so the toggle can show its current state. A draft
 * has no event, hence the left join and the false fallback.
 */
export async function loadTournaments(): Promise<TournamentListItem[]> {
  const rows = await db
    .select({
      id: t.tournaments.id,
      name: t.tournaments.name,
      meta: t.tournaments.meta,
      status: t.tournaments.status,
      scheduleStart: t.tournaments.scheduleStart,
      eventSlug: t.tournaments.eventSlug,
      featured: t.events.featured,
    })
    .from(t.tournaments)
    .leftJoin(t.events, eq(t.tournaments.eventSlug, t.events.slug))
    // Enum ASC follows definition order, so "live" precedes "draft".
    .orderBy(asc(t.tournaments.status), asc(t.tournaments.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    meta: row.meta,
    status: row.status === "live" ? "Live" : "Draft",
    scheduleStart: row.scheduleStart,
    eventSlug: row.eventSlug,
    featured: row.featured ?? false,
  }));
}

/** Pool table of the single live tournament: pool A first, seeds ascending. */
export async function loadTournamentTeams(): Promise<Team[]> {
  return db
    .select({
      name: t.tournamentTeams.name,
      pool: t.tournamentTeams.pool,
      seed: t.tournamentTeams.seed,
    })
    .from(t.tournamentTeams)
    .innerJoin(t.tournaments, eq(t.tournamentTeams.tournamentId, t.tournaments.id))
    .where(eq(t.tournaments.status, "live"))
    .orderBy(asc(t.tournamentTeams.pool), asc(t.tournamentTeams.seed));
}

/**
 * The pool table plus the context the Teams view needs to act on it: which
 * tournament the pool belongs to, the event it publishes (the signups bridge
 * reads that event's registrations), and how many signups exist so the view
 * can offer "build pool from signups" only when there is something to build.
 */
export async function loadPoolView(): Promise<{
  teams: PoolTeamRow[];
  tournament: { id: string; name: string } | null;
  eventSlug: string | null;
  signupCount: number;
}> {
  const live = await loadLiveTournament();
  if (!live) return { teams: [], tournament: null, eventSlug: null, signupCount: 0 };

  const [teams, signupCount] = await Promise.all([
    loadPool(live.id),
    live.eventSlug
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(t.registrations)
          .where(eq(t.registrations.eventSlug, live.eventSlug))
          .then(([row]) => row?.count ?? 0)
      : Promise.resolve(0),
  ]);

  return {
    teams,
    tournament: { id: live.id, name: live.name },
    eventSlug: live.eventSlug,
    signupCount,
  };
}

// ---------- auto-fill (Schedule → "Auto-fill schedule") ----------

/** Minutes between slots — the spacing the seeded schedule uses (9:00, 10:30…). */
const SLOT_MINUTES = 90;

/** A match ready for the `games` table: the row id and tournament are attached here. */
export type GeneratedGame = Pick<
  Game,
  "field" | "time" | "teamA" | "teamB" | "division" | "tier" | "status"
> & {
  id: string;
  tournamentId: string;
};

/**
 * Round-robin pairings for one pool (circle method): every entrant plays once
 * per round, so nobody ends up booked in two courts at the same time. An odd
 * count leaves one bye per round — that pairing is skipped rather than played
 * against a placeholder.
 */
function poolRounds(names: string[]): [string, string][][] {
  if (names.length < 2) return [];
  const list = names.length % 2 === 0 ? [...names] : [...names, ""];
  const half = list.length / 2;
  const rounds: [string, string][][] = [];
  let rotating = [...list];

  for (let round = 0; round < list.length - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < half; i++) {
      const a = rotating[i];
      const b = rotating[list.length - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);
    rotating = [rotating[0], rotating[rotating.length - 1], ...rotating.slice(1, -1)];
  }
  return rounds;
}

/**
 * Every match for a set of entrants, laid onto courts in time slots.
 *
 * Pools run side by side: round N of pool A and round N of pool B share one
 * pass, filling Court 1…n and spilling into the next 90-minute slot only when
 * a round has more matches than there are courts.
 *
 * Division and tier are neutral defaults. Neither `tournament_teams` nor the
 * new-tournament wizard stores a division per entrant — the wizard's divisions
 * land on the published event, not the tournament row — so generated matches
 * sit under Mixed / 3.0 until the schema can carry a real assignment.
 *
 * Ids continue from `idSeed` (the games already in the table): `games.id` is a
 * global primary key with no default, and the prefix keeps the seed order
 * helpers sorting them within a slot.
 */
export function buildSchedule(input: {
  tournamentId: string;
  courts: number;
  /** First slot, "HH:MM" 24h — the live tournament's schedule_start. */
  startTime: string;
  idSeed: number;
  teams: { name: string; pool: string; seed: number }[];
}): GeneratedGame[] {
  const start = minutesFromTime(input.startTime) ?? minutesFromTime(DEFAULT_START_TIME) ?? 9 * 60;

  const byPool = new Map<string, string[]>();
  const ordered = [...input.teams].sort(
    (a, b) => a.pool.localeCompare(b.pool) || a.seed - b.seed,
  );
  for (const team of ordered) byPool.set(team.pool, [...(byPool.get(team.pool) ?? []), team.name]);

  const poolSchedule = [...byPool.values()].map(poolRounds);
  const roundCount = Math.max(0, ...poolSchedule.map((rounds) => rounds.length));
  const games: GeneratedGame[] = [];
  let slot = 0;

  for (let round = 0; round < roundCount; round++) {
    const pairs = poolSchedule.flatMap((rounds) => rounds[round] ?? []);

    pairs.forEach(([teamA, teamB], index) => {
      const court = index % input.courts;
      const slotIndex = slot + Math.floor(index / input.courts);
      games.push({
        id: `auto-${String(input.idSeed + games.length + 1).padStart(4, "0")}`,
        tournamentId: input.tournamentId,
        field: `Court ${court + 1}`,
        time: labelFromMinutes(start + SLOT_MINUTES * slotIndex),
        teamA,
        teamB,
        status: "next",
        division: "mixed",
        tier: "3.0",
      });
    });

    slot += Math.ceil(pairs.length / input.courts);
  }

  return games;
}
