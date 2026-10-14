// Event announcements.
//
//   GET  /api/announcements?slug=<event>&limit=<n> — newest first, public
//   POST /api/announcements — publish (organizer only)
//
// The seeded event pages keep their read-only `event_details.announcements`
// strings; this table is what organizers publish live, shown in the player
// dashboard feed and the event hub.

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { eventExists } from "@/server/events";
import { announcementSchema } from "@/lib/validators/events";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : undefined;

  const conditions = slug ? eq(t.announcements.eventSlug, slug) : undefined;

  const rows = await db
    .select({
      id: t.announcements.id,
      slug: t.announcements.eventSlug,
      title: t.announcements.title,
      body: t.announcements.body,
      author: t.announcements.author,
      at: t.announcements.at,
    })
    .from(t.announcements)
    .where(conditions)
    .orderBy(desc(t.announcements.at), desc(t.announcements.id))
    .limit(limit ?? 500);

  return NextResponse.json({ announcements: rows });
}

export async function POST(request: Request) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers can post announcements." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the announcement and try again.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  const { slug, title, body: text } = parsed.data;
  if (!(await eventExists(slug))) {
    return NextResponse.json({ message: "Event not found." }, { status: 404 });
  }

  const [row] = await db
    .insert(t.announcements)
    .values({ eventSlug: slug, title, body: text, author: user.name })
    .returning({
      id: t.announcements.id,
      slug: t.announcements.eventSlug,
      title: t.announcements.title,
      body: t.announcements.body,
      author: t.announcements.author,
      at: t.announcements.at,
    });

  return NextResponse.json({ announcement: row });
}
