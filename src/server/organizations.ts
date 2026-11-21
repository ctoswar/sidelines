// Organization reads for the workspace chrome and public SportsHub links.
//
// Kept separate from the auth/session modules so layouts can label the
// workspace with the signed-in organizer's own organization instead of a
// hardcoded brand name.

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";

/** The organizer's organization name, or null when they have none yet. */
export async function loadOrganizationName(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: t.organizations.name })
    .from(t.organizations)
    .where(eq(t.organizations.ownerUserId, userId))
    .limit(1);
  return row?.name ?? null;
}

export type OrganizerOrganization = Pick<
  typeof t.organizations.$inferSelect,
  "id" | "name" | "city" | "site" | "orgType"
>;

/**
 * The signed-in organizer's organization row. The workspace scopes every
 * tournament read/write to this id: two organizer accounts with their own
 * clubs must never share a tournament list, a live slot, or a pool.
 */
export async function loadOrganization(userId: string): Promise<OrganizerOrganization | null> {
  const [row] = await db
    .select({
      id: t.organizations.id,
      name: t.organizations.name,
      city: t.organizations.city,
      site: t.organizations.site,
      orgType: t.organizations.orgType,
    })
    .from(t.organizations)
    .where(eq(t.organizations.ownerUserId, userId))
    .limit(1);
  return row ?? null;
}
