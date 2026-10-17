// Pool-table writes — the real version of the placeholder buttons.
//
//   POST   /api/tournaments/teams — add entrants to the live tournament's pool
//   DELETE /api/tournaments/teams/[name] — remove one entrant by name
//
// The workspace configures exactly one live tournament, so these routes take
// no tournament id: the caller is an organizer and the pool is the live one's.
// Pickleball players register solo, so an entrant is usually one player's name
// (see src/server/pool.ts); either way it is one seeded slot in a pool.
//
// Writes publish the "schedule" topic so the schedule pages re-read, and keep
// the published event's team count in step with the pool.

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { addEntrants, loadLiveTournament, syncEventTeamCount } from "@/server/pool";
import { teamImportSchema } from "@/lib/validators/tournaments";

async function organizerOrError() {
  const user = await getServerSessionUser();
  if (!user) return { error: NextResponse.json({ message: "Sign in first." }, { status: 401 }) };
  if (user.role !== "organizer") {
    return { error: NextResponse.json({ message: "Only organizers manage the pool." }, { status: 403 }) };
  }
  return { user };
}

export async function POST(request: Request) {
  const { error } = await organizerOrError();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });

  const parsed = teamImportSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the entrants.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  const live = await loadLiveTournament();
  if (!live) {
    return NextResponse.json(
      { message: "There is no live tournament to add players to. Create one first." },
      { status: 404 },
    );
  }

  const result = await addEntrants(live.id, parsed.data.teams, parsed.data.source ?? "manual");
  await syncEventTeamCount(live.id, live.eventSlug);
  publish("schedule");

  return NextResponse.json({
    added: result.added,
    skipped: result.skipped,
    teams: result.added.length + result.skipped.length,
  });
}
