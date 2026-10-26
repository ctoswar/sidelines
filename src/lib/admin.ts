// Admin API client — the calls only the /admin workspace makes.
//
// Separate from src/lib/tournaments.ts for the same reason the routes are
// separate: the organizer client must have no function that can curate the
// Spotlight, so nobody can wire one back into the workspace by accident.

import { parse } from "./api-client";

/**
 * Adds a published event to (or removes it from) the homepage Spotlight.
 * Admin session — the route answers 403 for any other role.
 */
export async function setEventFeatured(slug: string, featured: boolean): Promise<void> {
  await parse(
    await fetch(`/api/admin/events/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured }),
    }),
  );
}
