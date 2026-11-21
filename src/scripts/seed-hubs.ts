/**
 * Seeds the public Discover directory: SportsHubs, their courts, weekly open
 * play templates, photos, news and linked events.
 *
 *   npm run db:seed:hubs
 *
 * Also backfills a public hub for every existing organizer organization, so
 * accounts created before Discover existed still have a club page. Idempotent:
 * hubs upsert by slug, courts by (hub, name), and the child content is replaced
 * so editing src/lib/hubs-data.ts refreshes the listing.
 */

import { asc, eq, sql } from "drizzle-orm";
import { db } from "../server/db";
import * as t from "../server/schema";
import { ensureHubForOrganization } from "../server/hubs";
import { HUB_SEEDS } from "../lib/hubs-data";
import { addDays, isoDate } from "../lib/hubs";

async function seedHub(seed: (typeof HUB_SEEDS)[number]) {
  const [hub] = await db
    .insert(t.sportsHubs)
    .values({
      slug: seed.slug,
      name: seed.name,
      about: seed.about,
      address: seed.address,
      city: seed.city,
      country: seed.country,
      phone: seed.phone,
      email: seed.email,
      logoColor: seed.logoColor,
      coverColor: seed.coverColor,
      monogram: seed.name
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((word) => word[0])
        .join("")
        .toUpperCase(),
      memberCount: seed.memberCount,
      lat: seed.lat,
      lng: seed.lng,
      hours: seed.hours ?? [],
      comingSoon: seed.comingSoon ?? false,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: t.sportsHubs.slug,
      set: {
        name: seed.name,
        about: seed.about,
        address: seed.address,
        city: seed.city,
        country: seed.country,
        phone: seed.phone,
        email: seed.email,
        logoColor: seed.logoColor,
        coverColor: seed.coverColor,
        memberCount: seed.memberCount,
        lat: seed.lat,
        lng: seed.lng,
        hours: seed.hours ?? [],
        comingSoon: seed.comingSoon ?? false,
        updatedAt: new Date(),
      },
    })
    .returning({ id: t.sportsHubs.id });

  if (!hub) return;

  for (const [index, court] of seed.courts.entries()) {
    await db
      .insert(t.hubCourts)
      .values({
        hubId: hub.id,
        name: court.name,
        surface: court.surface,
        indoor: court.indoor,
        hourlyRate: court.hourlyRate,
        sort: index,
      })
      .onConflictDoUpdate({
        target: [t.hubCourts.hubId, t.hubCourts.name],
        set: {
          surface: court.surface,
          indoor: court.indoor,
          hourlyRate: court.hourlyRate,
          sort: index,
        },
      });
  }

  await db.delete(t.hubOpenPlayTemplates).where(eq(t.hubOpenPlayTemplates.hubId, hub.id));
  if (seed.openPlay.length) {
    await db.insert(t.hubOpenPlayTemplates).values(
      seed.openPlay.map((session) => ({
        hubId: hub.id,
        weekday: session.weekday,
        title: session.title,
        startTime: session.startTime,
        endTime: session.endTime,
        court: session.court,
        level: session.level,
        capacity: session.capacity,
        price: session.price,
      })),
    );
  }

  await db.delete(t.hubPhotos).where(eq(t.hubPhotos.hubId, hub.id));
  if (seed.photos.length) {
    await db.insert(t.hubPhotos).values(
      seed.photos.map((photo, index) => ({
        hubId: hub.id,
        caption: photo.caption,
        color: photo.color,
        sort: index,
      })),
    );
  }

  await db.delete(t.hubNews).where(eq(t.hubNews.hubId, hub.id));
  if (seed.news.length) {
    await db.insert(t.hubNews).values(
      seed.news.map((item) => ({
        hubId: hub.id,
        title: item.title,
        body: item.body,
        publishedAt: new Date(Date.now() - item.daysAgo * 86_400_000),
      })),
    );
  }

  await db.delete(t.hubEvents).where(eq(t.hubEvents.hubId, hub.id));
  if (seed.eventSlugs.length) {
    const existing = await db
      .select({ slug: t.events.slug })
      .from(t.events);
    const known = new Set(existing.map((row) => row.slug));
    const links = seed.eventSlugs
      .filter((slug) => known.has(slug))
      .map((eventSlug) => ({ hubId: hub.id, eventSlug }));
    if (links.length) await db.insert(t.hubEvents).values(links).onConflictDoNothing();
  }

  // A few real bookings so the grid opens with booked/open/mine states rather
  // than an empty sheet. No user id: these are the club's own holds.
  const courtRows = await db
    .select({ id: t.hubCourts.id })
    .from(t.hubCourts)
    .where(eq(t.hubCourts.hubId, hub.id))
    .orderBy(asc(t.hubCourts.sort))
    .limit(2);
  const today = isoDate();
  for (const [courtIndex, court] of courtRows.entries()) {
    for (const [dayOffset, starts] of [
      [0, ["09:00", "18:00"]],
      [1, ["10:00"]],
    ] as const) {
      for (const startTime of starts) {
        await db
          .insert(t.hubBookings)
          .values({
            hubId: hub.id,
            courtId: court.id,
            userId: null,
            date: addDays(today, dayOffset),
            startTime,
            endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
          })
          .onConflictDoNothing();
      }
    }
    if (courtIndex === 0) {
      // one block held for a tournament setup, visible as booked
      await db
        .insert(t.hubBookings)
        .values({
          hubId: hub.id,
          courtId: court.id,
          userId: null,
          date: addDays(today, 2),
          startTime: "14:00",
          endTime: "15:00",
        })
        .onConflictDoNothing();
    }
  }
}

async function backfillOrganizerHubs() {
  const rows = await db
    .select({
      id: t.organizations.id,
      name: t.organizations.name,
      city: t.organizations.city,
      site: t.organizations.site,
      email: t.user.email,
    })
    .from(t.organizations)
    .innerJoin(t.user, eq(t.organizations.ownerUserId, t.user.id));

  let created = 0;
  for (const organization of rows) {
    const before = await db
      .select({ id: t.sportsHubs.id })
      .from(t.sportsHubs)
      .where(eq(t.sportsHubs.organizationId, organization.id))
      .limit(1);
    await ensureHubForOrganization(organization, organization.email);
    if (before.length === 0) created++;
  }
  return { organizations: rows.length, created };
}

async function main() {
  for (const seed of HUB_SEEDS) {
    await seedHub(seed);
  }
  const backfill = await backfillOrganizerHubs();
  const [{ count: hubCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.sportsHubs);
  const [{ count: courtCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.hubCourts);

  console.log("SportsHub seed complete.");
  console.log(`  hubs: ${hubCount}  courts: ${courtCount}`);
  console.log(
    `  organizer hubs: ${backfill.organizations} organizations scanned, ${backfill.created} created`,
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
