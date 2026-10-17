// Player team profile API.
//
//   GET /api/team — the signed-in player's team (neutral defaults until saved)
//   PUT /api/team — full update of the six editable fields
//
// The banner is deliberately absent from the body: images travel through the
// multipart /api/team/banner endpoint (same contract as the Phase 3 profile
// photo), so a JSON save can never smuggle a data URL into the database.

import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/server/session";
import { teamUpdateSchema } from "@/lib/validators/team";
import { loadTeamRow, toTeamWire, writeTeam } from "@/server/team";

async function playerOrError() {
  const user = await getServerSessionUser();
  if (!user) return { error: NextResponse.json({ message: "Sign in first." }, { status: 401 }) };
  if (user.role !== "player") {
    return { error: NextResponse.json({ message: "Only players have a team profile." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const { user, error } = await playerOrError();
  if (error) return error;
  return NextResponse.json({ team: toTeamWire(await loadTeamRow(user.id)) });
}

export async function PUT(request: Request) {
  const { user, error } = await playerOrError();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });

  const parsed = teamUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the form and try again.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  const row = await writeTeam(user.id, parsed.data);
  return NextResponse.json({ team: toTeamWire(row) });
}
