// Court grid + bookings for a SportsHub.
//
//   GET    /api/hubs/[slug]/courts?date=YYYY-MM-DD  — one day's grid
//   POST   /api/hubs/[slug]/courts                  — { courtId, date, startTime }
//   DELETE /api/hubs/[slug]/courts?bookingId=…      — cancel your own slot
//
// The grid is always scoped to the signed-in player: another account's slot
// renders as "booked", never "mine". The POST relies on the unique
// (court, date, start) index, so two simultaneous clicks cannot double-book.

import { NextResponse } from "next/server";
import {
  cancelHubBooking,
  createHubBooking,
  hubForBooking,
  loadCourtGrid,
} from "@/server/hubs";
import { getServerSessionUser } from "@/server/session";
import { isoDate } from "@/lib/hubs";

function validDate(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : isoDate();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const { slug } = await params;
  const hub = await hubForBooking(slug);
  if (!hub) return NextResponse.json({ message: "SportsHub not found." }, { status: 404 });

  const date = validDate(new URL(request.url).searchParams.get("date"));
  return NextResponse.json({ grid: await loadCourtGrid(hub, date, user.id) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const { slug } = await params;
  const hub = await hubForBooking(slug);
  if (!hub) return NextResponse.json({ message: "SportsHub not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const courtId = typeof body?.courtId === "string" ? body.courtId : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const startTime = typeof body?.startTime === "string" ? body.startTime : "";
  if (!courtId || !date || !startTime) {
    return NextResponse.json({ message: "Pick a court, date and time." }, { status: 400 });
  }

  const result = await createHubBooking({
    hub,
    courtId,
    date,
    startTime,
    userId: user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
  return NextResponse.json({ bookingId: result.bookingId, grid: result.grid });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const { slug } = await params;
  const hub = await hubForBooking(slug);
  if (!hub) return NextResponse.json({ message: "SportsHub not found." }, { status: 404 });

  const bookingId = new URL(request.url).searchParams.get("bookingId") ?? "";
  if (!bookingId) {
    return NextResponse.json({ message: "Which booking should be cancelled?" }, { status: 400 });
  }
  const cancelled = await cancelHubBooking(bookingId, user.id);
  if (!cancelled) {
    return NextResponse.json({ message: "That booking is not yours to cancel." }, { status: 404 });
  }
  const date = validDate(new URL(request.url).searchParams.get("date"));
  return NextResponse.json({ ok: true, grid: await loadCourtGrid(hub, date, user.id) });
}
