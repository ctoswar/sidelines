import { LoadingScreen } from "@/components/ui/loading-screen";

/** Same deal as the player one: the organizer shell stays put, only the page swaps. */
export default function Loading() {
  return <LoadingScreen label="Opening the organizer workspace" />;
}
