// Event ownership.
//
// Organizer signup is self-service, so "role === organizer" cannot be the
// whole authorization story: without an ownership check any organizer could
// read every event's registration inbox (names + emails), post or delete
// announcements on other clubs' events, and flip another club's live
// tournament to draft.
//
// An event belongs to the organization that published it: `tournaments`
// carries the event slug and the owning organization, and `organizations`
// carries the owner. Admins (site curation) bypass.

import { and, eq } from "drizzle-orm";
import { db } from "./db";
import * as t from "./schema";

type Actor = { id: string; role: "player" | "organizer" | "admin" };

/** True when this account may manage the event (its inbox, announcements, status). */
export async function canManageEvent(actor: Actor, eventSlug: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role !== "organizer") return false;

  const [org] = await db
    .select({ id: t.organizations.id })
    .from(t.organizations)
    .where(eq(t.organizations.ownerUserId, actor.id))
    .limit(1);
  if (!org) return false;

  const [row] = await db
    .select({ id: t.tournaments.id })
    .from(t.tournaments)
    .where(and(eq(t.tournaments.eventSlug, eventSlug), eq(t.tournaments.organizationId, org.id)))
    .limit(1);
  return Boolean(row);
}

/** True when this account may manage the tournament row itself. */
export async function canManageTournament(actor: Actor, tournamentId: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  if (actor.role !== "organizer") return false;

  const [row] = await db
    .select({ organizationId: t.tournaments.organizationId })
    .from(t.tournaments)
    .where(eq(t.tournaments.id, tournamentId))
    .limit(1);
  if (!row) return false;

  const [org] = await db
    .select({ id: t.organizations.id })
    .from(t.organizations)
    .where(eq(t.organizations.ownerUserId, actor.id))
    .limit(1);
  return Boolean(org) && row.organizationId === org!.id;
}

/** The organization ids this account owns — for filtering hub listings. */
export async function ownedOrganizationIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: t.organizations.id })
    .from(t.organizations)
    .where(eq(t.organizations.ownerUserId, userId));
  return rows.map((row) => row.id);
}
