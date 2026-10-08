import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { games, MY_TEAM } from "@/lib/mock-data";

export const metadata = { title: "My schedule – Sidelines" };

export default function PlayerSchedulePage() {
  const mine = games.filter((g) => g.teamA === MY_TEAM || g.teamB === MY_TEAM);
  return (
    <>
      <PageHeader title="My schedule" subtitle={`${MY_TEAM} · Saturday`} />
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
      </div>
    </>
  );
}
