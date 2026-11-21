// SportsHub reads and writes for the player Discover workspace.
//
// The directory is intentionally independent from the tournament tables: a
// hub is a public club/venue, while `organizations` is a signed-in organizer's
// workspace. A claimed hub carries `organizationId`, which is how its Events
// tab finds the events that organizer publishes. Seeded community hubs use
// `hub_events` for the same job.
//
// Everything here is scoped by the caller's user id where a "mine"/"following"
// answer matters, so one player's bookings and follows never leak into
// another's grid.

import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { eventRowToItem } from "@/server/events";
import { splitPlace } from "@/server/publish";
import {
  addDays,
  DAY_NAMES,
  defaultHubHours,
  formatHour,
  hubMonogram,
  isoDate,
  weekdayOf,
  type HubCard,
  type HubCourt,
  type HubCourtGrid,
  type HubDetail,
  type HubNewsItem,
  type HubOpenPlaySession,
  type HubOperatingHours,
  type HubPhoto,
} from "@/lib/hubs";

/** The columns every card needs; the follower count is merged in separately. */
const hubCardSelection = {
  id: t.sportsHubs.id,
  slug: t.sportsHubs.slug,
  name: t.sportsHubs.name,
  address: t.sportsHubs.address,
  city: t.sportsHubs.city,
  country: t.sportsHubs.country,
  logoColor: t.sportsHubs.logoColor,
  coverColor: t.sportsHubs.coverColor,
  monogram: t.sportsHubs.monogram,
  memberCount: t.sportsHubs.memberCount,
  comingSoon: t.sportsHubs.comingSoon,
  lat: t.sportsHubs.lat,
  lng: t.sportsHubs.lng,
} as const;

type HubCardRow = {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  country: string;
  logoColor: string;
  coverColor: string;
  monogram: string;
  memberCount: number;
  comingSoon: boolean;
  lat: number | null;
  lng: number | null;
};

async function courtCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ hubId: t.hubCourts.hubId, count: sql<number>`count(*)::int` })
    .from(t.hubCourts)
    .where(inArray(t.hubCourts.hubId, ids))
    .groupBy(t.hubCourts.hubId);
  return new Map(rows.map((row) => [row.hubId, row.count]));
}

async function followCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ hubId: t.hubFollows.hubId, count: sql<number>`count(*)::int` })
    .from(t.hubFollows)
    .where(inArray(t.hubFollows.hubId, ids))
    .groupBy(t.hubFollows.hubId);
  return new Map(rows.map((row) => [row.hubId, row.count]));
}

async function followedHubIds(userId: string | null, ids: string[]): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set();
  const rows = await db
    .select({ hubId: t.hubFollows.hubId })
    .from(t.hubFollows)
    .where(and(eq(t.hubFollows.userId, userId), inArray(t.hubFollows.hubId, ids)));
  return new Set(rows.map((row) => row.hubId));
}

function toCard(
  row: HubCardRow,
  counts: { courts: number; follows: number; following: boolean },
): HubCard {
  const followers = row.memberCount + counts.follows;
  return {
    ...row,
    memberCount: followers,
    followerCount: followers,
    following: counts.following,
    courtCount: counts.courts,
  };
}

/**
 * The directory list. Search is case-insensitive across name, address and
 * city — "Cebu" should find both the club named Cebu and a venue on a Cebu
 * street. Followed-only is filtered after the counts are merged so the count
 * beside the tab is always the unfiltered total.
 */
