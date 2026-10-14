// My registrations.
//
//   GET /api/registrations — the signed-in user's registrations, newest first.

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";

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
      role: t.user.role,
    })
    .from(t.registrations)
    .leftJoin(t.user, eq(t.registrations.userId, t.user.id))
    .where(eq(t.registrations.userId, user.id))
    .orderBy(desc(t.registrations.at));

  // role is null when the account is gone (user_id set null on delete).
  return NextResponse.json({
    registrations: rows.map((r) => ({ ...r, role: r.role ?? null })),
  });
}
