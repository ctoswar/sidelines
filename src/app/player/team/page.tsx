import { loadRoster } from "@/server/team";
import { TeamView } from "./team-view";

export const metadata = { title: "My team – Sidelines" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const roster = await loadRoster();
  return <TeamView roster={roster} />;
}
