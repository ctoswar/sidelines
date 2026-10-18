import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScorePanel } from "@/components/dashboard/score-panel";
import { divisionLabel } from "@/lib/divisions";
import { applyScheduleStartTime } from "@/lib/schedule-config";
import { loadGames } from "@/server/schedule";

export const metadata: Metadata = { title: "Score a game – Sidelines" };
export const dynamic = "force-dynamic";

export default async function ScorePage({ searchParams }: { searchParams: Promise<{ game?: string; scheduleStart?: string }> }) {
  const { game, scheduleStart } = await searchParams;
  const schedule = applyScheduleStartTime(await loadGames(), scheduleStart ?? "09:00");
  const g = schedule.find((x) => x.id === game) ?? schedule.find((x) => x.status === "live") ?? schedule[0];

  // Starting from an empty database is a first-run state, not an error: with
  // no games there is nothing to score, so offer the schedule (where Auto-fill
  // creates them) instead of dereferencing an undefined game. #65
  if (!g) {
    return (
      <>
        <PageHeader title="Score a game" subtitle="No matches scheduled yet" />
        <div className="rounded-lg border border-line bg-card p-8 text-center text-muted">
          No games to score yet. Use Auto-fill to add some.
          <div className="mt-4">
            <Link href="/organizer/schedule" className="btn btn-pri">
              Open schedule
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Score a game" subtitle={`${g.teamA} vs ${g.teamB} · ${g.time} · ${divisionLabel(g.division)} ${g.tier}`} />
       <ScorePanel
         gameId={g.id}
         teams={[g.teamA, g.teamB]}
         field={g.field}
         scheduleLabel={`${g.time} · ${g.field}`}
         label={`${divisionLabel(g.division)} · ${g.tier}`}
       />
    </>
  );
}
