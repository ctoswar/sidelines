import { loadOrganization } from "@/server/organizations";
import { loadGamesForOrganization } from "@/server/schedule";
import { requireRole } from "@/server/session";
import { ScheduleView } from "./schedule-view";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  // Scope the schedule to this organizer's own live tournament.
  const user = await requireRole("organizer");
  const organization = await loadOrganization(user.id);
  const games = organization ? await loadGamesForOrganization(organization.id) : [];
  return <ScheduleView games={games} />;
}
