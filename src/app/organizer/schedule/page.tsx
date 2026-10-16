import { loadGames } from "@/server/schedule";
import { ScheduleView } from "./schedule-view";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const games = await loadGames();
  return <ScheduleView games={games} />;
}