export async function listHubs(
  userId: string | null,
  options: { q?: string; followedOnly?: boolean } = {},
): Promise<HubCard[]> {
  const term = options.q?.trim() ?? "";
  const like = `%${term}%`;
  const filter = term
    ? or(
        ilike(t.sportsHubs.name, like),
        ilike(t.sportsHubs.city, like),
        ilike(t.sportsHubs.address, like),
      )
    : undefined;

  const rows = await db
    .select(hubCardSelection)
    .from(t.sportsHubs)
    .where(filter)
    .orderBy(asc(t.sportsHubs.comingSoon), asc(t.sportsHubs.name));

  const ids = rows.map((row) => row.id);
  const [courts, follows, followed] = await Promise.all([
    courtCounts(ids),
    followCounts(ids),
    followedHubIds(userId, ids),
  ]);

  const cards = rows.map((row) =>
    toCard(row, {
      courts: courts.get(row.id) ?? 0,
      follows: follows.get(row.id) ?? 0,
      following: followed.has(row.id),
    }),
  );
  return options.followedOnly ? cards.filter((card) => card.following) : cards;
}

/**
 * The next 21 days of open play, generated from the hub's weekly templates.
 * `signups` is every signup for the hub; each occurrence gets its own count
 * and the viewer's join state, so a full session is visibly full.
 */
