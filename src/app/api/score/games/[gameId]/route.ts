// Submit a final score for a game.
//
//   POST /api/score/games/[gameId] — { score: "11–7" }
//
// Two credentials can write, in priority order:
//
//   1. `Authorization: Bearer <token>` — the capability token from the
//      scorekeeper QR code. It must resolve to a crew slot on THIS game; a
//      token minted for another game is rejected (403), an unknown or
//      rotated token is rejected (401).
//   2. An organizer session — the workspace's own score page.
//
// Signed-out and player sessions without a token get nothing: this is the
// endpoint the QR capability exists to protect.

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import { resolveScoreToken, writeGameResult } from "@/server/score";
import { resultSchema } from "@/lib/validators/events";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (bearer) {
    const grant = await resolveScoreToken(bearer);
    if (!grant) {
      return NextResponse.json(
        { message: "That scoring link is not valid." },
        { status: 401 },
      );
    }
    if (grant.gameId !== gameId) {
      return NextResponse.json(
        { message: "That scoring link is for a different game." },
        { status: 403 },
      );
    }
  } else {
    const user = await getServerSessionUser();
    if (!user) {
      return NextResponse.json(
        { message: "Sign in first, or scan the game's QR code." },
        { status: 401 },
      );
    }
    if (user.role !== "organizer") {
      return NextResponse.json(
        { message: "Only organizers or the game's crew can submit results." },
        { status: 403 },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the score and try again.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  const result = await writeGameResult(gameId, parsed.data.score);
  if (!result) {
    return NextResponse.json({ message: "Game not found." }, { status: 404 });
  }

  return NextResponse.json({ result });
}
