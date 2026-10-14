// Saved final scores, keyed by game id.
//
//   GET /api/score/results — { results: { [gameId]: { score, completedAt } } }
//
// Open: scores are public scoreboard data. The schedule overlays these on
// the seeded schedule; the write side lives behind capability tokens.

import { NextResponse } from "next/server";
import { listGameResults } from "@/server/score";

export async function GET() {
  return NextResponse.json({ results: await listGameResults() });
}
