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
  formatPeso,
  hubMonogram,
  isoDate,
  MAX_OPEN_PLAY_PLAYERS,
  OPEN_PLAY_CONVENIENCE_FEE,
  parsePeso,
  weekdayOf,
  type CheckoutQuote,
  type HubCard,
  type HubCourt,
  type HubCourtGrid,
  type HubDetail,
  type HubNewsItem,
  type HubOpenPlaySession,
  type HubOperatingHours,
  type HubPhoto,
  type HubVoucher,
  type OpenPlayOrder,
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

/**
 * The hubs linked to an organization the viewer owns. Both workspaces use this
 * to label "Your club" instead of rendering a follow action for one's own hub.
 */
async function ownedHubIds(userId: string | null, ids: string[]): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set();
  const rows = await db
    .select({ hubId: t.sportsHubs.id })
    .from(t.sportsHubs)
    .innerJoin(t.organizations, eq(t.sportsHubs.organizationId, t.organizations.id))
    .where(and(eq(t.organizations.ownerUserId, userId), inArray(t.sportsHubs.id, ids)));
  return new Set(rows.map((row) => row.hubId));
}

async function ownsHub(
  organizationId: string | null,
  userId: string | null,
): Promise<boolean> {
  if (!organizationId || !userId) return false;
  const [row] = await db
    .select({ id: t.organizations.id })
    .from(t.organizations)
    .where(
      and(eq(t.organizations.id, organizationId), eq(t.organizations.ownerUserId, userId)),
    )
    .limit(1);
  return Boolean(row);
}

