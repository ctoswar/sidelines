import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { loadTournaments } from "@/server/schedule";
import { TournamentActions } from "./tournament-actions";

export const metadata = { title: "Tournaments – Sidelines" };
export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const tournaments = await loadTournaments();
  return (
    <>
      <PageHeader
        title="Tournaments"
        subtitle={
          tournaments.length
            ? `${tournaments.length} tournament${tournaments.length === 1 ? "" : "s"}`
            : "No tournaments yet — create the first one"
        }
      >
        <Link href="/organizer/tournaments/new" className="btn btn-pri">New tournament</Link>
      </PageHeader>
      <div className="divide-y divide-line rounded-lg border border-line bg-card">
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{tournament.name}</p>
              <p className="text-sm text-muted">{tournament.meta || "No dates yet"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-bold ${tournament.status === "Live" ? "text-flag" : "text-muted"}`}>
                {tournament.status}
              </span>
              <TournamentActions
                id={tournament.id}
                status={tournament.status}
                featured={tournament.featured}
                hasEvent={Boolean(tournament.eventSlug)}
              />
            </div>
          </div>
        ))}
        {tournaments.length === 0 && (
          <p className="p-4 text-sm text-muted">
            Nothing here yet — New tournament creates one and makes it the live tournament the
            schedule and scoring use.
          </p>
        )}
      </div>
    </>
  );
}
