import Link from "next/link";
import { notFound } from "next/navigation";
import { ScorePanel } from "@/components/dashboard/score-panel";
import { games, keepers } from "@/lib/mock-data";
import { divisionLabel } from "@/lib/divisions";
import { fieldGameLabel, getFieldGameNumbers } from "@/lib/game-labels";
import { applyScheduleStartTime } from "@/lib/schedule-config";

// Public, no-account scoring route — opened by scanning a scorekeeper QR code.
// The QR link carries the person's name and role, so scanning identifies them.
export default async function PublicScorePage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ role?: string; name?: string; scheduleStart?: string }>;
}) {
  const { game } = await params;
  const { role, name, scheduleStart } = await searchParams;
  const schedule = applyScheduleStartTime(games, scheduleStart ?? "09:00");
  const g = schedule.find((x) => x.id === game);
  if (!g) notFound();

  const roleLabel = role === "umpire" ? "Umpire" : role === "scorer" ? "Scorekeeper" : undefined;
  const keeperName = name?.slice(0, 40);
  const scheduleLabel = `${g.time} · ${fieldGameLabel(g, getFieldGameNumbers(games))}`;

  // This slot can hold two people — show everyone assigned, scanned person first.
  const assignedCrew = keepers
    .filter((k) => k.gameId === g.id)
    .map((k) => ({ name: k.name, role: k.role === "Scorer" ? "Scorekeeper" : k.role }));
  const crew = [
    ...(keeperName && roleLabel ? [{ name: keeperName, role: roleLabel, isYou: true }] : []),
    ...assignedCrew
      .filter((person) => person.name !== keeperName)
      .map((person) => ({ ...person, isYou: false })),
  ];
  const slotNames = assignedCrew.map((person) => person.name);
  const keeperLabel = (keeperName ? [keeperName, ...slotNames.filter((n) => n !== keeperName)] : slotNames).join(" · ");

  return (
    <div className="score-public-page min-h-screen bg-bg px-4 py-6">
      <header className="score-public-header mx-auto mb-5 flex max-w-sm items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-flag">Sidelines</p>
        <Link href={`/organizer/score?game=${g.id}`} className="text-xs text-muted hover:underline">
          Organizer view
        </Link>
        </header>
      <main>
        <div className="score-public-intro mx-auto mb-4 max-w-sm text-center">
          <h1 className="score-public-schedule-label font-score font-bold tracking-tight">{scheduleLabel}</h1>
          {crew.length > 0 && (
            <div className="score-public-crew mt-2" aria-label="Assigned game crew">
              {crew.map((person) => (
                <span key={`${person.name}-${person.role}`} className={`score-public-crew-member ${person.isYou ? "is-you" : ""}`}>
                  <span className="score-public-identity-dot" aria-hidden="true" />
                  <span>{person.name}</span>
                  <b>{person.role}</b>
                  {person.isYou && <em>You</em>}
                </span>
              ))}
            </div>
          )}
          <p className="score-public-meta mt-1 text-sm uppercase tracking-wider text-muted">
            {divisionLabel(g.division)} · {g.tier}
          </p>
        </div>
        <ScorePanel
          teams={[g.teamA, g.teamB]}
          field={g.field}
          scheduleLabel={scheduleLabel}
          role={roleLabel}
          keeper={keeperLabel}
          label={`${divisionLabel(g.division)} · ${g.tier}`}
          publicMode
        />
      </main>
    </div>
  );
}
