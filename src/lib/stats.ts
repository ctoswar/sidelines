// Player statistics — shared shapes + pure computation.
//
// Every number on the stats surfaces is derived from final games in the
// `games` table: a game row is one match, its score one set ("11–7"), and a
// player's team is matched by the team profile's saved name. The computation
// lives here so the player workspace, the organizer's players directory and
// the verify scripts all speak the same math.

export type PlayerMatchRow = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  eventSlug: string | null;
  opponent: string;
  score: string;
  pointsFor: number;
  pointsAgainst: number;
  won: boolean;
  /** ISO timestamp of the result write; null for seeded scores. */
  playedAt: string | null;
};

export type TournamentPerformance = {
  tournamentId: string;
  name: string;
  eventSlug: string | null;
  matches: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** "active" = still on the schedule; "completed" = its event has run. */
  state: "active" | "completed";
};

export type PlayerStreak = { kind: "wins" | "losses" | "none"; count: number };

export type PlayerStats = {
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  pointsWon: number;
  pointsLost: number;
  /** 0-100, rounded; 0 for a player with no matches. */
  winRate: number;
  streak: PlayerStreak;
  /** One decimal; 0 for a player with no matches. */
  pointsPerGame: number;
  tournaments: TournamentPerformance[];
};

export type PlayerHistoryEntry = {
  tournamentId: string;
  name: string;
  eventSlug: string | null;
  matches: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Final standing (1-based) from the published overall table, when known. */
  placement: number | null;
};

/** One game to 11 is one match, so sets won/lost mirror the match record. */
export function computePlayerStats(
  teamName: string,
  matches: PlayerMatchRow[],
  completedTournamentIds: ReadonlySet<string> = new Set(),
): PlayerStats {
  let wins = 0;
  let losses = 0;
  let pointsWon = 0;
  let pointsLost = 0;

  for (const match of matches) {
    if (match.won) wins += 1;
    else losses += 1;
    pointsWon += match.pointsFor;
    pointsLost += match.pointsAgainst;
  }

  const byTournament = new Map<string, TournamentPerformance>();
  for (const match of matches) {
    const current = byTournament.get(match.tournamentId) ?? {
      tournamentId: match.tournamentId,
      name: match.tournamentName,
      eventSlug: match.eventSlug,
      matches: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      state: completedTournamentIds.has(match.tournamentId) ? ("completed" as const) : ("active" as const),
    };
    current.matches += 1;
    if (match.won) current.wins += 1;
    else current.losses += 1;
    current.pointsFor += match.pointsFor;
    current.pointsAgainst += match.pointsAgainst;
    byTournament.set(match.tournamentId, current);
  }

  return {
    teamName,
    matchesPlayed: matches.length,
    wins,
    losses,
    gamesWon: wins,
    gamesLost: losses,
    pointsWon,
    pointsLost,
    winRate: matches.length ? Math.round((wins / matches.length) * 100) : 0,
    streak: currentStreak(matches),
    pointsPerGame: matches.length ? Math.round((pointsWon / matches.length) * 10) / 10 : 0,
    tournaments: [...byTournament.values()].sort(
      (a, b) => b.matches - a.matches || a.name.localeCompare(b.name),
    ),
  };
}

/**
 * The run the player is on right now: consecutive wins or losses counting
 * back from the most recent result. Result timestamps order the run; rows
 * without one (seeded scores) keep their schedule order behind timestamped
 * rows.
 */
export function currentStreak(matches: PlayerMatchRow[]): PlayerStreak {
  if (matches.length === 0) return { kind: "none", count: 0 };
  const ordered = [...matches].sort((a, b) => {
    if (a.playedAt && b.playedAt) return a.playedAt.localeCompare(b.playedAt);
    if (a.playedAt) return 1;
    if (b.playedAt) return -1;
    return 0;
  });

  const last = ordered[ordered.length - 1];
  const kind: "wins" | "losses" = last.won ? "wins" : "losses";
  let count = 0;
  for (let index = ordered.length - 1; index >= 0; index--) {
    if (ordered[index].won !== last.won) break;
    count += 1;
  }
  return { kind, count };
}

export function streakLabel(streak: PlayerStreak): string {
  if (streak.kind === "none" || streak.count === 0) return "No active streak";
  return `${streak.count} ${streak.kind === "wins" ? "win" : "loss"}${streak.count === 1 ? "" : "es"} in a row`;
}
