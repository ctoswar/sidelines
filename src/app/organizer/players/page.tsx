import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { loadOrganization } from "@/server/organizations";
import { loadOrganizerPlayers } from "@/server/stats";
import { requireRole } from "@/server/session";

export const metadata = { title: "Players – Sidelines" };
export const dynamic = "force-dynamic";

/**
 * The organizer's players directory: everyone registered to one of the
 * organization's events, plus anyone whose saved team played its games, each
 * with the same stats math the player workspace shows.
 */
export default async function OrganizerPlayersPage() {
  const user = await requireRole("organizer");
  const organization = await loadOrganization(user.id);
  const players = organization ? await loadOrganizerPlayers(organization.id) : [];

  return (
    <>
      <PageHeader
        title="Players"
        subtitle={
          organization
            ? `${organization.name} · players registered to your events or matched against your teams`
            : "Your organization's players"
        }
      />
      {!organization ? (
        <div className="rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-bold">No organization yet</p>
          <p className="mt-1 text-muted">Finish setting up your organizer profile to see your players.</p>
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-bold">No players yet</p>
          <p className="mt-1 text-muted">
            When players register to your events or face your teams, they appear here with their record.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-card">
          {players.map((player) => (
            <Link
              key={player.userId}
              href={`/organizer/players/${player.userId}`}
              className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <p className="font-bold">{player.name}</p>
                <p className="text-sm text-muted">
                  {player.teamName ? `Playing as ${player.teamName}` : "No team profile"} ·{" "}
                  {player.email}
                </p>
              </div>
              <div className="flex items-center gap-5 text-sm">
                <span className="text-muted">
                  <b className="text-fg tabular-nums">{player.matches}</b> match{player.matches === 1 ? "" : "es"}
                </span>
                <span className="text-muted">
                  <b className="text-fg tabular-nums">{player.wins}-{player.losses}</b> record
                </span>
                <span className="text-muted">
                  <b className="text-fg tabular-nums">{player.winRate}%</b> win rate
                </span>
                <span className="text-muted">
                  <b className="text-fg tabular-nums">{player.pointsPerGame.toFixed(2)}</b> pts/game
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
