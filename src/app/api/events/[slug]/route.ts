// Event detail.
//
//   GET /api/events/[slug] — the full EventDetail aggregate from the DB.
//
// Serves the copy seeded into `event_details`; since Phase 6 this is the same
// loadEventDetail the event pages render from, so the API and the page can
// never disagree. The harness still verifies the DB copy against the static
// modules the seed loads from.

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
