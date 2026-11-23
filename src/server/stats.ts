// Player statistics reads.
//
// A player's numbers come from the tournament `games` table, matched by the
// team profile's saved name — the same key the schedule pages use. Only final
// games count: a live or unscored match is not a result yet. The organizer's
// players directory reads the same match log per player, scoped to the
// organizers' tournaments and events, so both workspaces share one math.

import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { loadTeamRow } from "@/server/team";
import {
  computePlayerStats,
  type PlayerHistoryEntry,
  type PlayerMatchRow,
  type PlayerStats,
} from "@/lib/stats";

/** Every final game the team played, oldest first, with the tournament attached. */
export async function loadPlayerMatchLog(teamName: string): Promise<PlayerMatchRow[]> {
  if (!teamName) return [];
  const rows = await db
    .select({
      id: t.games.id,
      teamA: t.games.teamA,
      teamB: t.games.teamB,
      score: t.games.score,
      completedAt: t.gameResults.completedAt,
      tournamentId: t.tournaments.id,
      tournamentName: t.tournaments.name,
      eventSlug: t.tournaments.eventSlug,
    })
    .from(t.games)
    .innerJoin(t.tournaments, eq(t.games.tournamentId, t.tournaments.id))
    .leftJoin(t.gameResults, eq(t.gameResults.gameId, t.games.id))
    .where(
      and(
        eq(t.games.status, "final"),
        or(eq(t.games.teamA, teamName), eq(t.games.teamB, teamName)),
      ),
    );

  return rows
    .map((row): PlayerMatchRow | null => {
      // "11–7" (en dash) is the stored shape; plain hyphens parse too.
      const parts = row.score.split(/\s*[–—-]\s*/);
      if (parts.length !== 2) return null;
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const onSideA = row.teamA === teamName;
      const pointsFor = onSideA ? a : b;
      const pointsAgainst = onSideA ? b : a;
      return {
        id: row.id,
        tournamentId: row.tournamentId,
        tournamentName: row.tournamentName,
        eventSlug: row.eventSlug,
        opponent: onSideA ? row.teamB : row.teamA,
        score: row.score,
        pointsFor,
        pointsAgainst,
        won: pointsFor > pointsAgainst,
        playedAt: row.completedAt ? row.completedAt.toISOString() : null,
      };
    })
    .filter((row): row is PlayerMatchRow => row !== null)
    .sort((a, b) => {
      if (a.playedAt && b.playedAt) return a.playedAt.localeCompare(b.playedAt);
      if (a.playedAt) return -1;
      if (b.playedAt) return 1;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
}

/** The tournament ids whose public event has already run. */
async function completedTournamentIds(tournamentIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(tournamentIds)].filter(Boolean);
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: t.tournaments.id })
    .from(t.tournaments)
    .innerJoin(t.events, eq(t.tournaments.eventSlug, t.events.slug))
    .where(and(inArray(t.tournaments.id, ids), eq(t.events.status, "past")));
  return new Set(rows.map((row) => row.id));
}

/** The signed-in player's stats — zeroed, not an error, before a team is saved. */
export async function loadPlayerStats(userId: string): Promise<PlayerStats> {
  const team = await loadTeamRow(userId);
  const teamName = team?.name ?? "";
  if (!teamName) return computePlayerStats("", []);
  const matches = await loadPlayerMatchLog(teamName);
  const completed = await completedTournamentIds(matches.map((match) => match.tournamentId));
  return computePlayerStats(teamName, matches, completed);
}

/**
 * Finished tournaments the team played in: the ones whose public event is in
 * the past. Placement reads the published overall table when the event has
 * results — index in `overall` is the standing the event page shows.
 */
export async function loadPlayerHistory(userId: string): Promise<PlayerHistoryEntry[]> {
  const team = await loadTeamRow(userId);
  const teamName = team?.name ?? "";
  if (!teamName) return [];
  const matches = await loadPlayerMatchLog(teamName);
  const completed = await completedTournamentIds(matches.map((match) => match.tournamentId));
  const stats = computePlayerStats(teamName, matches, completed);
  const finished = stats.tournaments.filter((entry) => entry.state === "completed");
  if (finished.length === 0) return [];

  // Best-effort placements: one query per linked event, tolerant of events
  // whose detail row predates results.
  const withPlacements = await Promise.all(
    finished.map(async (entry) => {
      let placement: number | null = null;
      if (entry.eventSlug) {
        const [detail] = await db
          .select({ overall: t.eventDetails.overall, hasResults: t.eventDetails.hasResults })
          .from(t.eventDetails)
          .where(eq(t.eventDetails.eventId, entry.eventSlug))
          .limit(1);
        if (detail?.hasResults) {
          const overall = detail.overall as { team: string }[];
          const index = overall.findIndex((row) => row.team === teamName);
          if (index >= 0) placement = index + 1;
        }
      }
      return { ...entry, placement };
    }),
  );
  return withPlacements.sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
}