function openPlaySessions(
  templates: (typeof t.hubOpenPlayTemplates.$inferSelect)[],
  signups: { templateId: string; date: string; userId: string }[],
  userId: string | null,
): HubOpenPlaySession[] {
  const today = isoDate();
  const taken = new Map<string, number>();
  const joined = new Set<string>();
  for (const signup of signups) {
    const key = `${signup.templateId}:${signup.date}`;
    taken.set(key, (taken.get(key) ?? 0) + 1);
    if (userId && signup.userId === userId) joined.add(key);
  }

  const sessions: HubOpenPlaySession[] = [];
  for (let offset = 0; offset < 21; offset++) {
    const date = addDays(today, offset);
    const weekday = weekdayOf(date);
    for (const template of templates) {
      if (template.weekday !== weekday) continue;
      const key = `${template.id}:${date}`;
      const count = taken.get(key) ?? 0;
      sessions.push({
        id: key,
        templateId: template.id,
        date,
        title: template.title,
        startTime: template.startTime,
        endTime: template.endTime,
        court: template.court,
        level: template.level,
        capacity: template.capacity,
        price: template.price,
        taken: count,
        spotsLeft: Math.max(0, template.capacity - count),
        joined: joined.has(key),
      });
    }
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

function minutesOf(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function timeOf(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/**
 * The court grid for one date. Slots are one hour, starting at the hub's
 * opening time; an overnight close (6am to 1am) is capped at the last slot
 * that starts before midnight so the table never runs past the day.
 */
export async function loadCourtGrid(
  hub: { id: string; hours: HubOperatingHours[] },
  date: string,
  userId: string | null,
): Promise<HubCourtGrid> {
  const courts = await db
    .select()
    .from(t.hubCourts)
    .where(eq(t.hubCourts.hubId, hub.id))
    .orderBy(asc(t.hubCourts.sort), asc(t.hubCourts.name));

  const hours = hub.hours.find((entry) => entry.day === DAY_NAMES[weekdayOf(date)]);
  if (!hours || hours.closed) {
    return {
      date,
      // Null means "closed that day" to the client; the court columns still
      // render so the section can explain the closure without disappearing.
      hours: null,
      courts: courts.map((court) => ({
        id: court.id,
        name: court.name,
        surface: court.surface,
        indoor: court.indoor,
        hourlyRate: court.hourlyRate,
        slots: [],
      })),
    };
  }

  const open = minutesOf(hours.open);
  let close = minutesOf(hours.close);
  if (open === null || close === null) {
    return { date, hours: { open: hours.open, close: hours.close }, courts: [] };
  }
  if (close <= open) close += 24 * 60;
  const lastStart = Math.min(close, 24 * 60) - 60;

  const bookings = await db
    .select({
      id: t.hubBookings.id,
      courtId: t.hubBookings.courtId,
      startTime: t.hubBookings.startTime,
      userId: t.hubBookings.userId,
    })
    .from(t.hubBookings)
    .where(and(eq(t.hubBookings.hubId, hub.id), eq(t.hubBookings.date, date)));
  const booked = new Map(bookings.map((row) => [`${row.courtId}:${row.startTime}`, row]));

  return {
    date,
    hours: { open: hours.open, close: hours.close },
    courts: courts.map((court) => {
      const slots: HubCourt["slots"] = [];
      for (let minutes = open; minutes <= lastStart; minutes += 60) {
        const start = timeOf(minutes);
        const booking = booked.get(`${court.id}:${start}`);
        slots.push({
          start,
          end: timeOf(minutes + 60),
          status: booking ? (booking.userId === userId ? ("mine" as const) : ("booked" as const)) : ("open" as const),
          bookingId: booking?.id,
        });
      }
      return {
        id: court.id,
        name: court.name,
        surface: court.surface,
        indoor: court.indoor,
        hourlyRate: court.hourlyRate,
        slots,
      };
    }),
  };
}

/** Everything the detail page renders, in one read. */
export async function loadHubDetail(
  slug: string,
  userId: string | null,
): Promise<HubDetail | null> {
  const [row] = await db.select().from(t.sportsHubs).where(eq(t.sportsHubs.slug, slug)).limit(1);
  if (!row) return null;

  const [courts, templates, photos, news, hubEventRows, linkedEventRows, follows, following, signups] =
    await Promise.all([
      db
        .select()
        .from(t.hubCourts)
        .where(eq(t.hubCourts.hubId, row.id))
        .orderBy(asc(t.hubCourts.sort), asc(t.hubCourts.name)),
      db
        .select()
        .from(t.hubOpenPlayTemplates)
        .where(and(eq(t.hubOpenPlayTemplates.hubId, row.id), eq(t.hubOpenPlayTemplates.active, true)))
        .orderBy(asc(t.hubOpenPlayTemplates.weekday), asc(t.hubOpenPlayTemplates.startTime)),
      db
        .select()
        .from(t.hubPhotos)
        .where(eq(t.hubPhotos.hubId, row.id))
        .orderBy(asc(t.hubPhotos.sort)),
      db
        .select()
        .from(t.hubNews)
        .where(eq(t.hubNews.hubId, row.id))
        .orderBy(desc(t.hubNews.publishedAt)),
      db
        .select({ eventSlug: t.hubEvents.eventSlug })
        .from(t.hubEvents)
        .where(eq(t.hubEvents.hubId, row.id)),
      row.organizationId
        ? db
            .select({ eventSlug: t.tournaments.eventSlug })
            .from(t.tournaments)
            .where(
              and(
                eq(t.tournaments.organizationId, row.organizationId),
                isNotNull(t.tournaments.eventSlug),
              ),
            )
        : Promise.resolve([] as { eventSlug: string | null }[]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(t.hubFollows)
        .where(eq(t.hubFollows.hubId, row.id))
        .then(([result]) => result?.count ?? 0),
      userId
        ? db
            .select({ id: t.hubFollows.id })
            .from(t.hubFollows)
            .where(and(eq(t.hubFollows.hubId, row.id), eq(t.hubFollows.userId, userId)))
            .limit(1)
            .then(([result]) => Boolean(result))
        : Promise.resolve(false),
      db
        .select({
          templateId: t.hubOpenPlaySignups.templateId,
          date: t.hubOpenPlaySignups.date,
          userId: t.hubOpenPlaySignups.userId,
        })
        .from(t.hubOpenPlaySignups)
        .where(eq(t.hubOpenPlaySignups.hubId, row.id)),
    ]);

  const eventSlugs = [
    ...new Set(
      [...hubEventRows, ...linkedEventRows]
        .map((event) => event.eventSlug)
        .filter((eventSlug): eventSlug is string => Boolean(eventSlug)),
    ),
  ];
  const eventRows = eventSlugs.length
    ? await db.select().from(t.events).where(inArray(t.events.slug, eventSlugs))
    : [];

  const followers = row.memberCount + follows;
  const detail: HubDetail = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    city: row.city,
    country: row.country,
    logoColor: row.logoColor,
    coverColor: row.coverColor,
    monogram: row.monogram,
    memberCount: followers,
    followerCount: followers,
    following,
    comingSoon: row.comingSoon,
    courtCount: courts.length,
    lat: row.lat,
    lng: row.lng,
    about: row.about,
    phone: row.phone,
    email: row.email,
    hours: row.hours,
    courts: courts.map((court) => ({
      id: court.id,
      name: court.name,
      surface: court.surface,
      indoor: court.indoor,
      hourlyRate: court.hourlyRate,
      slots: [],
    })),
    openPlay: openPlaySessions(templates, signups, userId),
    photos: photos.map((photo): HubPhoto => ({
      id: photo.id,
      caption: photo.caption,
      color: photo.color,
    })),
    news: news.map((item): HubNewsItem => ({
      id: item.id,
      title: item.title,
      body: item.body,
      publishedAt: item.publishedAt.toISOString(),
    })),
    events: eventRows
      .map(eventRowToItem)
      .sort((a, b) => a.start.localeCompare(b.start)),
    initialCourtGrid: await loadCourtGrid(row, isoDate(), userId),
  };
  return detail;
}

export async function findHubBySlug(
  slug: string,
): Promise<{ id: string; name: string; slug: string; comingSoon: boolean; hours: HubOperatingHours[] } | null> {
  const [row] = await db
    .select({
      id: t.sportsHubs.id,
      name: t.sportsHubs.name,
      slug: t.sportsHubs.slug,
      comingSoon: t.sportsHubs.comingSoon,
      hours: t.sportsHubs.hours,
    })
    .from(t.sportsHubs)
    .where(eq(t.sportsHubs.slug, slug))
    .limit(1);
  return row ?? null;
}

/** Follows are idempotent; the returned count is the total the button shows. */
export async function followHub(
  hubId: string,
  userId: string,
): Promise<{ following: boolean; followers: number }> {
  await db.insert(t.hubFollows).values({ hubId, userId }).onConflictDoNothing();
  return { following: true, followers: await followerTotal(hubId) };
}

export async function unfollowHub(
  hubId: string,
  userId: string,
): Promise<{ following: boolean; followers: number }> {
  await db
    .delete(t.hubFollows)
    .where(and(eq(t.hubFollows.hubId, hubId), eq(t.hubFollows.userId, userId)));
  return { following: false, followers: await followerTotal(hubId) };
}

async function followerTotal(hubId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.hubFollows)
    .where(eq(t.hubFollows.hubId, hubId));
  const [hub] = await db
    .select({ memberCount: t.sportsHubs.memberCount })
    .from(t.sportsHubs)
    .where(eq(t.sportsHubs.id, hubId))
    .limit(1);
  return (hub?.memberCount ?? 0) + (row?.count ?? 0);
}

export type OpenPlayResult =
  | { ok: true; session: HubOpenPlaySession }
  | { ok: false; status: number; message: string };

/**
 * Joins one occurrence of a weekly open-play template. Capacity is checked
 * against the occurrence, not the template, and the unique (template, date,
 * user) index makes a double-click a no-op rather than a duplicate seat.
 */
export async function joinOpenPlay(input: {
  hubId: string;
  templateId: string;
  date: string;
  userId: string;
}): Promise<OpenPlayResult> {
  const [template] = await db
    .select()
    .from(t.hubOpenPlayTemplates)
    .where(
      and(
        eq(t.hubOpenPlayTemplates.id, input.templateId),
        eq(t.hubOpenPlayTemplates.hubId, input.hubId),
        eq(t.hubOpenPlayTemplates.active, true),
      ),
    )
    .limit(1);
  if (!template) return { ok: false, status: 404, message: "That open-play session is gone." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < isoDate()) {
    return { ok: false, status: 400, message: "Pick today or a future date." };
  }
  if (weekdayOf(input.date) !== template.weekday) {
    return { ok: false, status: 400, message: "That session does not run on this day." };
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.hubOpenPlaySignups)
    .where(
      and(
        eq(t.hubOpenPlaySignups.templateId, template.id),
        eq(t.hubOpenPlaySignups.date, input.date),
      ),
    );
  const count = countRow?.count ?? 0;
  if (count >= template.capacity) {
    return { ok: false, status: 409, message: "That session is full. Try the next one." };
  }

  await db
    .insert(t.hubOpenPlaySignups)
    .values({
      hubId: input.hubId,
      templateId: template.id,
      userId: input.userId,
      date: input.date,
    })
    .onConflictDoNothing();

  return {
    ok: true,
    session: {
      id: `${template.id}:${input.date}`,
      templateId: template.id,
      date: input.date,
      title: template.title,
      startTime: template.startTime,
      endTime: template.endTime,
      court: template.court,
      level: template.level,
      capacity: template.capacity,
      price: template.price,
      taken: count + 1,
      spotsLeft: Math.max(0, template.capacity - count - 1),
      joined: true,
    },
  };
}

/** Leaves an occurrence; the returned session is the player's new state. */
export async function leaveOpenPlay(input: {
  hubId: string;
  templateId: string;
  date: string;
  userId: string;
}): Promise<OpenPlayResult> {
  const [template] = await db
    .select()
    .from(t.hubOpenPlayTemplates)
    .where(
      and(
        eq(t.hubOpenPlayTemplates.id, input.templateId),
        eq(t.hubOpenPlayTemplates.hubId, input.hubId),
      ),
    )
    .limit(1);
  if (!template) return { ok: false, status: 404, message: "That open-play session is gone." };

  await db
    .delete(t.hubOpenPlaySignups)
    .where(
      and(
        eq(t.hubOpenPlaySignups.templateId, template.id),
        eq(t.hubOpenPlaySignups.date, input.date),
        eq(t.hubOpenPlaySignups.userId, input.userId),
      ),
    );

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.hubOpenPlaySignups)
    .where(
      and(
        eq(t.hubOpenPlaySignups.templateId, template.id),
        eq(t.hubOpenPlaySignups.date, input.date),
      ),
    );
  const count = countRow?.count ?? 0;
  return {
    ok: true,
    session: {
      id: `${template.id}:${input.date}`,
      templateId: template.id,
      date: input.date,
      title: template.title,
      startTime: template.startTime,
      endTime: template.endTime,
      court: template.court,
      level: template.level,
      capacity: template.capacity,
      price: template.price,
      taken: count,
      spotsLeft: Math.max(0, template.capacity - count),
      joined: false,
    },
  };
}

export type BookingResult =
  | { ok: true; bookingId: string; grid: HubCourtGrid }
  | { ok: false; status: number; message: string };

/**
 * Books one open slot. The unique index on (court, date, start) is the real
 * guard — two players clicking the same slot at once cannot both win, even
 * though both passed the read below.
 */
export async function createHubBooking(input: {
  hub: { id: string; name: string; comingSoon: boolean; hours: HubOperatingHours[] };
  courtId: string;
  date: string;
  startTime: string;
  userId: string;
}): Promise<BookingResult> {
  if (input.hub.comingSoon) {
    return { ok: false, status: 409, message: "This SportsHub is not taking bookings yet." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < isoDate()) {
    return { ok: false, status: 400, message: "Pick today or a future date." };
  }

  const [court] = await db
    .select({ id: t.hubCourts.id, name: t.hubCourts.name })
    .from(t.hubCourts)
    .where(and(eq(t.hubCourts.id, input.courtId), eq(t.hubCourts.hubId, input.hub.id)))
    .limit(1);
  if (!court) return { ok: false, status: 404, message: "That court is not at this SportsHub." };

  const grid = await loadCourtGrid(input.hub, input.date, input.userId);
  const slots = grid.courts.find((item) => item.id === input.courtId)?.slots ?? [];
  const slot = slots.find((item) => item.start === input.startTime);
  if (!slot) return { ok: false, status: 400, message: "That time is outside the venue's hours." };
  if (slot.status !== "open") {
    return { ok: false, status: 409, message: "That slot was just taken. Pick another one." };
  }

  const [inserted] = await db
    .insert(t.hubBookings)
    .values({
      hubId: input.hub.id,
      courtId: input.courtId,
      userId: input.userId,
      date: input.date,
      startTime: input.startTime,
      endTime: slot.end,
    })
    .onConflictDoNothing()
    .returning({ id: t.hubBookings.id });

  if (!inserted) {
    return { ok: false, status: 409, message: "That slot was just taken. Pick another one." };
  }

  return {
    ok: true,
    bookingId: inserted.id,
    grid: await loadCourtGrid(input.hub, input.date, input.userId),
  };
}

/** Cancels one of the caller's own bookings; false when it is not theirs. */
export async function cancelHubBooking(bookingId: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(t.hubBookings)
    .where(and(eq(t.hubBookings.id, bookingId), eq(t.hubBookings.userId, userId)))
    .returning({ id: t.hubBookings.id });
  return deleted.length > 0;
}

export async function sendHubMessage(input: {
  hubId: string;
  userId: string;
  fromName: string;
  fromEmail: string;
  body: string;
}): Promise<void> {
  await db.insert(t.hubMessages).values(input);
}

/**
 * Creates the public hub that mirrors an organizer's organization. Called at
 * organizer signup and by the hub seed script for organizations that predate
 * this table; safe to run twice.
 */
export async function ensureHubForOrganization(
  organization: Pick<typeof t.organizations.$inferSelect, "id" | "name" | "city" | "site">,
  ownerEmail = "",
): Promise<string | null> {
  const [existing] = await db
    .select({ id: t.sportsHubs.id })
    .from(t.sportsHubs)
    .where(eq(t.sportsHubs.organizationId, organization.id))
    .limit(1);
  if (existing) return existing.id;

  const baseSlug =
    organization.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sports-hub";
  const slug = `${baseSlug}-${organization.id.replace(/-/g, "").slice(0, 6)}`;
  const [city, country] = splitPlace(organization.city);
  const name = organization.name.trim() || "SportsHub";
  const [created] = await db
    .insert(t.sportsHubs)
    .values({
      organizationId: organization.id,
      slug,
      name,
      about: `${name} is a pickleball community in ${city || "the Philippines"}. Follow for open play, court bookings and tournaments.`,
      address: organization.city,
      city,
      country: country || "Philippines",
      email: ownerEmail,
      phone: "",
      logoColor: "#1f6b4a",
      coverColor: "#174f37",
      monogram: hubMonogram(name),
      memberCount: 0,
      hours: defaultHubHours(),
      comingSoon: false,
    })
    .onConflictDoNothing()
    .returning({ id: t.sportsHubs.id });
  if (created) return created.id;

  // A seeded hub already claimed this slug — leave it alone and let the
  // organizer see the directory without a second public page.
  return null;
}

/** Small helper the API routes use to resolve a hub + its hours. */
export async function hubForBooking(slug: string) {
  const [row] = await db
    .select({
      id: t.sportsHubs.id,
      name: t.sportsHubs.name,
      comingSoon: t.sportsHubs.comingSoon,
      hours: t.sportsHubs.hours,
    })
    .from(t.sportsHubs)
    .where(eq(t.sportsHubs.slug, slug))
    .limit(1);
  return row ?? null;
}

/** The formatter the UI uses; re-exported so pages do not import lib twice. */
export { formatHour };
