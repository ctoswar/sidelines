// Delete an announcement (organizer only).
//
//   DELETE /api/announcements/[id]

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { publish } from "@/server/realtime";

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

  // Scope the delete to announcements on events this account's organization
  // published, so a guessed or enumerated id cannot touch another club's
  // posts. (Admin moderation would go through the admin workspace, not here.)
  const deleted = await db
    .delete(t.announcements)
    .where(
      and(
        eq(t.announcements.id, id),
        sql`exists (
          select 1 from ${t.tournaments}
          where ${t.tournaments.eventSlug} = ${t.announcements.eventSlug}
            and ${t.tournaments.organizationId} in (
              select ${t.organizations.id} from ${t.organizations}
              where ${t.organizations.ownerUserId} = ${user.id}
            )
        )`,
      ),
    )
    .returning({ id: t.announcements.id });

  if (deleted.length === 0) {
    return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
  }
  publish("announcements");
  return NextResponse.json({ ok: true });
}
