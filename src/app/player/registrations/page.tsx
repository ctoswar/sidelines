import { loadPlayerHistory, loadPlayerStats } from "@/server/stats";
import { requireRole } from "@/server/session";
import { MyEvents } from "./my-events";

export const metadata = { title: "My events – Sidelines" };
export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const user = await requireRole("player");
  // Computed server-side once per view: both tabs read the same match log.
  const [stats, history] = await Promise.all([loadPlayerStats(user.id), loadPlayerHistory(user.id)]);
  return <MyEvents stats={stats} history={history} viewerName={user.name} />;
}
