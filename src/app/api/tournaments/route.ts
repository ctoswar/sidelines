// Tournament creation.
//
//   POST /api/tournaments — create one for the signed-in organizer
//
// The wizard used to pretend it created something: it collected a name and
// dates, then only set the schedule start of whichever tournament was already
// live, so a clean database dead-ended with 404 "No live tournament to
// configure". This is the real write. The row lands in the organizer's own
// organization, and creating it as live makes it the tournament the rest of
// the workspace configures — the schedule start, pool table, and scoring all
// read "the live tournament", so there is exactly one: any other live
// tournament returns to draft.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { describeTournament } from "@/lib/tournament-meta";
import { tournamentCreateSchema } from "@/lib/validators/tournaments";

export async function POST(request: Request) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers create tournaments." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });

  const parsed = tournamentCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the tournament details.", path: first?.path.join(".") },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // The organizer's own organization, when they have one; the schema allows a
  // tournament without one, so this is a best effort rather than a gate.
  const [organization] = await db
    .select({ id: t.organizations.id })
    .from(t.organizations)
    .where(eq(t.organizations.ownerUserId, user.id))
    .limit(1);

  // Going live means demoting the current live tournament first; both writes
  // share a transaction so an interruption can't clear the live slot and
  // leave nothing in it.
  const created = await db.transaction(async (tx) => {
    if (input.status === "live") {
      await tx
        .update(t.tournaments)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(t.tournaments.status, "live"));
    }
    const [row] = await tx
      .insert(t.tournaments)
      .values({
        organizationId: organization?.id ?? null,
        name: input.name,
        meta: describeTournament(input),
        status: input.status ?? "draft",
        scheduleStart: input.scheduleStart,
      })
      .returning();
    return row;
  });

  if (!created) {
    return NextResponse.json({ message: "Could not create the tournament. Try again." }, { status: 500 });
  }

  publish("schedule");
  return NextResponse.json(
    {
      tournament: {
        id: created.id,
        name: created.name,
        meta: created.meta,
        status: created.status,
        scheduleStart: created.scheduleStart,
      },
    },
    { status: 201 },
  );
}
