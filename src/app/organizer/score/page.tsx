import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScorePanel } from "@/components/dashboard/score-panel";
import { divisionLabel } from "@/lib/divisions";
import { parseFinalScore } from "@/lib/game-results";
import { applyScheduleStartTime } from "@/lib/schedule-config";
import { loadOrganization } from "@/server/organizations";
import { loadGamesForOrganization } from "@/server/schedule";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Score a game – Sidelines" };
export const dynamic = "force-dynamic";

export default async function ScorePage({ searchParams }: { searchParams: Promise<{ game?: string; scheduleStart?: string }> }) {
  const { game, scheduleStart } = await searchParams;
  // Score only this organizer's own live schedule — never another club's game.
  const user = await requireRole("organizer");
  const organization = await loadOrganization(user.id);
  const ownGames = organization ? await loadGamesForOrganization(organization.id) : [];
  const schedule = applyScheduleStartTime(ownGames, scheduleStart ?? "09:00");
  const g = schedule.find((x) => x.id === game) ?? schedule.find((x) => x.status === "live") ?? schedule[0];

  // Starting from an empty database is a first-run state, not an error: with
  // no games there is nothing to score, so offer the schedule (where Auto-fill
  // creates them) instead of dereferencing an undefined game. #65
  if (!g) {
    return (
      <>
        <PageHeader title="Score a game" subtitle="No matches scheduled yet" />
        <div className="rounded-lg border border-line bg-card p-8 text-center text-muted">
          No games to score yet — build the schedule first.
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
         // A game already on the schedule as final reopens read-only, so
         // opening its scorecard cannot restart or overwrite a finished game.
         initialScore={parseFinalScore(g.score)}
         isFinal={g.status === "final"}
       />
    </>
  );
}
