// Publishing a tournament to the public catalogue.
//
// The app keeps two worlds: `tournaments` drives the organizer workspace
// (schedule, teams, scoring), and `events` + `event_details` drive everything
// a spectator sees — the Event hub list, the public event page, registrations
// and announcements. Nothing bridged them, so the wizard wrote only the first
// and a freshly created tournament was invisible on every public surface.
//
// This module writes the public pair for a tournament as it is created, inside
// the creation transaction, so the two worlds cannot drift apart.
//
// Publishing has to happen here rather than later: a `tournaments` row stores
// no dates (its summary lives in `meta`), so only the creation payload can
// name the event's start and end. Making a draft live afterwards therefore
// cannot publish it — there is nothing left to publish from.

import { eq } from "drizzle-orm";
import type { Database } from "./db";
import * as t from "./schema";
import { describeRange } from "@/lib/tournament-meta";

/** The transaction handle the create route already runs under. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type PublishInput = {
  tournamentId: string;
  name: string;
  startDate: string;
  /** Empty means a one-day event, matching the wizard's optional end date. */
  endDate?: string;
  courts?: number;
  divisions?: string[];
  scheduleStart: string;
  /** Where it happens. The wizard asks; the route falls back to the org's city. */
  city: string;
  country: string;
};

/** Brand palette — one stable colour per slug, the seeded events' look. */
const PALETTE = ["#1f6b4a", "#14213d", "#0e7490", "#9b2c2c", "#6b46c1", "#be185d", "#a16207", "#15803d"];

/**
 * Places the catalogue can label properly: an ISO-ish code and a whole-hour
 * GMT offset. Anything else renders as the plain city and runs on GMT+0, the
 * same as the generated fixtures for an unknown code.
 */
const PLACES: Record<string, { code: string; offset: number }> = {
  philippines: { code: "PH", offset: 8 },
  japan: { code: "JP", offset: 9 },
  singapore: { code: "SG", offset: 8 },
  "hong kong": { code: "HK", offset: 8 },
  australia: { code: "AU", offset: 11 },
  "south korea": { code: "KR", offset: 9 },
  thailand: { code: "TH", offset: 7 },
  taiwan: { code: "TW", offset: 8 },
  malaysia: { code: "MY", offset: 8 },
  "new zealand": { code: "NZ", offset: 12 },
};

/** Wizard division labels -> the tag vocabulary the event filters use. */
const DIVISION_TAGS: Record<string, string> = {
  open: "Open",
  women: "Women",
  "women's": "Women",
  mixed: "Mixed",
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** "Gentry Pickle Ball" -> "GPB", "Cebu Open" -> "CO" — the card's mark. */
function monogramFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words[0]) return "EV";
  const initials = words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
  return initials.length >= 2 ? initials : words[0].slice(0, 2).toUpperCase();
}

/** Stable 32-bit hash — the same slug always gets the same brand colour. */
function hash(value: string) {
  let h = 2166136261;
  for (const c of value) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Inclusive day count: Oct 18 → Oct 24 is 7 days; one date is 1 day. */
function daysBetween(start: string, end?: string) {
  const to = end && end >= start ? end : start;
  const from = Date.parse(`${start}T00:00:00Z`);
  const until = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(until)) return 1;
  return Math.max(1, Math.round((until - from) / 864e5) + 1);
}

/** "Manila, Philippines" -> ["Manila", "Philippines"]; a bare city -> [city, ""]. */
export function splitPlace(value: string): [string, string] {
  const [city, ...rest] = value.split(",").map((part) => part.trim()).filter(Boolean);
  return [city ?? "", rest.join(", ")];
}

/**
 * Writes the `events` + `event_details` pair for a tournament and returns the
 * slug every public link is built from.
 *
 * The slug is the tournament's name, plus a slice of the tournament id when
 * that name is already listed under different dates. Two tournaments that
 * share a name never share an event, and calling this twice for the same
 * tournament resolves to the same slug both times.
 */
