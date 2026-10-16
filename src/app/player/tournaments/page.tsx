import { loadOpenTournaments } from "@/server/events";
import { TournamentsView } from "./tournaments-view";

export const metadata = { title: "Find tournaments – Sidelines" };
export const dynamic = "force-dynamic";

export default async function FindTournamentsPage() {
  const tournaments = await loadOpenTournaments();
  return <TournamentsView tournaments={tournaments} />;
}
