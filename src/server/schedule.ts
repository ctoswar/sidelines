// Tournament workspace reads over Postgres (Phase 7).
//
// The tables are seeded from src/lib/mock-data.ts — the same module the
// pages used to render from — so this module is the bridge, the way
// server/events.ts is for events-data.ts: it returns the exact shapes those
// pages spoke (Game, Team, Tournament) in the display order their static
// arrays had. The `games` table has no sort column, so loadGames reproduces
// the seed order explicitly and verify-phase7.ts asserts DB order ≡ mock
// order, the same way verify-phase4 asserts detail parity.

import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
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
 * Every game of the seeded schedule, in display order. Consumers depend on
 * it: applyScheduleStartTime derives the shift from schedule[0], per-field
 * game numbers count in array order, and the grids render slot groups in
 * first-appearance order.
 */
export async function loadGames(): Promise<Game[]> {
  const rows = await db.select().from(t.games);
  return rows.map(gameRowToItem).sort(byScheduleOrder);
}

/** A tournament as the dashboard lists it: the display fields plus the id the status action needs. */
export type TournamentListItem = Tournament & { id: string; scheduleStart: string };

/**
 * Every tournament, live first, then by name. `name`/`meta`/`Live|Draft` are
 * what the old mock list carried; `id` and `scheduleStart` ride along so the
 * dashboard can flip a tournament's status.
 */
export async function loadTournaments(): Promise<TournamentListItem[]> {
  const rows = await db
    .select()
    .from(t.tournaments)
    // Enum ASC follows definition order, so "live" precedes "draft".
    .orderBy(asc(t.tournaments.status), asc(t.tournaments.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    meta: row.meta,
    status: row.status === "live" ? "Live" : "Draft",
    scheduleStart: row.scheduleStart,
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