export async function publishTournamentEvent(tx: Tx, input: PublishInput): Promise<{ slug: string }> {  const startDate = input.startDate;
  const endDate = input.endDate && input.endDate >= startDate ? input.endDate : startDate;
  const nameBase = slugify(input.name) || "event";
  const ownedSlug = `${nameBase}-${input.tournamentId.replace(/-/g, "").slice(0, 8)}`;

  // The base slug belongs to this tournament when the event already there
  // names the same tournament on the same dates — a repeat publish. Another
  // tournament's event with the same name is not ours, and gets the owned
  // slug instead. (Same name *and* same dates resolves to one shared event;
  // the catalogue has no tournament id to tell those two apart.)
  const [baseEvent] = await tx
    .select({ slug: t.events.slug, name: t.events.name, startDate: t.events.startDate, endDate: t.events.endDate })
    .from(t.events)
    .where(eq(t.events.slug, nameBase))
    .limit(1);
  const oursAlready =
    !!baseEvent && baseEvent.name === input.name && baseEvent.startDate === startDate && baseEvent.endDate === endDate;
  // Free base slug -> take it; occupied by our own event -> same slug again;
  // occupied by another tournament -> the slug only this tournament owns.
  const slug = !baseEvent ? nameBase : oursAlready ? baseEvent.slug : ownedSlug;

  const place = PLACES[input.country.trim().toLowerCase()];
  const code = place?.code ?? "";
  const offset = place?.offset ?? 0;
  const courts = input.courts ?? 1;
  const city = input.city.trim();
  const country = input.country.trim();
  const range = describeRange(startDate, endDate) || startDate;
  const divisions = (input.divisions?.length ? input.divisions : ["Open"]).map((d) => d.trim()).filter(Boolean);

  // Tags are the vocabulary the public filters match on, so a tournament's
  // divisions become the Division tags and every event is a Tournament.
  const tags = [
    ...new Set(divisions.map((d) => DIVISION_TAGS[d.toLowerCase()] ?? d)),
    "Tournament",
  ];

  const today = new Date().toISOString().slice(0, 10);

  await tx
    .insert(t.events)
    .values({
      slug,
      name: input.name,
      startDate,
      endDate,
      city,
      country,
      code,
      tags,
      // A tournament the organizer is still setting up is not happening yet.
      status: startDate < today ? "past" : "upcoming",
      featured: false,
      // Only a live tournament is ever published, so its event starts live.
      // setEventLive keeps the flag in step afterwards, when the tournament
      // returns to draft.
      live: true,
      // No teams are attached to a tournament yet; the wizard creates none.
      teamCount: 0,
      color: PALETTE[hash(slug) % PALETTE.length],
      monogram: monogramFor(input.name),
      hasLogo: true,
    })
    .onConflictDoNothing({ target: t.events.slug });

  const location = country ? `${city}, ${country}` : city;

  await tx
    .insert(t.eventDetails)
    .values({
      eventId: slug,
      about:
        `${input.name} comes to ${location} on ${range}. Play starts at ` +
        `${input.scheduleStart} across ${courts} court${courts === 1 ? "" : "s"}, ` +
        `with ${divisions.join(", ")} division${divisions.length === 1 ? "" : "s"}.`,
      venueName: "Venue to be confirmed",
      venueAddress: location,
      venueMapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,
      tzLabel: `GMT+${offset}`,
      tzOffset: offset,
      // Results, pools, brackets and stats arrive with the games themselves.
      hasResults: false,
      days: daysBetween(startDate, endDate),
      fields: courts,
      facts: [
        { label: "Dates", value: range },
        { label: "Courts", value: String(courts) },
        { label: "Divisions", value: divisions.join(", ") },
        { label: "First game", value: input.scheduleStart },
        { label: "Local time", value: `${city} (GMT+${offset})` },
        { label: "Entry fee", value: "Contact organizers" },
      ],
      teams: [],
      matches: [],
      pools: { A: [], B: [] },
      overall: [],
      bracket: [],
      players: [],
      mvp: [],
      crew: [],
      announcements: [],
    })
    .onConflictDoNothing({ target: t.eventDetails.eventId });

  return { slug };
}

/**
 * Mirrors a tournament's live/draft status onto its published event.
 *
 * `events.live` is what every public surface reads for "happening now": the
 * homepage's live-now counter, the Live badge on an event row, the Live now
 * pill on the event page, and the organizer events list. Nothing else writes
 * that column, so the two status flips (the create route demoting the old
 * live tournament, and the status PATCH) have to carry it across — otherwise
 * a tournament can be live in the workspace while its event still reads as
 * not live, and those badges never light up.
 *
 * Takes the transaction handle so callers can flip the tournament and its
 * event atomically. A tournament with no published event (a draft) is a no-op.
 */
export async function setEventLive(tx: Tx, eventSlug: string | null, live: boolean): Promise<void> {
  if (!eventSlug) return;
  await tx.update(t.events).set({ live }).where(eq(t.events.slug, eventSlug));
}
