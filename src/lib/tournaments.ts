// Live-tournament configuration API client — the schedule's first slot used
// to be the schedule-start localStorage key. Readers are organizer workspace
// pages; the public score pages get the value through the QR URL instead.

import { jsonRequest, parse } from "./api-client";

export type LiveTournament = {
  id: string;
  name: string;
  /** First slot of the schedule, "HH:MM" 24h. */
  scheduleStart: string;
};

/** A tournament as the workspace manages it: identity, summary, and status. */
export type TournamentConfig = LiveTournament & {
  meta: string;
  status: "live" | "draft";
  /**
   * The public catalogue entry a live tournament is published under — the
   * Event hub page and the spectator page both live at this slug. Null when
   * the tournament was parked as a draft.
   */
  eventSlug?: string | null;
};

/** What the new-tournament wizard sends; `meta` is built server-side. */
export type TournamentDraft = {
  name: string;
  startDate: string;
  endDate?: string;
  courts?: number;
  divisions?: string[];
  /** Where the tournament is listed publicly, as "City, Country". */
  city?: string;
  country?: string;
  scheduleStart: string;
  /**
   * "live" makes this the tournament the workspace configures (schedule
   * start, pool table, scoring); "draft" parks it for later.
   */
  status?: "live" | "draft";
};

/** Creates a tournament for the signed-in organizer. Organizer session. */
export async function createTournament(draft: TournamentDraft): Promise<TournamentConfig> {
  const body = await parse<{ tournament: TournamentConfig }>(
    await fetch("/api/tournaments", jsonRequest(draft)),
  );
  return body.tournament;
}

/**
 * Flips a tournament between live and draft. Making one live returns any
 * other live tournament to draft — the workspace has exactly one.
 */
export async function setTournamentStatus(
  id: string,
  status: "live" | "draft",
): Promise<TournamentConfig> {
  const body = await parse<{ tournament: TournamentConfig }>(
    await fetch(`/api/tournaments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
  return body.tournament;
}

/** Reads the live tournament's schedule configuration. Organizer session. */
export async function fetchLiveTournament(): Promise<LiveTournament> {
  const body = await parse<{ tournament: LiveTournament }>(await fetch("/api/tournaments/live"));
  return body.tournament;
}
