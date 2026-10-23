// Event registrations.
//
//   GET    /api/events/[slug]/registrations — public state + organizer list
//   POST   /api/events/[slug]/registrations — register the signed-in user
//   DELETE /api/events/[slug]/registrations — unregister the signed-in user
//
// GET is open so a signed-out spectator still renders the right badge
// (count + registered:false + no division). The full list is only included
// for organizers — everyone else gets `registrations: null`. POST requires
// the division the registrant picked (mens | womens | mixed) and answers
// with the fresh count + flag + division, so the button flips from the
// server's answer rather than optimistic state.
//
// The unique index on (event_slug, email) makes double-registration a no-op
// instead of an error.

import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";
import { eventExists } from "@/server/events";
import { registerSchema } from "@/lib/validators/registration";
import { isDivisionId, type DivisionId } from "@/lib/divisions";

/** Rows with the registrant's account role joined — the hub's Role column. */
async function loadRegistrations(slug: string) {
  const rows = await db
    .select({
      id: t.registrations.id,
      email: t.registrations.email,
      name: t.registrations.name,
      at: t.registrations.at,
      division: t.registrations.division,
      role: t.user.role,
    })
    .from(t.registrations)
    .leftJoin(t.user, eq(t.registrations.userId, t.user.id))
    .where(eq(t.registrations.eventSlug, slug))
    .orderBy(desc(t.registrations.at));
  // role is null when the account is gone (user_id set null on delete);
  // division is null only on rows from before the division picker shipped.
  return rows.map((r) => ({ ...r, role: r.role ?? null, division: isDivisionId(r.division) ? r.division : null }));
}

async function countFor(slug: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.registrations)
    .where(eq(t.registrations.eventSlug, slug));
  return row?.count ?? 0;
}

/** The signed-in user's registration row for this event, or null. */
async function myRegistration(slug: string, userId: string | null): Promise<{ id: string; division: DivisionId | null } | null> {
  if (!userId) return null;
  const [row] = await db
    .select({ id: t.registrations.id, division: t.registrations.division })
    .from(t.registrations)
    .where(and(eq(t.registrations.eventSlug, slug), eq(t.registrations.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { id: row.id, division: isDivisionId(row.division) ? row.division : null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!(await eventExists(slug))) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }
  const user = await getServerSessionUser();

  const [count, mine] = await Promise.all([
    countFor(slug),
    myRegistration(slug, user?.id ?? null),
  ]);

  const registrations =
    user?.role === "organizer" ? await loadRegistrations(slug) : null;

  return NextResponse.json({ count, registered: Boolean(mine), division: mine?.division ?? null, registrations });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (!(await eventExists(slug))) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  // The picker on the event page sends the division with every register;
  // an unknown or missing one is a bad request, not a silent default.
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Pick one of the three divisions." },
      { status: 400 },
    );
  }
  const { division } = parsed.data;

  const existing = await myRegistration(slug, user.id);

  if (!existing) {
    await db
      .insert(t.registrations)
      .values({ eventSlug: slug, userId: user.id, email: user.email, name: user.name, division })
      .onConflictDoNothing({
        target: [t.registrations.eventSlug, t.registrations.email],
      });
    // A refresh signal, not data: every viewer refetches the count they need.
    publish("registrations");
  } else if (existing.division !== division) {
    // Backfills a row that predates the division picker (or moves the
    // registrant to the division they just picked) so the badge and the
    // organizer's inbox show one answer.
    await db.update(t.registrations).set({ division }).where(eq(t.registrations.id, existing.id));
    publish("registrations");
  }

  return NextResponse.json({ count: await countFor(slug), registered: true, division });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (!(await eventExists(slug))) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  await db
    .delete(t.registrations)
    .where(and(eq(t.registrations.eventSlug, slug), eq(t.registrations.userId, user.id)));

  publish("registrations");
  return NextResponse.json({ count: await countFor(slug), registered: false, division: null });
}
