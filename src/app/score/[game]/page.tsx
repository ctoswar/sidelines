import Link from "next/link";
import { notFound } from "next/navigation";
import { ScorePanel } from "@/components/dashboard/score-panel";
import { games } from "@/lib/mock-data";
import { divisionLabel } from "@/lib/divisions";

// Public, no-account scoring route — opened by scanning a scorekeeper QR code.
// The QR link carries the person's name and role, so scanning identifies them.
export default async function PublicScorePage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ role?: string; name?: string }>;
}) {
  const { game } = await params;
  const { role, name } = await searchParams;
  const g = games.find((x) => x.id === game);
  if (!g) notFound();

  const roleLabel = role === "referee" ? "Referee" : role === "scorer" ? "Scorer" : undefined;
  const keeperName = name?.slice(0, 40);

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
          {keeperName ? (
            <>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-flag">{roleLabel ?? "On the sideline"}</p>
              <h1 className="font-score text-3xl font-bold tracking-tight">{keeperName}</h1>
            </>
          ) : (
            <h1 className="font-score text-3xl font-bold tracking-tight">{g.teamA} vs {g.teamB}</h1>
          )}
          <p className="mt-1 text-sm text-muted">
            {g.teamA} vs {g.teamB} · {g.time} · {g.field}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted">
            {divisionLabel(g.division)} · {g.tier} · no account needed
          </p>
        </div>
        <ScorePanel
          teams={[g.teamA, g.teamB]}
          field={g.field}
          role={roleLabel}
          keeper={keeperName}
          label={`${divisionLabel(g.division)} · ${g.tier}`}
          publicMode
        />
      </main>
    </div>
  );
}
