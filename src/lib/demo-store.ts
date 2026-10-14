// Browser-persisted team profile shared between the player and organizer
// dashboards. This is the last demo store standing — registrations and
// announcements moved to /api in Phase 4, the team profile follows in Phase 5.

import { MY_TEAM } from "./mock-data";
import { DEFAULT_PRESET } from "./team-banner";
import type { DivisionId } from "./divisions";

const TEAM_KEY = "sidelines.demo.team";

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
