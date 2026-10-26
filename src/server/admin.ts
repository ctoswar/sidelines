// Admin reads over the public catalogue.
//
// The Spotlight page is the only screen that writes `events.featured`, so it
// reads the catalogue the same way the homepage does: every published event
// with its flag, already carrying the fields the marquee renders. Featured
// events sort first, so the page reads top-down exactly as the homepage leads.

import { desc } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { eventRowToItem } from "@/server/events";
import type { EventItem } from "@/types";

export type SpotlightEvent = Pick<
  EventItem,
  "slug" | "name" | "start" | "end" | "city" | "country" | "live" | "featured"
>;

/** Every published event, currently-in-Spotlight first, then by start date. */
export async function loadSpotlightEvents(): Promise<SpotlightEvent[]> {
  const rows = await db
    .select()
    .from(t.events)
    .orderBy(desc(t.events.featured), desc(t.events.startDate), t.events.name);

  return rows.map((row) => {
    const event = eventRowToItem(row);
    return {
      slug: event.slug,
      name: event.name,
      start: event.start,
      end: event.end,
      city: event.city,
      country: event.country,
      live: event.live,
      featured: event.featured,
    };
  });
}
