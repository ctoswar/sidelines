// My registrations.
//
//   GET /api/registrations - the signed-in user's registrations, newest first.
//
// Each row carries the joined event so "My events" renders names, dates and
// chips straight from the payload (Phase 7 dropped its static catalogue
// lookup); event_slug is a cascade FK, so the event side always matches.

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { eventSelection } from "@/server/events";
import { isDivisionId } from "@/lib/divisions";

export async function GET() {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });

  const rows = await db
    .select({
      id: t.registrations.id,
      slug: t.registrations.eventSlug,
      email: t.registrations.email,
      name: t.registrations.name,
      at: t.registrations.at,
      division: t.registrations.division,
      role: t.user.role,
      event: eventSelection,
    })
    .from(t.registrations)
    .leftJoin(t.user, eq(t.registrations.userId, t.user.id))
    .innerJoin(t.events, eq(t.registrations.eventSlug, t.events.slug))
    .where(eq(t.registrations.userId, user.id))
    .orderBy(desc(t.registrations.at));

  // role is null when the account is gone (user_id set null on delete);
  // division is null only on rows from before the division picker shipped.
  return NextResponse.json({
    registrations: rows.map((r) => ({
      ...r,
      role: r.role ?? null,
      division: isDivisionId(r.division) ? r.division : null,
    })),
  });
}