function toCard(
  row: HubCardRow,
  counts: { courts: number; follows: number; following: boolean; owned: boolean },
): HubCard {
  const followers = row.memberCount + counts.follows;
  return {
    ...row,
    memberCount: followers,
    followerCount: followers,
    following: counts.following,
    ownedByViewer: counts.owned,
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
  const [courts, follows, followed, owned] = await Promise.all([
    courtCounts(ids),
    followCounts(ids),
    followedHubIds(userId, ids),
    ownedHubIds(userId, ids),
  ]);

  const cards = rows.map((row) =>
    toCard(row, {
      courts: courts.get(row.id) ?? 0,
      follows: follows.get(row.id) ?? 0,
      following: followed.has(row.id),
      owned: owned.has(row.id),
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
  const mine = new Map<string, number>();
  for (const signup of signups) {
    const key = `${signup.templateId}:${signup.date}`;
    taken.set(key, (taken.get(key) ?? 0) + 1);
    if (userId && signup.userId === userId) {
      joined.add(key);
      mine.set(key, (mine.get(key) ?? 0) + 1);
    }
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
        priceValue: parsePeso(template.price),
        taken: count,
        spotsLeft: Math.max(0, template.capacity - count),
        joined: joined.has(key),
        myPlayers: mine.get(key) ?? 0,
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

  const [
    courts,
    templates,
    photos,
    news,
    hubEventRows,
    linkedEventRows,
    follows,
    following,
    signups,
    ownedByViewer,
    viewerName,
  ] = await Promise.all([
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
      ownsHub(row.organizationId, userId),
      userId
        ? db
            .select({ name: t.user.name })
            .from(t.user)
            .where(eq(t.user.id, userId))
            .limit(1)
            .then(([result]) => result?.name ?? null)
        : Promise.resolve(null),
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
    ownedByViewer,
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
    viewerName,
    vouchers: await vouchersForViewer(row.id, userId),
  };
  return detail;
}

/** The public hub linked to an organizer's own organization, if one exists. */
export async function findHubForOrganization(
  organizationId: string,
): Promise<{ slug: string; name: string } | null> {
  const [row] = await db
    .select({ slug: t.sportsHubs.slug, name: t.sportsHubs.name })
    .from(t.sportsHubs)
    .where(eq(t.sportsHubs.organizationId, organizationId))
    .limit(1);
  return row ?? null;
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
  | { ok: true; session: HubOpenPlaySession; order: OpenPlayOrder | null }
  | { ok: false; status: number; message: string };

/** Seats already taken on one occurrence — every signup row is a seat. */
async function occurrenceCount(templateId: string, date: string): Promise<number> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(t.hubOpenPlaySignups)
    .where(
      and(eq(t.hubOpenPlaySignups.templateId, templateId), eq(t.hubOpenPlaySignups.date, date)),
    );
  return countRow?.count ?? 0;
}

function sessionState(
  template: typeof t.hubOpenPlayTemplates.$inferSelect,
  date: string,
  count: number,
  joined: boolean,
  myPlayers: number,
): HubOpenPlaySession {
  return {
    id: `${template.id}:${date}`,
    templateId: template.id,
    date,
    title: template.title,
    startTime: template.startTime,
    endTime: template.endTime,
    court: template.court,
    level: template.level,
    capacity: template.capacity,
    price: template.price,
    priceValue: parsePeso(template.price),
    taken: count,
    spotsLeft: Math.max(0, template.capacity - count),
    joined,
    myPlayers,
  };
}

/**
 * Resolves a checkout voucher against a session subtotal. Returns the
 * discount in pesos and whether the code was applied; an unknown or inactive
 * code leaves the quote untouched with the reason in `message`.
 */
async function resolveVoucher(
  hubId: string,
  rawCode: string,
  subtotal: number,
): Promise<{ applied: boolean; discount: number; code: string; message: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { applied: false, discount: 0, code: "", message: "" };
  const [voucher] = await db
    .select()
    .from(t.hubVouchers)
    .where(and(eq(t.hubVouchers.hubId, hubId), eq(t.hubVouchers.code, code)))
    .limit(1);
  if (!voucher || !voucher.active) {
    return { applied: false, discount: 0, code, message: "That voucher code is not valid here." };
  }
  const discount =
    voucher.kind === "percent"
      ? Math.round((subtotal * voucher.value) / 100)
      : Math.min(voucher.value, subtotal);
  return {
    applied: true,
    discount,
    code,
    message: voucher.kind === "percent" ? `${voucher.value}% off applied` : `${formatPeso(voucher.value)} off applied`,
  };
}

/**
 * The checkout quote for a session — what the Apply button and the confirm
 * screen both show. The confirm endpoint re-runs the same math server-side,
 * so a stale screen cannot charge less than the club is asking.
 */
export async function quoteOpenPlay(input: {
  hubId: string;
  templateId: string;
  playerCount: number;
  voucherCode: string;
}): Promise<{ ok: true; quote: CheckoutQuote } | { ok: false; status: number; message: string }> {
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

  const fee = parsePeso(template.price);
  if (fee === null) return { ok: false, status: 400, message: "This session is free to join." };
  const playerCount = Math.max(1, Math.min(MAX_OPEN_PLAY_PLAYERS, Math.floor(input.playerCount) || 1));
  const subtotal = fee * playerCount;
  const voucher = await resolveVoucher(input.hubId, input.voucherCode, subtotal);

  return {
    ok: true,
    quote: {
      playerCount,
      sessionFee: fee,
      subtotal,
      discount: voucher.discount,
      voucherCode: voucher.code,
      voucherApplied: voucher.applied,
      voucherMessage: voucher.message,
      convenienceFee: OPEN_PLAY_CONVENIENCE_FEE,
      total: Math.max(0, subtotal - voucher.discount) + OPEN_PLAY_CONVENIENCE_FEE,
    },
  };
}

/**
 * Books seats on one occurrence through the checkout. The account's own seat
 * plus each guest seat becomes one signup row (that is what capacity counts),
 * and paid sessions also write an order recording the money. The unique
 * (template, date, user, guest) index makes a double-click a no-op rather
 * than a duplicate seat.
 */
export async function joinOpenPlay(input: {
  hubId: string;
  templateId: string;
  date: string;
  userId: string;
  /** Guest seat names; the account's own seat is always first. */
  guestNames?: string[];
  voucherCode?: string;
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

  const guests = (input.guestNames ?? []).map((name) => name.trim());
  if (guests.length > MAX_OPEN_PLAY_PLAYERS - 1) {
    return { ok: false, status: 400, message: `Book up to ${MAX_OPEN_PLAY_PLAYERS} players.` };
  }
  if (guests.some((name) => !name)) {
    return { ok: false, status: 400, message: "Give every guest a name, or drop the empty seat." };
  }
  if (guests.some((name) => name.length > 40)) {
    return { ok: false, status: 400, message: "Keep guest names under 40 characters." };
  }
  const lowered = guests.map((name) => name.toLowerCase());
  if (new Set(lowered).size !== lowered.length) {
    return { ok: false, status: 400, message: "Each guest needs their own name." };
  }

  const count = await occurrenceCount(template.id, input.date);
  const seats = 1 + guests.length;
  if (count + seats > template.capacity) {
    const left = Math.max(0, template.capacity - count);
    return {
      ok: false,
      status: 409,
      message: left === 0 ? "That session is full. Try the next one." : `Only ${left} spot${left === 1 ? "" : "s"} left.`,
    };
  }

  const fee = parsePeso(template.price);

  // Free session: the legacy one-click join, no order to record.
  if (fee === null) {
    const inserted = await db
      .insert(t.hubOpenPlaySignups)
      .values({ hubId: input.hubId, templateId: template.id, userId: input.userId, date: input.date })
      .onConflictDoNothing()
      .returning({ id: t.hubOpenPlaySignups.id });
    if (inserted.length === 0) {
      return { ok: false, status: 409, message: "You already joined this session." };
    }
    return {
      ok: true,
      order: null,
      session: sessionState(template, input.date, count + 1, true, 1),
    };
  }

  // Paid session: confirm the money, then take the seats.
  const subtotal = fee * seats;
  const voucher = await resolveVoucher(input.hubId, input.voucherCode ?? "", subtotal);
  if ((input.voucherCode ?? "").trim() && !voucher.applied) {
    return { ok: false, status: 400, message: voucher.message };
  }
  const total = Math.max(0, subtotal - voucher.discount) + OPEN_PLAY_CONVENIENCE_FEE;

  const signups = await db
    .insert(t.hubOpenPlaySignups)
    .values([
      { hubId: input.hubId, templateId: template.id, userId: input.userId, date: input.date },
      ...guests.map((guestName) => ({
        hubId: input.hubId,
        templateId: template.id,
        userId: input.userId,
        date: input.date,
        guestName,
      })),
    ])
    .onConflictDoNothing()
    .returning({ id: t.hubOpenPlaySignups.id });
  if (signups.length !== seats) {
    return { ok: false, status: 409, message: "You already booked this session. Cancel it first." };
  }

  const [order] = await db
    .insert(t.hubOpenPlayOrders)
    .values({
      hubId: input.hubId,
      templateId: template.id,
      userId: input.userId,
      date: input.date,
      playerCount: seats,
      players: guests,
      sessionFee: fee,
      discount: voucher.discount,
      voucherCode: voucher.code,
      convenienceFee: OPEN_PLAY_CONVENIENCE_FEE,
      total,
    })
    .returning();

  return {
    ok: true,
    order: order
      ? {
          id: order.id,
          playerCount: order.playerCount,
          players: order.players,
          sessionFee: order.sessionFee,
          discount: order.discount,
          voucherCode: order.voucherCode,
          convenienceFee: order.convenienceFee,
          total: order.total,
        }
      : null,
    session: sessionState(template, input.date, count + seats, true, seats),
  };
}

/**
 * Cancels the viewer's booking on an occurrence — their own seat and every
 * guest seat, plus the order behind them. The convenience fee stays with the
 * club; the session fee comes back off the books.
 */
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

  const removed = await db
    .delete(t.hubOpenPlaySignups)
    .where(
      and(
        eq(t.hubOpenPlaySignups.templateId, template.id),
        eq(t.hubOpenPlaySignups.date, input.date),
        eq(t.hubOpenPlaySignups.userId, input.userId),
      ),
    )
    .returning({ id: t.hubOpenPlaySignups.id });

  const myPlayers = removed.length;
  if (myPlayers > 0) {
    await db
      .update(t.hubOpenPlayOrders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(t.hubOpenPlayOrders.templateId, template.id),
          eq(t.hubOpenPlayOrders.date, input.date),
          eq(t.hubOpenPlayOrders.userId, input.userId),
          eq(t.hubOpenPlayOrders.status, "confirmed"),
        ),
      );
  }

  const count = await occurrenceCount(template.id, input.date);
  return {
    ok: true,
    order: null,
    session: sessionState(template, input.date, count, false, 0),
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

// ---- Vouchers: the hub owner's discount codes -----------------------------

export type VoucherResult =
  | { ok: true; vouchers: HubVoucher[] }
  | { ok: false; status: number; message: string };

/** Whether this user owns the organization this hub belongs to. */
async function userOwnsHub(hubId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: t.sportsHubs.id })
    .from(t.sportsHubs)
    .innerJoin(t.organizations, eq(t.sportsHubs.organizationId, t.organizations.id))
    .where(and(eq(t.sportsHubs.id, hubId), eq(t.organizations.ownerUserId, userId)))
    .limit(1);
  return Boolean(row);
}

function voucherToWire(row: typeof t.hubVouchers.$inferSelect): HubVoucher {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind === "amount" ? "amount" : "percent",
    value: row.value,
    active: row.active,
  };
}

/** The hub's codes — owner only; other viewers get a 403, not the list. */
export async function listHubVouchers(hubId: string, userId: string): Promise<VoucherResult> {
  if (!(await userOwnsHub(hubId, userId))) {
    return { ok: false, status: 403, message: "Only the club owner can manage vouchers." };
  }
  const rows = await db
    .select()
    .from(t.hubVouchers)
    .where(eq(t.hubVouchers.hubId, hubId))
    .orderBy(desc(t.hubVouchers.createdAt));
  return { ok: true, vouchers: rows.map(voucherToWire) };
}

export async function createHubVoucher(
  hubId: string,
  userId: string,
  input: { code: string; kind: string; value: number },
): Promise<VoucherResult> {
  if (!(await userOwnsHub(hubId, userId))) {
    return { ok: false, status: 403, message: "Only the club owner can manage vouchers." };
  }
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) {
    return { ok: false, status: 400, message: "Codes are 2-20 letters, numbers or dashes." };
  }
  const kind = input.kind === "amount" ? "amount" : "percent";
  const value = Math.floor(Number(input.value));
  if (kind === "percent" && (!Number.isFinite(value) || value < 1 || value > 100)) {
    return { ok: false, status: 400, message: "Percent discounts run 1-100." };
  }
  if (kind === "amount" && (!Number.isFinite(value) || value < 1 || value > 100000)) {
    return { ok: false, status: 400, message: "Enter a peso amount of at least 1." };
  }
  const [existing] = await db
    .select({ id: t.hubVouchers.id })
    .from(t.hubVouchers)
    .where(and(eq(t.hubVouchers.hubId, hubId), eq(t.hubVouchers.code, code)))
    .limit(1);
  if (existing) {
    return { ok: false, status: 409, message: `Code ${code} already exists for this club.` };
  }
  const [row] = await db
    .insert(t.hubVouchers)
    .values({ hubId, code, kind, value })
    .returning();
  return { ok: true, vouchers: row ? [voucherToWire(row)] : [] };
}

export async function setHubVoucherActive(
  hubId: string,
  userId: string,
  id: string,
  active: boolean,
): Promise<VoucherResult> {
  if (!(await userOwnsHub(hubId, userId))) {
    return { ok: false, status: 403, message: "Only the club owner can manage vouchers." };
  }
  const rows = await db
    .update(t.hubVouchers)
    .set({ active })
    .where(and(eq(t.hubVouchers.id, id), eq(t.hubVouchers.hubId, hubId)))
    .returning();
  if (rows.length === 0) return { ok: false, status: 404, message: "That voucher is gone." };
  return { ok: true, vouchers: rows.map(voucherToWire) };
}

/** The codes a detail page shows in the owner panel (empty for non-owners). */
export async function vouchersForViewer(hubId: string, userId: string | null): Promise<HubVoucher[]> {
  if (!userId || !(await userOwnsHub(hubId, userId))) return [];
  const rows = await db
    .select()
    .from(t.hubVouchers)
    .where(eq(t.hubVouchers.hubId, hubId))
    .orderBy(desc(t.hubVouchers.createdAt));
  return rows.map(voucherToWire);
}

/** The formatter the UI uses; re-exported so pages do not import lib twice. */
export { formatHour };
