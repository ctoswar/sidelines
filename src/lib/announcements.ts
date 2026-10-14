// Announcements client.
//
// Organizer-published announcements live in Postgres behind
// /api/announcements. The author is the publishing session, set server-side —
// callers never send it. The seeded event pages keep their own read-only
// `event_details.announcements` strings; this table is the live channel shown
// in the player dashboard feed and the event hub.

import { jsonRequest, parse } from "./api-client";

export type Announcement = {
  id: string;
  slug: string;
  title: string;
  body: string;
  author: string;
  /** ISO timestamp. */
  at: string;
};

/** Latest announcements, newest first. Optionally filtered to one event. */
export async function fetchAnnouncements(options?: { slug?: string; limit?: number }): Promise<Announcement[]> {
  const params = new URLSearchParams();
  if (options?.slug) params.set("slug", options.slug);
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  const body = await parse<{ announcements: Announcement[] }>(
    await fetch(`/api/announcements${query ? `?${query}` : ""}`),
  );
  return body.announcements;
}

/** Publishes an announcement for an event (organizer only). */
export async function createAnnouncement(input: {
  slug: string;
  title: string;
  body: string;
}): Promise<Announcement> {
  const body = await parse<{ announcement: Announcement }>(
    await fetch("/api/announcements", jsonRequest(input)),
  );
  return body.announcement;
}

/** Deletes an announcement (organizer only). */
export async function deleteAnnouncement(id: string): Promise<void> {
  await parse<{ ok: boolean }>(
    await fetch(`/api/announcements/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}
