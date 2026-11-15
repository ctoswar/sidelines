import { inArray } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { loadCatalogue } from "@/server/events";
import { ownedOrganizationIds } from "@/server/ownership";
import { requireRole } from "@/server/session";
import { EventsView } from "./events-view";

export const dynamic = "force-dynamic";

export default async function OrganizerEventsPage() {
  const user = await requireRole("organizer");

  // The hub lists the events this organizer's organization published — not
  // every event on the site (registrations and announcements inside each hub
  // are theirs alone). Admins keep the full catalogue view.
  const all = await loadCatalogue();
  if (user.role === "admin") return <EventsView events={all} />;

  const orgIds = await ownedOrganizationIds(user.id);
  if (orgIds.length === 0) return <EventsView events={[]} />;

  const published = await db
    .select({ eventSlug: t.tournaments.eventSlug })
    .from(t.tournaments)
    .where(inArray(t.tournaments.organizationId, orgIds));
  const mine = new Set(
    published.map((row) => row.eventSlug).filter((slug): slug is string => Boolean(slug)),
  );

  return <EventsView events={all.filter((event) => mine.has(event.slug))} />;
}
