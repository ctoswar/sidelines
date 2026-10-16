import { loadCatalogue } from "@/server/events";
import { EventsView } from "./events-view";

export const dynamic = "force-dynamic";

export default async function OrganizerEventsPage() {
  const events = await loadCatalogue();
  return <EventsView events={events} />;
}
