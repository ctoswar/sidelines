// Player statistics + tournament history, shared by both workspaces.
//
// The player's My events page renders these for the signed-in player; the
// organizer's players directory renders the exact same components for any
// player in their tournaments. Pure display: the server does the math.

import Link from "next/link";
import {
  ClipboardIcon,
  FlameIcon,
  PercentIcon,
  TargetIcon,
  TrendIcon,
  TrophyIcon,
} from "@/components/stats/icons";
import { streakLabel, type PlayerHistoryEntry, type PlayerStats } from "@/lib/stats";

const ordinal = (place: number) => {
  const rem100 = place % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${place}th`;
  switch (place % 10) {
    case 1: return `${place}st`;
    case 2: return `${place}nd`;
    case 3: return `${place}rd`;
    default: return `${place}th`;
  }
};

/** The three headline tiles: win rate, streak, points per game. */
export function StatsHero({ stats }: { stats: PlayerStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <article className="rounded-xl border border-line bg-card p-5">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          <PercentIcon size={16} /> Win rate
        </p>
        <p className="mt-2 text-3xl font-extrabold tabular-nums">{stats.winRate}%</p>
        <p className="mt-1 flex justify-between text-sm text-muted">
          <span>{stats.wins}W - {stats.losses}L</span>
          <span>{stats.matchesPlayed} match{stats.matchesPlayed === 1 ? "" : "es"}</span>
        </p>
      </article>
      <article className="rounded-xl border border-line bg-card p-5">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          <FlameIcon size={16} /> Current streak
        </p>
        <p className="mt-2 text-3xl font-extrabold tabular-nums">
          {stats.streak.kind === "none" ? "0" : stats.streak.count}
        </p>
        <p className="mt-1 text-sm text-muted">{streakLabel(stats.streak)}</p>
      </article>
      <article className="rounded-xl border border-line bg-card p-5">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          <TargetIcon size={16} /> Pts/game
        </p>
        <p className="mt-2 text-3xl font-extrabold tabular-nums">{stats.pointsPerGame.toFixed(2)}</p>
        <p className="mt-1 text-sm text-muted">Average points per game</p>
      </article>
    </div>
  );
}

/** The eight-tile match statistics grid. */
export function MatchStats({ stats }: { stats: PlayerStats }) {
  const cells: { label: string; value: string }[] = [
    { label: "Matches played", value: String(stats.matchesPlayed) },
    { label: "Total wins", value: String(stats.wins) },
    { label: "Total losses", value: String(stats.losses) },
    { label: "Games won", value: String(stats.gamesWon) },
    { label: "Games lost", value: String(stats.gamesLost) },
    { label: "Points won", value: String(stats.pointsWon) },
    { label: "Points lost", value: String(stats.pointsLost) },
    { label: "Win/Loss", value: `${stats.wins}-${stats.losses}` },
  ];
  return (
    <section aria-labelledby="stats-match-heading">
      <h2 id="stats-match-heading" className="mb-3 flex items-center gap-2 text-lg font-extrabold">
        <TrendIcon size={18} className="text-muted" /> Match statistics
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-lg border border-line bg-card p-4">
            <p className="text-xs text-muted">{cell.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{cell.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Per-tournament records the player's matches roll up into. */
export function TournamentPerformance({ stats }: { stats: PlayerStats }) {
  return (
    <section aria-labelledby="stats-tournament-heading">
      <h2 id="stats-tournament-heading" className="mb-3 flex items-center gap-2 text-lg font-extrabold">
        <TrophyIcon size={18} className="text-muted" /> Tournament performance
      </h2>
      {stats.tournaments.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-10 text-center">
          <TrophyIcon size={30} className="mx-auto text-muted" />
          <p className="mt-2 font-bold">No tournaments played yet</p>
          <p className="mt-1 text-sm text-muted">
            Join a tournament and your record here updates with every final score.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-card">
          {stats.tournaments.map((tournament) => (
            <li key={tournament.tournamentId} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {tournament.eventSlug ? (
                    <Link href={`/events/${tournament.eventSlug}`} className="hover:underline">
                      {tournament.name}
                    </Link>
                  ) : (
                    tournament.name
                  )}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                      tournament.state === "completed"
                        ? "border-line text-muted"
                        : "border-flag text-flag"
                    }`}
                  >
                    {tournament.state === "completed" ? "Completed" : "Active"}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {tournament.wins}-{tournament.losses} · {tournament.pointsFor} points for ·{" "}
                  {tournament.pointsAgainst} against
                </p>
              </div>
              <p className="text-lg font-extrabold tabular-nums">
                {tournament.pointsFor - tournament.pointsAgainst >= 0 ? "+" : ""}
                {tournament.pointsFor - tournament.pointsAgainst}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The whole stats tab. */
export function PlayerStatsView({
  stats,
  name,
}: {
  stats: PlayerStats;
  name?: string;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold">
          <ClipboardIcon size={22} className="text-muted" /> Player statistics
        </h2>
        <p className="mt-1 text-sm text-muted">
          {name ? `${name} · ` : ""}Performance metrics across all tournaments
          {stats.teamName ? ` — playing as ${stats.teamName}` : ""}
        </p>
      </section>

      {!stats.teamName ? (
        <div className="rounded-xl border border-line bg-card p-10 text-center">
          <TrophyIcon size={30} className="mx-auto text-muted" />
          <p className="mt-2 font-bold">No team profile yet</p>
          <p className="mt-1 text-sm text-muted">
            Save your team name on the My team page — match results are matched to it.
          </p>
          <Link href="/player/team" className="btn btn-pri mt-4 inline-block">
            Set up my team
          </Link>
        </div>
      ) : (
        <>
          <StatsHero stats={stats} />
          <MatchStats stats={stats} />
          <TournamentPerformance stats={stats} />
        </>
      )}
    </div>
  );
}

/** Completed tournaments with final standings, or the trophy empty state. */
export function PlayerHistoryView({
  history,
  teamName,
}: {
  history: PlayerHistoryEntry[];
  teamName?: string;
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-card p-12 text-center">
        <TrophyIcon size={34} className="mx-auto text-muted" />
        <p className="mt-3 font-bold">No completed tournaments yet</p>
        <p className="mt-1 text-sm text-muted">
          {teamName
            ? "When an event you played wraps up, its results and final standing land here."
            : "Play in a tournament and your completed events appear here."}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {history.map((entry) => (
        <li
          key={entry.tournamentId}
          className="flex items-center gap-4 rounded-xl border border-line bg-card p-4"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent text-brand" aria-hidden="true">
            <TrophyIcon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {entry.eventSlug ? (
                <Link href={`/events/${entry.eventSlug}`} className="hover:underline">
                  {entry.name}
                </Link>
              ) : (
                entry.name
              )}
            </p>
            <p className="text-sm text-muted">
              {entry.wins}-{entry.losses} in {entry.matches} match{entry.matches === 1 ? "" : "es"} ·{" "}
              {entry.pointsFor}-{entry.pointsAgainst} points
            </p>
          </div>
          {entry.placement !== null && (
            <p className="text-xl font-extrabold tabular-nums text-brand">{ordinal(entry.placement)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
