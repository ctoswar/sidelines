import { loadTournamentTeams } from "@/server/schedule";
import { TeamsView } from "./teams-view";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await loadTournamentTeams();
  return <TeamsView teams={teams} />;
}
