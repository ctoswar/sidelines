import type { EventItem } from "@/types";

export const events: EventItem[] = [
  { slug: "harbor-spring-open", name: "Harbor Spring Open", start: "2026-10-07", end: "2026-10-09", city: "Manila", country: "Philippines", code: "PH", tags: ["Open", "Outdoor", "Tournament"], status: "upcoming", featured: true, live: true, teams: 8, color: "#1f6b4a", monogram: "HSO", hasLogo: true },
  { slug: "manila-mixed-classic", name: "Manila Mixed Classic 2026", start: "2026-11-14", end: "2026-11-15", city: "Quezon City", country: "Philippines", code: "PH", tags: ["Mixed", "Outdoor", "Tournament"], status: "upcoming", featured: true, teams: 12, color: "#14213d", monogram: "MMC", hasLogo: true },
  { slug: "cebu-beach-ultimate-cup", name: "Cebu Beach Ultimate Cup 2027", start: "2027-02-06", end: "2027-02-07", city: "Cebu", country: "Philippines", code: "PH", tags: ["Mixed", "Beach", "Tournament"], status: "upcoming", featured: true, teams: 10, color: "#0e7490", monogram: "CBC", hasLogo: true },
  { slug: "sakura-womens-indoor-league", name: "Sakura Women's Indoor League 2026", start: "2026-10-12", end: "2026-12-20", city: "Osaka", country: "Japan", code: "JP", tags: ["Women", "Indoor", "League"], status: "upcoming", teams: 10, color: "#be185d", monogram: "SWI", hasLogo: true },
  { slug: "singapore-mixed-league-s3", name: "Singapore Mixed League Season 3", start: "2026-10-25", end: "2027-02-28", city: "Singapore", country: "Singapore", code: "SG", tags: ["Mixed", "Outdoor", "League"], status: "upcoming", teams: 14, color: "#b91c1c", monogram: "SML", hasLogo: true },
  { slug: "hong-kong-winter-cup", name: "Hong Kong Winter Cup", start: "2026-12-12", end: "2026-12-13", city: "Hong Kong", country: "Hong Kong, China", code: "HK", tags: ["Open", "Indoor", "Tournament"], status: "upcoming", teams: 8, color: "#7c3aed", monogram: "HKW", hasLogo: true },
  { slug: "sydney-summer-mixed-series", name: "Sydney Summer Mixed Series", start: "2027-01-09", end: "2027-03-06", city: "Sydney", country: "Australia", code: "AU", tags: ["Mixed", "Outdoor", "League"], status: "upcoming", teams: 12, color: "#15803d", monogram: "SSM", hasLogo: true },
  { slug: "seoul-spring-invitational", name: "Seoul Spring Invitational 2027", start: "2027-03-20", end: "2027-03-21", city: "Seoul", country: "South Korea", code: "KR", tags: ["Open", "Outdoor", "Tournament"], status: "upcoming", teams: 16, color: "#1d4ed8", monogram: "SSI", hasLogo: false },
  { slug: "davao-open-2026", name: "Davao Open 2026", start: "2026-08-15", end: "2026-08-16", city: "Davao", country: "Philippines", code: "PH", tags: ["Open", "Outdoor", "Tournament"], status: "past", teams: 12, color: "#a16207", monogram: "DO", hasLogo: true },
  { slug: "bangkok-beach-classic", name: "Bangkok Beach Classic", start: "2026-07-04", end: "2026-07-05", city: "Bangkok", country: "Thailand", code: "TH", tags: ["Mixed", "Beach", "Tournament"], status: "past", teams: 10, color: "#0f766e", monogram: "BBC", hasLogo: true },
  { slug: "taipei-womens-cup", name: "Taipei Women's Cup", start: "2026-06-06", end: "2026-06-07", city: "Taipei", country: "Taiwan", code: "TW", tags: ["Women", "Outdoor", "Tournament"], status: "past", teams: 8, color: "#9333ea", monogram: "TWC", hasLogo: false },
];

export const filterGroups: { label: string; options: string[] }[] = [
  { label: "Division", options: ["Open", "Women", "Mixed"] },
  { label: "Setting", options: ["Outdoor", "Indoor", "Beach"] },
  { label: "Type", options: ["Tournament", "League"] },
];

// Fixed locale and UTC so server and browser render identical text.
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(new Date(`${iso}T00:00:00Z`));

const full: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export const formatRange = (a: string, b: string) =>
  a === b ? fmt(a, full) : `${fmt(a, full)} - ${fmt(b, full)}`;
export const dayOf = (iso: string) => fmt(iso, { day: "numeric" });
export const monthShort = (iso: string) => fmt(iso, { month: "short" }).toUpperCase();
export const monthLabel = (iso: string) => fmt(iso, { month: "long", year: "numeric" });

export const getEvent = (slug: string) => events.find((e) => e.slug === slug);
