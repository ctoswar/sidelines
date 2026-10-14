// Crew names for every game (organizer workspace feed).
//
//   GET /api/score/games — { crew: { [gameId]: { scorekeeper, umpire } } }

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import { getGameCrewMap } from "@/server/score";

export async function GET() {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers can manage game crew." }, { status: 403 });
  }

  return NextResponse.json({ crew: await getGameCrewMap() });
}
