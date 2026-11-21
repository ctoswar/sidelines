// Shared SportsHub shapes + display helpers.
//
// Kept in lib (not server) because the Discover browser and the hub detail
// view are client components: they receive these objects from the server page
// and re-use the same date/hour formatting without importing the DB layer.

import type { EventItem } from "@/types";

export type HubOperatingHours = {
  day: string;
  /** "HH:MM" 24h. */
  open: string;
  /** "HH:MM" 24h. */
  close: string;
  closed?: boolean;
};

export type HubCard = {
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
  followerCount: number;
  following: boolean;
  comingSoon: boolean;
  courtCount: number;
  lat: number | null;
  lng: number | null;
};

export type HubCourtSlot = {
  start: string;
  end: string;
  /** open = bookable, booked = someone else's, mine = this player's. */
  status: "open" | "booked" | "mine";
  bookingId?: string;
};

export type HubCourt = {
  id: string;
  name: string;
  surface: string;
  indoor: boolean;
  hourlyRate: string;
  slots: HubCourtSlot[];
};

export type HubCourtGrid = {
  date: string;
  hours: { open: string; close: string } | null;
  courts: HubCourt[];
};

export type HubOpenPlaySession = {
  /** Stable id: template + date, so the UI can key and share it. */
  id: string;
  templateId: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  court: string;
  level: string;
  capacity: number;
  price: string;
  /** Players already signed up for this occurrence, including the viewer. */
  taken: number;
  spotsLeft: number;
  joined: boolean;
};

export type HubPhoto = {
  id: string;
  caption: string;
  color: string;
};

export type HubNewsItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
};

export type HubDetail = HubCard & {
  about: string;
  phone: string;
  email: string;
  hours: HubOperatingHours[];
  courts: Omit<HubCourt, "slots">[];
  openPlay: HubOpenPlaySession[];
  photos: HubPhoto[];
  news: HubNewsItem[];
  events: EventItem[];
  initialCourtGrid: HubCourtGrid;
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** "06:00" -> "6am", "13:30" -> "1:30pm". */
export function formatHour(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "pm" : "am";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return minute === "00" ? `${hour}${suffix}` : `${hour}:${minute}${suffix}`;
}

/** "06:00" -> "6am to 10pm" (the detail page's operating-hours row). */
export function formatHoursRange(open: string, close: string): string {
  return `${formatHour(open)} to ${formatHour(close)}`;
}

/** Local calendar date as YYYY-MM-DD — never UTC-shifted. */
export function isoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Adds whole days to an ISO date without leaving local time. */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return isoDate(new Date(year, (month ?? 1) - 1, (day ?? 1) + days));
}

/** A seven-day strip: the selected date plus the six after it. */
export function weekFrom(iso: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(iso, index));
}

export function weekdayOf(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).getDay();
}

/** "Sat, Nov 22" — compact strip label. */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Saturday, November 21" — the Open Play date pill. */
export function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** The day number + weekday initial used by the date carousel. */
export function dayChip(iso: string): { number: string; weekday: string; month: string } {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return {
    number: String(date.getDate()),
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    month: date.toLocaleDateString("en-US", { month: "short" }),
  };
}

/** "Just now", "2h ago", "Nov 18" for news items. */
export function relativeNewsDate(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const hour = 3_600_000;
  if (diff < hour) return "Just now";
  if (diff < 24 * hour) return `${Math.max(1, Math.round(diff / hour))}h ago`;
  if (diff < 7 * 24 * hour) return `${Math.round(diff / (24 * hour))}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The mark on a hub tile: "Cebu Pickle Club" -> "CPC". */
export function hubMonogram(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "SH";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** Default opening hours used by every seeded/claimed hub. */
export function defaultHubHours(): HubOperatingHours[] {
  return DAY_NAMES.map((day) => ({
    day,
    open: "06:00",
    close: day === "Saturday" || day === "Sunday" ? "23:00" : "22:00",
  }));
}
