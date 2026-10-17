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
//
// A live tournament is also published: the same transaction writes the
// `events` + `event_details` pair the Event hub list, the public event page,
// registrations and announcements all read (see src/server/publish.ts). The
// tournament row keeps no dates, so this is the only moment it can be named.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { describeTournament } from "@/lib/tournament-meta";
import { splitPlace, publishTournamentEvent } from "@/server/publish";
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
  // tournament without one, so this is a best effort rather than a gate. Its
  // city is where the tournament is listed when the wizard's place is skipped.
  const [organization] = await db
    .select({ id: t.organizations.id, city: t.organizations.city })
    .from(t.organizations)
    .where(eq(t.organizations.ownerUserId, user.id))
    .limit(1);

  // The place the public event is listed under. The wizard asks for it; a
  // caller that does not gets the organization's own city ("Manila,
  // Philippines" splits into the pair the event card renders).
  const [orgCity, orgCountry] = splitPlace(organization?.city ?? "");
  const city = input.city || orgCity || "TBD";
  const country = input.country || orgCountry;

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
    if (!row) return null;

    // Publish the event in the same transaction: a live tournament is listed
    // on the hub and the public site from the moment it exists. The published
    // slug is written back onto the tournament row so the pool table can pull
    // this event's registrations (see src/server/pool.ts).
    const event =
      row.status === "live"
        ? await publishTournamentEvent(tx, {
            tournamentId: row.id,
            name: input.name,
            startDate: input.startDate,
            endDate: input.endDate,
            courts: input.courts,
            divisions: input.divisions,
            scheduleStart: input.scheduleStart,
            city,
            country,
          })
        : null;

    if (event) {
      await tx
        .update(t.tournaments)
        .set({ eventSlug: event.slug, updatedAt: new Date() })
        .where(eq(t.tournaments.id, row.id));
      row.eventSlug = event.slug;
    }

    return { row, event };
  });

  if (!created) {
    return NextResponse.json({ message: "Could not create the tournament. Try again." }, { status: 500 });
  }

  publish("schedule");
  return NextResponse.json(
    {
      tournament: {
        id: created.row.id,
        name: created.row.name,
        meta: created.row.meta,
        status: created.row.status,
        scheduleStart: created.row.scheduleStart,
        // The hub and public link, when this tournament was published.
        eventSlug: created.event?.slug ?? null,
      },
    },
    { status: 201 },
  );
}
