import Link from "next/link";
import { notFound } from "next/navigation";
import { ScorePanel } from "@/components/dashboard/score-panel";
import { games } from "@/lib/mock-data";
import { divisionLabel } from "@/lib/divisions";

// Public, no-account scoring route — opened by scanning a scorekeeper QR code.
export default async function PublicScorePage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { game } = await params;
  const { role } = await searchParams;
  const g = games.find((x) => x.id === game);
  if (!g) notFound();

  const roleLabel = role === "referee" ? "Referee" : role === "scorer" ? "Scorer" : undefined;

  return (
    <div className="min-h-screen bg-bg px-4 py-6">
      <header className="mx-auto mb-5 flex max-w-sm items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-flag">Sidelines</p>
        <Link href={`/organizer/score?game=${g.id}`} className="text-xs text-muted hover:underline">
          Organizer view
        </Link>
      </header>
      <main>
        <div className="mx-auto mb-4 max-w-sm text-center">
          <h1 className="font-score text-3xl font-bold tracking-tight">{g.teamA} vs {g.teamB}</h1>
          <p className="mt-1 text-sm text-muted">
            {g.time} · {g.field} · {divisionLabel(g.division)} {g.tier}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wider text-muted">No account needed — just keep score</p>
        </div>
        <ScorePanel teams={[g.teamA, g.teamB]} field={g.field} role={roleLabel} label={`${divisionLabel(g.division)} · ${g.tier}`} publicMode />
      </main>
    </div>
  );
}
