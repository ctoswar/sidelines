// Event detail.
//
//   GET /api/events/[slug] — the full EventDetail aggregate from the DB.
//
// Serves the copy seeded into `event_details`, which the harness verifies is
// identical to what the (statically prerendered) event pages render. Pages
// still read the static modules — they build without a database — so this
// route is the DB-backed surface consumers migrate onto.

import { NextResponse } from "next/server";
import { loadEventDetail } from "@/server/events";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const detail = await loadEventDetail(slug);
  if (!detail) return NextResponse.json({ message: "Event not found." }, { status: 404 });
  return NextResponse.json({ detail });
}
