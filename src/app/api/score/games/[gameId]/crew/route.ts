// Save a game's crew names without minting tokens (typing in the queue form).
//
//   PUT /api/score/games/[gameId]/crew — { scorekeeper, umpire }
//
// Only the names are written; existing tokens stay valid until a token mint
// rotates them.

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import { saveCrewNames } from "@/server/score";
import { crewSchema } from "@/lib/validators/events";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers can manage game crew." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = crewSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Enter both crew names.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  const crew = await saveCrewNames(gameId, parsed.data);
  if (!crew) return NextResponse.json({ message: "Game not found." }, { status: 404 });

  return NextResponse.json({ crew });
}
