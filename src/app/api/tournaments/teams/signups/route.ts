// Build the pool from event registrations — the pickleball-native path.
//
//   POST /api/tournaments/teams/signups
//
// Players register solo for a pickleball draw, so the pool table should be
// buildable straight from the signups instead of typed in by hand. This reads
// the live tournament's published event registrations and adds each registrant
// as one seeded entrant under their own name, alternating pools A/B down the
// signup order. Registrants already in the pool are skipped, so clicking it
// again after a new signup only adds the newcomer.
//
// The link is tournaments.eventSlug: a live tournament publishes an event (see
// src/server/publish.ts), and that event owns the registrations.

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { bridgeSignups, loadLiveTournament, syncEventTeamCount } from "@/server/pool";

export async function POST() {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers manage the pool." }, { status: 403 });
  }

  const live = await loadLiveTournament();
  if (!live) {
    return NextResponse.json(
      { message: "There is no live tournament to build a pool for." },
      { status: 404 },
    );
  }
  if (!live.eventSlug) {
    return NextResponse.json(
      { message: "This tournament has no published event yet, so there are no signups to pull." },
      { status: 409 },
    );
  }

  const result = await bridgeSignups(live.id, live.eventSlug);

  if (result.candidates === 0) {
    return NextResponse.json(
      { message: "No one has registered for this event yet.", added: [], skipped: [], candidates: 0 },
      { status: 200 },
    );
  }

  await syncEventTeamCount(live.id, live.eventSlug);
  publish("schedule");

  return NextResponse.json({
    added: result.added,
    skipped: result.skipped,
    candidates: result.candidates,
  });
}
