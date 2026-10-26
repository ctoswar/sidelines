// Homepage Spotlight curation.
//
//   PATCH /api/admin/events/[slug] — { featured: boolean }
//
// The only write path to `events.featured`. It used to hang off
// /api/tournaments/[id], where any organizer could spotlight their own
// tournament; it moved here so the check is the admin role, and the
// organizer API has no equivalent route to fall back to.
//
// No realtime publish: the homepage is a force-dynamic server render that
// re-reads the catalogue per request, and nothing subscribes to a catalogue
// topic. The admin page re-reads via router.refresh().

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { setEventFeatured } from "@/server/publish";
import { eventFeaturedSchema } from "@/lib/validators/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  // Specifically the admin role, not "any staff": an organizer who finds this
  // route gets the same 403 an anonymous caller would.
  if (user.role !== "admin") {
    return NextResponse.json({ message: "Only admins curate the Spotlight." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = eventFeaturedSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the Spotlight flag.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  const { slug } = await params;

  const [row] = await db
    .select({ slug: t.events.slug, featured: t.events.featured })
    .from(t.events)
    .where(eq(t.events.slug, slug))
    .limit(1);
  if (!row) return NextResponse.json({ message: "Event not found." }, { status: 404 });

  // Skip the write (and the transaction) when nothing changes — a repeat
  // click cannot leave the row's updatedAt churned for a no-op.
  if (row.featured !== parsed.data.featured) {
    await db.transaction(async (tx) => setEventFeatured(tx, row.slug, parsed.data.featured));
  }

  return NextResponse.json({ event: { slug: row.slug, featured: parsed.data.featured } });
}
