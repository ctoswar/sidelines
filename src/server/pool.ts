// Pool-table writes for the organizer workspace.
//
// Pickleball players register solo: `registrations` holds one row per person,
// and a "team" in the pool table is usually just that player's name. Before
// this module existed nothing in the real app ever wrote `tournament_teams` —
// the table only filled from the demo seed — so a real tournament's pool was
// always empty. These helpers fix that with three ways in:
//
//   addEntrants   — one or many named entrants (Add team, CSV import)
//   bridgeSignups — every registration for the live event, seeded into pools
//
// Both are idempotent: an entrant already in the pool (matched by name for
// manual adds, by the bridged user for signups) is skipped rather than
// duplicated, so the actions are safe to click twice. Seeds left blank
// continue after the highest one already taken, and the signups bridge
// alternates pools A/B down the signup order so a fresh draw is balanced
// without hand-seeding every player.

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";

/** Where an entrant came from — shown as a provenance badge in the table. */
export type TeamSource = "manual" | "csv" | "signups";

export type PoolTeam = {
  name: string;
  pool: "A" | "B";
  seed: number;
  source: TeamSource;
};

/** A pool row plus the bridged user id, when the entrant came from a signup. */
export type PoolTeamRow = PoolTeam & { userId: string | null };

/** The one tournament the workspace configures, with the event it publishes. */
export type LiveTournament = { id: string; name: string; eventSlug: string | null };

/**
 * The live tournament and the event slug it publishes under — the slug is what
 * ties the pool table to the registrations the signups bridge reads. A draft
 * has no event, so `eventSlug` is null until it goes live.
 */
export async function loadLiveTournament(): Promise<LiveTournament | null> {
  const [row] = await db
    .select({
      id: t.tournaments.id,
      name: t.tournaments.name,
      eventSlug: t.tournaments.eventSlug,
    })
    .from(t.tournaments)
    .where(eq(t.tournaments.status, "live"))
    .limit(1);
  return row ?? null;
}

/** Every entrant in the live tournament's pool — seed order. */
export async function loadPool(tournamentId: string): Promise<PoolTeamRow[]> {
  const rows = await db
    .select({
      name: t.tournamentTeams.name,
      pool: t.tournamentTeams.pool,
      seed: t.tournamentTeams.seed,
      source: t.tournamentTeams.source,
      userId: t.tournamentTeams.userId,
    })
    .from(t.tournamentTeams)
    .where(eq(t.tournamentTeams.tournamentId, tournamentId))
    .orderBy(asc(t.tournamentTeams.seed), asc(t.tournamentTeams.name));
  return rows.map((row) => ({ ...row, source: row.source as TeamSource }));
}

/** The highest seed already taken, so blank seeds continue the numbering. */
async function highestSeed(tournamentId: string): Promise<number> {
  const [row] = await db
    .select({ seed: sql<number>`coalesce(max(${t.tournamentTeams.seed}), 0)::int` })
    .from(t.tournamentTeams)
    .where(eq(t.tournamentTeams.tournamentId, tournamentId));
  return row?.seed ?? 0;
}

/** Names already in the pool, and users already bridged — both skip-lists. */
async function existingState(tournamentId: string) {
  const rows = await db
    .select({ name: t.tournamentTeams.name, userId: t.tournamentTeams.userId })
    .from(t.tournamentTeams)
    .where(eq(t.tournamentTeams.tournamentId, tournamentId));
  return {
    names: new Set(rows.map((row) => row.name)),
    users: new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))),
  };
}

/** One entrant to add; `userId` marks it as bridged from that signup. */
export type EntrantInput = { name: string; pool: "A" | "B"; seed?: number; userId?: string };

export type AddResult = {
  added: PoolTeam[];
  /** Entrants skipped because the pool already had them. */
  skipped: string[];
};

/**
 * Inserts entrants into the pool, skipping names already present and filling
 * blank seeds after the current highest. One insert statement, so a partial
 * import cannot leave the pool half-written.
 */
export async function addEntrants(
  tournamentId: string,
  entries: EntrantInput[],
  source: TeamSource,
): Promise<AddResult> {
  const { names } = await existingState(tournamentId);
  let nextSeed = await highestSeed(tournamentId);

  const added: PoolTeam[] = [];
  const skipped: string[] = [];
  const rows: (typeof t.tournamentTeams.$inferInsert)[] = [];

  for (const entry of entries) {
    if (names.has(entry.name)) {
      skipped.push(entry.name);
      continue;
    }
    names.add(entry.name);
    const seed = entry.seed ?? ++nextSeed;
    if (seed > nextSeed) nextSeed = seed;
    added.push({ name: entry.name, pool: entry.pool, seed, source });
    rows.push({
      tournamentId,
      name: entry.name,
      pool: entry.pool,
      seed,
      source,
      userId: entry.userId ?? null,
    });
  }

  if (rows.length) {
    await db.insert(t.tournamentTeams).values(rows).onConflictDoNothing();
  }
  return { added, skipped };
}

export type BridgeResult = AddResult & {
  /** Registrations that were candidates; 0 additions with a nonzero count
   *  means everyone is already in the pool. */
  candidates: number;
};

/**
 * Builds the pool from the live event's registrations — the pickleball-native
 * path, since players sign up solo. Each registrant becomes one entrant under
 * their own name, seeded in signup order and alternated down pools A/B for a
 * balanced draw. Registrants already in the pool are skipped, so re-running
 * after a new signup only adds the newcomers.
 */
export async function bridgeSignups(tournamentId: string, eventSlug: string): Promise<BridgeResult> {
  const registrations = await db
    .select({ name: t.registrations.name, userId: t.registrations.userId })
    .from(t.registrations)
    .where(eq(t.registrations.eventSlug, eventSlug))
    .orderBy(asc(t.registrations.at));

  const { users } = await existingState(tournamentId);

  // Sign-up order decides the seeding; the pool alternates so the draw splits
  // evenly without the organizer hand-assigning every player.
  const candidates: EntrantInput[] = registrations
    // A registration without a userId (account deleted) still deserves a slot,
    // but only under a name not already taken.
    .filter((row) => !row.userId || !users.has(row.userId))
    .map((row, index) => ({
      name: row.name,
      pool: (index % 2 === 0 ? "A" : "B") as "A" | "B",
      userId: row.userId ?? undefined,
    }));

  const result = await addEntrants(tournamentId, candidates, "signups");
  return { ...result, candidates: registrations.length };
}

/** Removes one entrant by name; false when there was nothing to remove. */
export async function removeEntrant(tournamentId: string, name: string): Promise<boolean> {
  const deleted = await db
    .delete(t.tournamentTeams)
    .where(and(eq(t.tournamentTeams.tournamentId, tournamentId), eq(t.tournamentTeams.name, name)))
    .returning({ name: t.tournamentTeams.name });
  return deleted.length > 0;
}

/**
 * Keeps the published event's `teamCount` in step with the pool, so the public
 * card stops advertising "0 teams" once the pool fills. No event -> no-op.
 */
export async function syncEventTeamCount(tournamentId: string, eventSlug: string | null): Promise<void> {
  if (!eventSlug) return;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.tournamentTeams)
    .where(eq(t.tournamentTeams.tournamentId, tournamentId));
  await db
    .update(t.events)
    .set({ teamCount: row?.count ?? 0 })
    .where(eq(t.events.slug, eventSlug));
}
