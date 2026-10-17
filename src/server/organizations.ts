// Organization reads for the workspace chrome.
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
