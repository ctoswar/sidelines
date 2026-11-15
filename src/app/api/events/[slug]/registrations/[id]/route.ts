// Organizer-side registration removal (the hub's "Remove" button).
//
//   DELETE /api/events/[slug]/registrations/[id]

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { eventExists } from "@/server/events";
import { canManageEvent } from "@/server/ownership";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers can manage registrations." }, { status: 403 });
  }
  if (!(await eventExists(slug))) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }
  // Removing an entrant is a write on another person's registration: only the
  // event's own organizer (or an admin) may do it.
  if (!(await canManageEvent(user, slug))) {
    return NextResponse.json({ message: "This event is not yours to manage." }, { status: 403 });
  }

  const deleted = await db
    .delete(t.registrations)
    .where(and(eq(t.registrations.eventSlug, slug), eq(t.registrations.id, id)))
    .returning({ id: t.registrations.id });

  if (deleted.length === 0) {
    return NextResponse.json({ message: "Registration not found." }, { status: 404 });
  }
  publish("registrations");
  return NextResponse.json({ ok: true });
}
