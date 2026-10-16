import { loadGames } from "@/server/schedule";
import { ScorekeepersView } from "./scorekeepers-view";

export const dynamic = "force-dynamic";

export default async function ScorekeepersPage() {
  const games = await loadGames();
  return <ScorekeepersView games={games} />;
}
