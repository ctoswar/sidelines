// Browser client for the Discover API routes.
//
// Same shape as src/lib/tournaments.ts: typed wrappers over fetch, with the
// server's message promoted to an Error so the UI can show it verbatim.

import { jsonRequest, parse } from "./api-client";
import type { HubCourtGrid, HubOpenPlaySession } from "./hubs";

export type FollowState = { following: boolean; followers: number };

export async function setHubFollow(slug: string, following: boolean): Promise<FollowState> {
  return parse<FollowState>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/follow`, {
      method: following ? "DELETE" : "POST",
    }),
  );
}

export async function fetchCourtGrid(slug: string, date: string): Promise<HubCourtGrid> {
  const body = await parse<{ grid: HubCourtGrid }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/courts?date=${encodeURIComponent(date)}`),
  );
  return body.grid;
}

export async function bookCourt(
  slug: string,
  input: { courtId: string; date: string; startTime: string },
): Promise<{ bookingId: string; grid: HubCourtGrid }> {
  return parse<{ bookingId: string; grid: HubCourtGrid }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/courts`, jsonRequest(input)),
  );
}

export async function cancelCourtBooking(
  slug: string,
  bookingId: string,
  date: string,
): Promise<HubCourtGrid> {
  const body = await parse<{ grid: HubCourtGrid }>(
    await fetch(
      `/api/hubs/${encodeURIComponent(slug)}/courts?bookingId=${encodeURIComponent(bookingId)}&date=${encodeURIComponent(date)}`,
      { method: "DELETE" },
    ),
  );
  return body.grid;
}

export async function setOpenPlayJoin(
  slug: string,
  session: Pick<HubOpenPlaySession, "templateId" | "date" | "joined">,
): Promise<HubOpenPlaySession> {
  const query = `templateId=${encodeURIComponent(session.templateId)}&date=${encodeURIComponent(session.date)}`;
  const body = await parse<{ session: HubOpenPlaySession }>(
    await fetch(
      `/api/hubs/${encodeURIComponent(slug)}/open-play${session.joined ? `?${query}` : ""}`,
      session.joined ? { method: "DELETE" } : jsonRequest({ templateId: session.templateId, date: session.date }),
    ),
  );
  return body.session;
}

export async function sendHubMessage(slug: string, body: string): Promise<void> {
  await parse<{ ok: true }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/message`, jsonRequest({ body })),
  );
}
