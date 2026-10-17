// Tournament status.
//
//   PATCH /api/tournaments/[id] — { status: "live" | "draft" }
//
// The workspace reads "the live tournament" in several places (schedule start,
// pool table, scoring), so exactly one tournament is live at a time: the
// requested status is written first, then every other live tournament returns
// to draft, in one transaction. Like the rest of the organizer API, the check
// is the caller's role — tournaments are not individually owned.

import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { tournamentStatusSchema } from "@/lib/validators/tournaments";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers manage tournaments." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });

  const parsed = tournamentStatusSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the status.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  // The target row is written first so a mistyped id fails before anything
  // else moves; going live then returns every other live tournament to draft,
  // in the same transaction, leaving exactly one live.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(t.tournaments)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(t.tournaments.id, id))
      .returning();
    if (!row) return null;
    if (parsed.data.status === "live") {
      await tx
        .update(t.tournaments)
        .set({ status: "draft", updatedAt: new Date() })
        .where(and(eq(t.tournaments.status, "live"), ne(t.tournaments.id, row.id)));
    }
    return row;
  });

  if (!updated) {
    return NextResponse.json({ message: "Tournament not found." }, { status: 404 });
  }

  publish("schedule");
  return NextResponse.json({
    tournament: {
      id: updated.id,
      name: updated.name,
      meta: updated.meta,
      status: updated.status,
      scheduleStart: updated.scheduleStart,
    },
  });
}
