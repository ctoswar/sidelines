import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScorePanel } from "@/components/dashboard/score-panel";
import { games } from "@/lib/mock-data";
import { divisionLabel } from "@/lib/divisions";

export const metadata: Metadata = { title: "Score a game – Sidelines" };

export default async function ScorePage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const { game } = await searchParams;
  const g = games.find((x) => x.id === game) ?? games.find((x) => x.status === "live") ?? games[0];

  return (
    <>
      <PageHeader title="Score a game" subtitle={`${g.teamA} vs ${g.teamB} · ${g.time} · ${divisionLabel(g.division)} ${g.tier}`} />
      <ScorePanel teams={[g.teamA, g.teamB]} field={g.field} label={`${divisionLabel(g.division)} · ${g.tier}`} />
    </>
  );
}
