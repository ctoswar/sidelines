import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { PlayerHistoryView, PlayerStatsView } from "@/components/stats/player-stats-view";
import { loadOrganization } from "@/server/organizations";
import { loadOrganizerPlayer } from "@/server/stats";
import { requireRole } from "@/server/session";

export const dynamic = "force-dynamic";

/** One player's full stats + history, as the organizer sees it. */
export default async function OrganizerPlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("organizer");
  const organization = await loadOrganization(user.id);
  if (!organization) notFound();

  const { id } = await params;
  const player = await loadOrganizerPlayer(organization.id, id);
  if (!player) notFound();

  return (
    <>
      <PageHeader
        title={player.name}
        subtitle={`Player profile · ${organization.name}`}
      />
      <Link href="/organizer/players" className="text-sm font-bold text-muted hover:text-fg">
        &larr; All players
      </Link>
      <div className="mt-4 space-y-6">
        <PlayerStatsView stats={player.stats} name={player.name} />
        <PlayerHistoryView history={player.history} teamName={player.stats.teamName} />
      </div>
    </>
  );
}
