// Auto-fill the live tournament's schedule from its pool of entrants.
//
//   POST /api/schedule/autofill — { created, courts, slots }
//
// Organizer session. This replaces the button's old stub, which only showed a
// toast. It refuses instead of guessing — every reason it cannot fill is a
// state the caller can act on, and each refusal is a message the workspace
// surfaces verbatim:
//
//   401 not signed in · 403 not an organizer · 404 no live tournament
//   400 no courts on the event, fewer than two entrants, or a schedule that
//       already has matches (auto-fill never overwrites)

import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { buildSchedule } from "@/server/schedule";

export async function POST() {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers can fill the schedule." }, { status: 403 });
  }

  const [live] = await db
    .select()
    .from(t.tournaments)
    .where(eq(t.tournaments.status, "live"))
    .limit(1);
  if (!live) {
    return NextResponse.json(
      { message: "Create a tournament first — the schedule is built from the live tournament." },
      { status: 404 },
    );
  }

  // Courts are stored on the published event (see /api/tournaments/live).
  const [detail] = live.eventSlug
    ? await db
        .select({ fields: t.eventDetails.fields })
        .from(t.eventDetails)
        .where(eq(t.eventDetails.eventId, live.eventSlug))
        .limit(1)
    : [];
  const courts = detail?.fields ?? 0;
  if (courts < 1) {
    return NextResponse.json(
      { message: "Add courts when you create the tournament (step 2 of New tournament)." },
      { status: 400 },
    );
  }

  const teams = await db
    .select({
      name: t.tournamentTeams.name,
      pool: t.tournamentTeams.pool,
      seed: t.tournamentTeams.seed,
    })
    .from(t.tournamentTeams)
    .where(eq(t.tournamentTeams.tournamentId, live.id))
    .orderBy(asc(t.tournamentTeams.pool), asc(t.tournamentTeams.seed));
  if (teams.length < 2) {
    return NextResponse.json(
      { message: "Add at least two entrants on the Teams page first." },
      { status: 400 },
    );
  }

  const [own, total] = await Promise.all([
    db
      .select({ games: sql<number>`count(*)::int` })
      .from(t.games)
      .where(eq(t.games.tournamentId, live.id))
      .then(([row]) => row?.games ?? 0),
    db
      .select({ games: sql<number>`count(*)::int` })
      .from(t.games)
      .then(([row]) => row?.games ?? 0),
  ]);
  if (own > 0) {
    return NextResponse.json(
      { message: `The schedule already has ${own} match${own === 1 ? "" : "es"} — auto-fill only runs on an empty one.` },
      { status: 400 },
    );
  }

  const games = buildSchedule({
    tournamentId: live.id,
    courts,
    startTime: live.scheduleStart,
    idSeed: total,
    teams,
  });
  if (!games.length) {
    return NextResponse.json(
      { message: "Not enough entrants to pair up — add at least two on the Teams page." },
      { status: 400 },
    );
  }

  await db.insert(t.games).values(games);
  publish("schedule");

  return NextResponse.json({
    created: games.length,
    courts,
    slots: new Set(games.map((game) => game.time)).size,
  });
}
