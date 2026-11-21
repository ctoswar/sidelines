// Tournament status.
//
//   PATCH /api/tournaments/[id] — { status: "live" | "draft" }
//
// The workspace reads "the live tournament" in several places (schedule start,
// pool table, scoring), so exactly one tournament is live per organization: the
// requested status is written first, then every other live tournament of the
// SAME organization returns to draft, in one transaction. Ownership is checked
// with canManageTournament before anything moves - account A can never flip
// account B's tournament.
//
// The homepage Spotlight toggle used to live here too. It is gone: curation is
// a site decision, so it moved to PATCH /api/admin/events/[slug], which only
// accepts the admin role. Organizers publish; admins decide what is featured.

import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { setEventLive } from "@/server/publish";
import { canManageTournament } from "@/server/ownership";
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
  // Flipping someone else's tournament to draft (and unlisting its event)
  // must be impossible: ownership is verified before anything moves.
  if (!(await canManageTournament(user, id))) {
    return NextResponse.json({ message: "Tournament not found." }, { status: 404 });
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
      // "Exactly one live" is per organization, not global: account A making
      // its tournament live must not demote account B's live tournament.
      const demoted = await tx
        .update(t.tournaments)
        .set({ status: "draft", updatedAt: new Date() })
        .where(
          and(
            eq(t.tournaments.status, "live"),
            ne(t.tournaments.id, row.id),
            row.organizationId
              ? eq(t.tournaments.organizationId, row.organizationId)
              : isNull(t.tournaments.organizationId),
          ),
        )
        .returning({ eventSlug: t.tournaments.eventSlug });
      // Their events stop advertising "Live now" along with them.
      for (const other of demoted) await setEventLive(tx, other.eventSlug, false);
    }
    // The public catalogue reads events.live, not tournaments.status.
    await setEventLive(tx, row.eventSlug, parsed.data.status === "live");
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
