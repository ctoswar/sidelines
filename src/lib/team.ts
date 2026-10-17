// Team profile API client — replaces the old `sidelines.demo.team` localStorage store.
//
// The profile lives on /api/team; the uploaded banner is a separate multipart
// endpoint (like the Phase 3 photo) and arrives as a stored path the client
// turns into a cache-busted URL. An in-memory cache plus listeners replaces
// the old localStorage subscription: rename on the team page, the sidebar
// follows without a refetch.

import { parse } from "./api-client";
import { DEFAULT_PRESET } from "./team-banner";
import type { DivisionId } from "./divisions";

/**
 * The player's own team: what it is called, what its banner looks like, and
 * how it is labelled in the workspace. `name` is the display name — and, for
 * the schedule pages, the key games are matched on. The placeholder below is
 * only what a player who has not saved a team yet sees; it is never seeded
 * content, so renaming the team is what puts a real name in the sidebar and
 * the schedule filter.
 */
export type TeamProfile = {
  name: string;
  tagline: string;
  /** URL of the uploaded banner; "" means "use `preset`". */
  banner: string;
  preset: string;
  /** hex accent used for the monogram tile. */
  accent: string;
  division: DivisionId;
  seed: number;
};

export const DEFAULT_TEAM: TeamProfile = {
  name: "My Team",
  tagline: "",
  banner: "",
  preset: DEFAULT_PRESET,
  accent: "#c8ef70",
  division: "mens",
  seed: 1,
};

/** Wire shape: everything the JSON API returns, plus the stored banner path. */
type WireTeam = Omit<TeamProfile, "banner"> & { bannerPath: string };

function fromWire(wire: WireTeam): TeamProfile {
  const { bannerPath, ...rest } = wire;
  return {
    ...rest,
    // Cache-bust on demand: the banner URL is stable, the file behind it is not.
    banner: bannerPath ? `/api/team/banner?v=${encodeURIComponent(bannerPath)}` : "",
  };
}

let cached: TeamProfile = DEFAULT_TEAM;
let inflight: Promise<TeamProfile> | null = null;
const listeners = new Set<() => void>();

function commit(team: TeamProfile): TeamProfile {
  cached = team;
  listeners.forEach((listener) => listener());
  return team;
}

/** The team as last seen by this tab — the neutral placeholder until a fetch lands. */
export function getTeam(): TeamProfile {
  return cached;
}

/**
 * Fires whenever this tab learns about a team change (a fetch resolving or a
 * save), so the sidebar and the server-rendered pages can pick up a rename
 * without a full page reload.
 */
export function subscribeToTeam(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Loads the signed-in player's team; concurrent callers share one request. */
export function fetchTeam(): Promise<TeamProfile> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const body = await parse<{ team: WireTeam }>(await fetch("/api/team"));
        return commit(fromWire(body.team));
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/**
 * Persists the six editable fields and returns the team as the server sees
 * it. The banner is not part of this body — it changes through the upload
 * and delete calls below.
 */
export async function saveTeam(team: TeamProfile): Promise<TeamProfile> {
  const { banner: _ignored, ...fields } = team;
  const body = await parse<{ team: WireTeam }>(
    await fetch("/api/team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }),
  );
  return commit(fromWire(body.team));
}

/** Uploads a banner (already cropped to 1600×500); returns the fresh team. */
export async function uploadTeamBanner(file: File): Promise<TeamProfile> {
  const form = new FormData();
  form.append("banner", file);
  const body = await parse<{ team: WireTeam }>(
    await fetch("/api/team/banner", { method: "POST", body: form }),
  );
  return commit(fromWire(body.team));
}

/** Removes the banner; the preset gradient takes over again. */
export async function deleteTeamBanner(): Promise<TeamProfile> {
  const body = await parse<{ team: WireTeam }>(
    await fetch("/api/team/banner", { method: "DELETE" }),
  );
  return commit(fromWire(body.team));
}
