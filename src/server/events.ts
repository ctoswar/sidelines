// Event reads over Postgres.
//
// The catalogue (`events`) and the generated aggregate (`event_details`) are
// seeded from the same static modules the pages render from, so this mapper
// is the bridge between the two worlds: API consumers read the DB copy,
// pages keep their static reads (they are prerendered at build, where no
// database is reachable — see src/server/db.ts). verify-phase4.ts asserts
// the two representations stay identical.

import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import type { EventItem } from "@/types";
import type {
  Crew,
  EventDetail,
  MatchInfo,
  Mvp,
  PlayerStat,
  PoolRow,
  TeamInfo,
} from "@/lib/event-detail";

/** `events` row → the EventItem shape every consumer already speaks. */
export function eventRowToItem(row: typeof t.events.$inferSelect): EventItem {
  return {
    slug: row.slug,
    name: row.name,
    start: row.startDate,
    end: row.endDate,
    city: row.city,
    country: row.country,
    code: row.code,
    tags: [...row.tags],
    status: row.status,
    featured: row.featured,
    live: row.live,
    teams: row.teamCount,
    color: row.color,
    monogram: row.monogram,
    hasLogo: row.hasLogo,
  };
}

/**
 * Loads the full EventDetail for a slug from the database, or null when the
 * event (or its detail row) is not seeded.
 */
export async function loadEventDetail(slug: string): Promise<EventDetail | null> {
  const [eventRow] = await db.select().from(t.events).where(eq(t.events.slug, slug)).limit(1);
  if (!eventRow) return null;

  const [detailRow] = await db
    .select()
    .from(t.eventDetails)
    .where(eq(t.eventDetails.eventId, slug))
    .limit(1);
  if (!detailRow) return null;

  return {
    event: eventRowToItem(eventRow),
    about: detailRow.about,
    venue: {
      name: detailRow.venueName,
      address: detailRow.venueAddress,
      mapUrl: detailRow.venueMapUrl,
    },
    tz: { label: detailRow.tzLabel, offset: detailRow.tzOffset },
    hasResults: detailRow.hasResults,
    days: detailRow.days,
    fields: detailRow.fields,
    facts: detailRow.facts,
    announcements: [...detailRow.announcements],
    teams: detailRow.teams as unknown as TeamInfo[],
    matches: detailRow.matches as unknown as MatchInfo[],
    pools: detailRow.pools as unknown as Record<"A" | "B", PoolRow[]>,
    overall: detailRow.overall as unknown as PoolRow[],
    bracket: detailRow.bracket as unknown as MatchInfo[],
    players: detailRow.players as unknown as PlayerStat[],
    mvp: detailRow.mvp as unknown as Mvp[],
    crew: detailRow.crew as unknown as Crew[],
  };
}

/** Every event with its live registration count — the event hub list feed. */
export async function loadCatalogue() {
  const [eventRows, counts] = await Promise.all([
    db.select().from(t.events).orderBy(t.events.slug),
    db
      .select({ slug: t.registrations.eventSlug, count: sql<number>`count(*)::int` })
      .from(t.registrations)
      .groupBy(t.registrations.eventSlug),
  ]);
  const countBySlug = new Map(counts.map((c) => [c.slug, c.count]));
  return eventRows.map((row) => ({
    ...eventRowToItem(row),
    registrationCount: countBySlug.get(row.slug) ?? 0,
  }));
}

/** Does the event exist? Cheap guard shared by the registration routes. */
export async function eventExists(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ slug: t.events.slug })
    .from(t.events)
    .where(eq(t.events.slug, slug))
    .limit(1);
  return Boolean(row);
}
