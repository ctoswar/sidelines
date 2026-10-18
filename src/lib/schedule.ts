// Auto-fill API client — the schedule page's "Auto-fill schedule" button.

import { jsonRequest, parse } from "./api-client";

export type AutoFillResult = {
  /** Matches written in one run. */
  created: number;
  /** Courts they were spread across. */
  courts: number;
  /** Distinct time slots the run used. */
  slots: number;
};

/**
 * Generates the live tournament's schedule from its pool of entrants.
 * Organizer session; rejects with the server's message when it refuses
 * (no tournament, no courts, no entrants, or a schedule that already exists).
 */
export async function autoFillSchedule(): Promise<AutoFillResult> {
  return parse<AutoFillResult>(await fetch("/api/schedule/autofill", jsonRequest({})));
}
