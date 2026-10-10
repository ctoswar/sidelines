// Browser-persisted demo data shared between the player and organizer
// dashboards. Replaces what will become database tables — see wiki Roadmap.

import { getSession } from "./auth";
import { MY_TEAM } from "./mock-data";
import { DEFAULT_PRESET } from "./team-banner";
import type { DivisionId } from "./divisions";

const REG_KEY = "sidelines.demo.registrations";
const ANN_KEY = "sidelines.demo.announcements";
const TEAM_KEY = "sidelines.demo.team";

export type Registration = { slug: string; email: string; name: string; at: string };
export type Announcement = {
  id: string;
  slug: string;
  title: string;
  body: string;
  author: string;
  at: string;
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? (parsed as T) : fallback;
    if (fallback && typeof fallback === "object") {
      // Merge, so a record saved by an earlier build picks up new default fields.
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? ({ ...fallback, ...parsed } as T)
        : fallback;
    }
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

// ---------- registrations ----------

/** All registrations, tolerating the earlier slug-only storage shape. */
export function getRegistrations(slug?: string): Registration[] {
  const raw = read<unknown[]>(REG_KEY, []);
  const list: Registration[] = raw.flatMap((item) => {
    if (typeof item === "string") return [{ slug: item, email: "", name: "Guest", at: "" }];
    if (item && typeof item === "object" && "slug" in item) return [item as Registration];
    return [];
  });
  return slug ? list.filter((r) => r.slug === slug) : list;
}

export function myRegistrations(): Registration[] {
  const session = getSession();
  if (!session) return [];
  return getRegistrations().filter((r) => r.email === session.email);
}

export function isRegistered(slug: string): boolean {
  const session = getSession();
  if (!session) return false;
  return getRegistrations(slug).some((r) => r.email === session.email);
}

export function registerForEvent(slug: string): boolean {
  const session = getSession();
  if (!session) return false;
  const list = getRegistrations();
  if (list.some((r) => r.slug === slug && r.email === session.email)) return true;
  write(REG_KEY, [
    ...list,
    { slug, email: session.email, name: session.name, at: new Date().toISOString() },
  ]);
  return true;
}

export function unregisterFromEvent(slug: string): void {
  const session = getSession();
  if (!session) return;
  write(REG_KEY, getRegistrations().filter((r) => !(r.slug === slug && r.email === session.email)));
}

/** Organizer-side removal. */
export function removeRegistration(slug: string, email: string): void {
  write(REG_KEY, getRegistrations().filter((r) => !(r.slug === slug && r.email === email)));
}

// ---------- announcements ----------

export function getAnnouncements(slug?: string): Announcement[] {
  const list = read<Announcement[]>(ANN_KEY, [])
    .filter((a) => a && typeof a.slug === "string")
    .sort((a, b) => b.at.localeCompare(a.at));
  return slug ? list.filter((a) => a.slug === slug) : list;
}

export function addAnnouncement(input: { slug: string; title: string; body: string; author: string }): Announcement {
  const announcement: Announcement = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    slug: input.slug,
    title: input.title.trim(),
    body: input.body.trim(),
    author: input.author,
    at: new Date().toISOString(),
  };
  write(ANN_KEY, [announcement, ...getAnnouncements()]);
  return announcement;
}

export function removeAnnouncement(id: string): void {
  write(ANN_KEY, getAnnouncements().filter((a) => a.id !== id));
}

// ---------- team profile ----------

/**
 * The player's own team: what it is called, what its banner looks like, and
 * how it is labelled in the workspace. `name` is a display name only — the
 * seeded `MY_TEAM` constant stays the key used to match mock games, so
 * renaming "Ironwood" does not empty the schedule.
 */
export type TeamProfile = {
  name: string;
  tagline: string;
  /** data URL of an uploaded banner; "" means "use `preset`". */
  banner: string;
  preset: string;
  /** hex accent used for the monogram tile. */
  accent: string;
  division: DivisionId;
  seed: number;
};

export const DEFAULT_TEAM: TeamProfile = {
  name: MY_TEAM,
  tagline: "",
  banner: "",
  preset: DEFAULT_PRESET,
  accent: "#c8ef70",
  division: "mens",
  seed: 1,
};

export function getTeam(): TeamProfile {
  return read<TeamProfile>(TEAM_KEY, DEFAULT_TEAM);
}

type TeamListener = () => void;
const teamListeners = new Set<TeamListener>();

/**
 * Fires whenever the stored team profile changes, so the sidebar and the
 * server-rendered pages can pick up a rename without a full page reload.
 */
export function subscribeToTeam(listener: TeamListener): () => void {
  teamListeners.add(listener);
  return () => { teamListeners.delete(listener); };
}

/**
 * Persists the profile and returns it, or null when the browser refused the
 * write — an oversized banner is the usual cause, and the caller shows that.
 */
export function saveTeam(team: TeamProfile): TeamProfile | null {
  try {
    write(TEAM_KEY, team);
    const saved = getTeam();
    teamListeners.forEach((listener) => listener());
    return saved;
  } catch {
    return null;
  }
}
