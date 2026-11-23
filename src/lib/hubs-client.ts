// Browser client for the Discover API routes.
//
// Same shape as src/lib/tournaments.ts: typed wrappers over fetch, with the
// server's message promoted to an Error so the UI can show it verbatim.

import { jsonRequest, parse } from "./api-client";
import type {
  CheckoutQuote,
  HubCourtGrid,
  HubOpenPlaySession,
  HubVoucher,
  OpenPlayOrder,
} from "./hubs";

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

/** Books seats through the checkout: guest names + voucher, priced server-side. */
export async function bookOpenPlay(
  slug: string,
  input: { templateId: string; date: string; players: string[]; voucherCode: string },
): Promise<{ session: HubOpenPlaySession; order: OpenPlayOrder | null }> {
  return parse<{ session: HubOpenPlaySession; order: OpenPlayOrder | null }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/open-play`, jsonRequest(input)),
  );
}

/** Previews a voucher at the checkout's Apply button. */
export async function validateVoucher(
  slug: string,
  input: { templateId: string; playerCount: number; code: string },
): Promise<CheckoutQuote> {
  const body = await parse<{ quote: CheckoutQuote }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/vouchers/validate`, jsonRequest(input)),
  );
  return body.quote;
}

export async function fetchVouchers(slug: string): Promise<HubVoucher[]> {
  const body = await parse<{ vouchers: HubVoucher[] }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/vouchers`),
  );
  return body.vouchers;
}

export async function createVoucher(
  slug: string,
  input: { code: string; kind: "percent" | "amount"; value: number },
): Promise<HubVoucher> {
  const body = await parse<{ voucher: HubVoucher }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/vouchers`, jsonRequest(input)),
  );
  return body.voucher;
}

export async function setVoucherActive(
  slug: string,
  id: string,
  active: boolean,
): Promise<HubVoucher> {
  const body = await parse<{ voucher: HubVoucher }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/vouchers`, jsonRequest({ id, active })),
  );
  return body.voucher;
}

export async function sendHubMessage(slug: string, body: string): Promise<void> {
  await parse<{ ok: true }>(
    await fetch(`/api/hubs/${encodeURIComponent(slug)}/message`, jsonRequest({ body })),
  );
}
