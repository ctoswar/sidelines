// Live-tournament schedule configuration.
//
//   GET /api/tournaments/live — the schedule's first slot (organizer workspace)
//   PUT /api/tournaments/live — set it, "HH:MM" 24h
//
// This was the schedule-start localStorage key. The value hangs off the one
// tournament seeded with live status; the public score pages never call this
// because the QR URL carries ?scheduleStart= for a scanned phone to render
// from without a session.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { scheduleStartSchema } from "@/lib/validators/tournaments";

async function organizerOrError() {
  const user = await getServerSessionUser();
  if (!user) return { error: NextResponse.json({ message: "Sign in first." }, { status: 401 }) };
  if (user.role !== "organizer") {
    return { error: NextResponse.json({ message: "Only organizers configure the schedule." }, { status: 403 }) };
  }
  return { user };
}

/** The one seeded schedule belongs to the tournament with live status. */
async function liveTournament() {
  const [row] = await db
    .select()
    .from(t.tournaments)
    .where(eq(t.tournaments.status, "live"))
    .limit(1);
  return row ?? null;
}

type TournamentRow = NonNullable<Awaited<ReturnType<typeof liveTournament>>>;

function toTournamentWire(row: TournamentRow) {
  return { id: row.id, name: row.name, scheduleStart: row.scheduleStart };
}

export async function GET() {
  const { error } = await organizerOrError();
  if (error) return error;

  const row = await liveTournament();
  if (!row) return NextResponse.json({ message: "No live tournament to configure." }, { status: 404 });
  return NextResponse.json({ tournament: toTournamentWire(row) });
}

export async function PUT(request: Request) {
  const { error } = await organizerOrError();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });

  const parsed = scheduleStartSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the start time.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  const existing = await liveTournament();
  if (!existing) return NextResponse.json({ message: "No live tournament to configure." }, { status: 404 });

  const [updated] = await db
    .update(t.tournaments)
    .set({ scheduleStart: parsed.data.scheduleStart, updatedAt: new Date() })
    .where(eq(t.tournaments.id, existing.id))
    .returning();
  if (!updated) return NextResponse.json({ message: "No live tournament to configure." }, { status: 404 });

  return NextResponse.json({ tournament: toTournamentWire(updated) });
}