export type OrganizerPlayerRow = {
  userId: string;
  name: string;
  email: string;
  teamName: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  pointsPerGame: number;
};

/**
 * The players behind an organizer's tournaments: everyone registered to one
 * of the organization's events, plus anyone whose saved team appears in the
 * organization's games. Each row carries the same stats math the player
 * workspace shows, so the directory is a preview of the full profile.
 */
export async function loadOrganizerPlayers(organizationId: string): Promise<OrganizerPlayerRow[]> {
  const tournamentRows = await db
    .select({ id: t.tournaments.id, eventSlug: t.tournaments.eventSlug })
    .from(t.tournaments)
    .where(eq(t.tournaments.organizationId, organizationId));
  const eventSlugs = [
    ...new Set(tournamentRows.map((row) => row.eventSlug).filter((slug): slug is string => Boolean(slug))),
  ];

  // Registered players with accounts (email-only entries cannot own stats).
  const registered = eventSlugs.length
    ? await db
        .selectDistinct({ userId: t.registrations.userId, email: t.registrations.email })
        .from(t.registrations)
        .where(inArray(t.registrations.eventSlug, eventSlugs))
    : [];

  // Teams that actually played the organization's games.
  const gameTeams = await db
    .select({ teamA: t.games.teamA, teamB: t.games.teamB })
    .from(t.games)
    .innerJoin(t.tournaments, eq(t.games.tournamentId, t.tournaments.id))
    .where(eq(t.tournaments.organizationId, organizationId));

  const [usersByEmail, usersByTeam] = await Promise.all([
    // Registrations carry the player's account id directly.
    Promise.resolve(
      registered
        .filter((row): row is { userId: string; email: string } => Boolean(row.userId))
        .map((row) => row.userId),
    ),
    gameTeams.length
      ? db
          .select({ id: t.teamProfiles.userId })
          .from(t.teamProfiles)
          .where(inArray(t.teamProfiles.name, [...new Set(gameTeams.flatMap((row) => [row.teamA, row.teamB]))]))
      : Promise.resolve([]),
  ]);

  const userIds = [...new Set([...usersByEmail, ...usersByTeam.map((row) => row.id)])];
  if (userIds.length === 0) return [];

  const people = await db
    .select({ id: t.user.id, name: t.user.name, email: t.user.email })
    .from(t.user)
    .where(inArray(t.user.id, userIds));

  const teams = await db
    .select({ userId: t.teamProfiles.userId, name: t.teamProfiles.name })
    .from(t.teamProfiles)
    .where(inArray(t.teamProfiles.userId, userIds));
  const teamByUser = new Map(teams.map((row) => [row.userId, row.name]));

  const rows = await Promise.all(
    people.map(async (person) => {
      const teamName = teamByUser.get(person.id) ?? "";
      const matches = teamName ? await loadPlayerMatchLog(teamName) : [];
      const stats = computePlayerStats(teamName, matches);
      return {
        userId: person.id,
        name: person.name,
        email: person.email,
        teamName,
        matches: stats.matchesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.winRate,
        pointsPerGame: stats.pointsPerGame,
      };
    }),
  );
  return rows.sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
}

/** Whether this player is visible to the organizer (registered or played). */
export async function playerInOrganizationScope(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const players = await loadOrganizerPlayers(organizationId);
  return players.some((player) => player.userId === userId);
}

/** One organizer-visible player for the profile page; null when out of scope. */
export async function loadOrganizerPlayer(
  organizationId: string,
  userId: string,
): Promise<{ name: string; stats: PlayerStats; history: PlayerHistoryEntry[] } | null> {
  const [person] = await db
    .select({ id: t.user.id, name: t.user.name })
    .from(t.user)
    .where(eq(t.user.id, userId))
    .limit(1);
  if (!person) return null;
  if (!(await playerInOrganizationScope(organizationId, userId))) return null;
  const [stats, history] = await Promise.all([loadPlayerStats(userId), loadPlayerHistory(userId)]);
  return { name: person.name, stats, history };
}
