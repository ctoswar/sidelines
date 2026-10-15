// Live-tournament configuration API client — the schedule's first slot used
// to be the schedule-start localStorage key. Readers are organizer workspace
// pages; the public score pages get the value through the QR URL instead.

import { parse } from "./api-client";

export type LiveTournament = {
  id: string;
  name: string;
  /** First slot of the schedule, "HH:MM" 24h. */
  scheduleStart: string;
};

/** Reads the live tournament's schedule configuration. Organizer session. */
export async function fetchLiveTournament(): Promise<LiveTournament> {
  const body = await parse<{ tournament: LiveTournament }>(await fetch("/api/tournaments/live"));
  return body.tournament;
}

/** Sets the schedule's first slot; returns the tournament as saved. */
export async function saveScheduleStart(scheduleStart: string): Promise<LiveTournament> {
  const body = await parse<{ tournament: LiveTournament }>(
    await fetch("/api/tournaments/live", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleStart }),
    }),
  );
  return body.tournament;
}
