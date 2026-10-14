// Delete an announcement (organizer only).
//
//   DELETE /api/announcements/[id]

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "organizer") {
    return NextResponse.json({ message: "Only organizers can manage announcements." }, { status: 403 });
  }

  const deleted = await db
    .delete(t.announcements)
    .where(eq(t.announcements.id, id))
    .returning({ id: t.announcements.id });

  if (deleted.length === 0) {
    return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
