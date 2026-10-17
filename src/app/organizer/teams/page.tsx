import { loadPoolView } from "@/server/schedule";
import { TeamsView } from "./teams-view";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const view = await loadPoolView();
  return <TeamsView view={view} />;
}
