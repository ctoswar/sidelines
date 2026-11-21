import { loadOrganization } from "@/server/organizations";
import { loadPoolView } from "@/server/schedule";
import { requireRole } from "@/server/session";
import { TeamsView } from "./teams-view";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  // The pool table belongs to this organizer's live tournament only.
  const user = await requireRole("organizer");
  const organization = await loadOrganization(user.id);
  const view = await loadPoolView(organization?.id);
  return <TeamsView view={view} />;
}
