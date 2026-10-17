// Pool-table removal.
//
//   DELETE /api/tournaments/teams/[name] — remove one entrant from the pool
//
// The pool belongs to the one live tournament; the entrant is identified by
// its name, which is unique within a tournament (the `tournament_teams_slot_idx`
// unique index). Organizers only, like the rest of the workspace writes.

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { loadLiveTournament, removeEntrant, syncEventTeamCount } from "@/server/pool";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers manage the pool." }, { status: 403 });
  }

  const { name } = await params;
  const decoded = decodeURIComponent(name).trim();
  if (!decoded) return NextResponse.json({ message: "Name an entrant to remove." }, { status: 400 });

  const live = await loadLiveTournament();
  if (!live) return NextResponse.json({ message: "There is no live tournament." }, { status: 404 });

  const removed = await removeEntrant(live.id, decoded);
  if (!removed) {
    return NextResponse.json({ message: `"${decoded}" is not in the pool.` }, { status: 404 });
  }

  await syncEventTeamCount(live.id, live.eventSlug);
  publish("schedule");
  return NextResponse.json({ removed: true });
}
