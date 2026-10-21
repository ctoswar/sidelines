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
import { setEventFeatured, setEventLive } from "@/server/publish";
import { tournamentFeaturedSchema, tournamentStatusSchema } from "@/lib/validators/tournaments";

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

  // Two shapes reach this route: a status flip (make live / save as draft)
  // and a Spotlight toggle. They are separate fields so the client can send
  // either without the other, and neither schema accepts a stray body.
  if ("featured" in body) {
    const parsed = tournamentFeaturedSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { message: first?.message ?? "Check the Spotlight flag.", path: first?.path.join(".") },
        { status: 400 },
      );
    }

    const [row] = await db
      .select({ id: t.tournaments.id, eventSlug: t.tournaments.eventSlug })
      .from(t.tournaments)
      .where(eq(t.tournaments.id, id))
      .limit(1);
    if (!row) return NextResponse.json({ message: "Tournament not found." }, { status: 404 });
    // A draft has no catalogue row to curate yet; the toggle is a no-op until
    // the tournament is live and published.
    if (!row.eventSlug) {
      return NextResponse.json(
        { message: "This tournament has no public event yet — make it live first." },
        { status: 409 },
      );
    }

    // No realtime publish: the homepage is a force-dynamic server render that
    // re-reads the catalogue per request, and nothing subscribes to a
    // catalogue topic. The organizer view re-reads via router.refresh().
    await db.transaction(async (tx) => setEventFeatured(tx, row.eventSlug, parsed.data.featured));
    return NextResponse.json({ tournament: { id: row.id, featured: parsed.data.featured } });
  }

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
      const demoted = await tx
        .update(t.tournaments)
        .set({ status: "draft", updatedAt: new Date() })
        .where(and(eq(t.tournaments.status, "live"), ne(t.tournaments.id, row.id)))
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
