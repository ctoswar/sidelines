import { loadOrganization } from "@/server/organizations";
import { loadGamesForOrganization } from "@/server/schedule";
import { requireRole } from "@/server/session";
import { ScorekeepersView } from "./scorekeepers-view";

export const dynamic = "force-dynamic";

export default async function ScorekeepersPage() {
  // Only this organizer's live schedule should appear in the QR queue.
  const user = await requireRole("organizer");
  const organization = await loadOrganization(user.id);
  const games = organization ? await loadGamesForOrganization(organization.id) : [];
  return <ScorekeepersView games={games} />;
}
