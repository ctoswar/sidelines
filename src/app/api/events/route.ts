// Event catalogue.
//
//   GET /api/events — every event with its live registration count.
//
// Open to anyone: the catalogue is public data, and the event hub list uses
// the counts to show signups per event.

import { NextResponse } from "next/server";
import { loadCatalogue } from "@/server/events";

export async function GET() {
  const events = await loadCatalogue();
  return NextResponse.json({ events });
}
