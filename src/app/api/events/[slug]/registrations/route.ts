// Event registrations.
//
//   GET    /api/events/[slug]/registrations — public state + organizer list
//   POST   /api/events/[slug]/registrations — register the signed-in user
//   DELETE /api/events/[slug]/registrations — unregister the signed-in user
//
// GET is open so a signed-out spectator still renders the right badge
// (count + registered:false). The full list is only included for organizers
// — everyone else gets `registrations: null`. POST/DELETE return the fresh
// count and the caller's registered flag so the button can flip from the
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

/** Rows with the registrant's account role joined — the hub's Role column. */
async function loadRegistrations(slug: string) {
  const rows = await db
    .select({
      id: t.registrations.id,
      email: t.registrations.email,
      name: t.registrations.name,
      at: t.registrations.at,
      role: t.user.role,
    })
    .from(t.registrations)
    .leftJoin(t.user, eq(t.registrations.userId, t.user.id))
    .where(eq(t.registrations.eventSlug, slug))
    .orderBy(desc(t.registrations.at));
  // role is null when the account is gone (user_id set null on delete).
  return rows.map((r) => ({ ...r, role: r.role ?? null }));
}

async function countFor(slug: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.registrations)
    .where(eq(t.registrations.eventSlug, slug));
  return row?.count ?? 0;
}

async function registeredState(slug: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const [row] = await db
    .select({ id: t.registrations.id })
    .from(t.registrations)
    .where(and(eq(t.registrations.eventSlug, slug), eq(t.registrations.userId, userId)))
    .limit(1);
  return Boolean(row);
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

  const [count, registered] = await Promise.all([
    countFor(slug),
    registeredState(slug, user?.id ?? null),
  ]);

  const registrations =
    user?.role === "organizer" ? await loadRegistrations(slug) : null;

  return NextResponse.json({ count, registered, registrations });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (!(await eventExists(slug))) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  const [existing] = await db
    .select({ id: t.registrations.id })
    .from(t.registrations)
    .where(and(eq(t.registrations.eventSlug, slug), eq(t.registrations.userId, user.id)))
    .limit(1);

  if (!existing) {
    await db
      .insert(t.registrations)
      .values({ eventSlug: slug, userId: user.id, email: user.email, name: user.name })
      .onConflictDoNothing({
        target: [t.registrations.eventSlug, t.registrations.email],
      });
    // A refresh signal, not data: every viewer refetches the count they need.
    publish("registrations");
  }

  return NextResponse.json({ count: await countFor(slug), registered: true });
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
  return NextResponse.json({ count: await countFor(slug), registered: false });
}
