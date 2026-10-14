// Mint (or rotate) a game's capability tokens — the QR queue's "Generate".
//
//   POST /api/score/games/[gameId]/tokens — { scorekeeper, umpire }
//   -> { scoreToken, umpireToken }   (returned exactly once, raw)
//
// Both names are required, same as the queue button. Every mint produces
// fresh tokens, so re-generating a game revokes the QR codes already printed.

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import { mintGameTokens } from "@/server/score";
import { crewSchema } from "@/lib/validators/events";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;

  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers can issue scoring links." }, { status: 403 });
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

  const tokens = await mintGameTokens(gameId, parsed.data);
  if (!tokens) return NextResponse.json({ message: "Game not found." }, { status: 404 });

  return NextResponse.json(tokens);
}
