import { PageHeader } from "@/components/dashboard/page-header";
import { TeamName } from "@/components/dashboard/team-name";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { loadGames } from "@/server/schedule";
import { requireRole } from "@/server/session";
import { loadTeamRow } from "@/server/team";

export const metadata = { title: "My schedule – Sidelines" };
export const dynamic = "force-dynamic";

export default async function PlayerSchedulePage() {
  const user = await requireRole("player");
  // The player's own fixtures: matched on their saved team name, not on any
  // seeded constant, so an empty database reads as an empty schedule.
  const team = await loadTeamRow(user.id);
  const games = await loadGames();
  const mine = games.filter((g) => g.teamA === team?.name || g.teamB === team?.name);

  return (
    <>
      <PageHeader
        title="My schedule"
        subtitle={<><TeamName /> · {mine.length} match{mine.length === 1 ? "" : "es"}</>}
      />
      <div className="space-y-3">
        {mine.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded-xl border border-line bg-card p-4">
            <div>
              <p className="text-sm text-muted">{g.time} · {g.field}</p>
              <p className="font-bold">{g.teamA} vs {g.teamB}</p>
            </div>
            <div className="text-right">
              <p className="font-score text-3xl tabular-nums">{g.score || "–"}</p>
              <StatusBadge status={g.status} />
            </div>
          </div>
        ))}
        {mine.length === 0 && (
          <p className="rounded-xl border border-line bg-card p-4 text-sm text-muted">
            No matches yet — your schedule fills in once an organizer schedules your team.
          </p>
        )}
      </div>
    </>
  );
}
