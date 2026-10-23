// Event registrations client.
//
// Registrations live in Postgres behind /api/events/[slug]/registrations;
// this module is what the event shell, the player's "My events" list and the
// organizer hub call. The server is the source of truth for the badge: the
// mutations return the fresh count + registered flag, so the UI flips from
// the answer rather than optimistic state.

import { jsonRequest, parse } from "./api-client";
import { isDivisionId, type DivisionId } from "./divisions";
import type { EventItem } from "@/types";

export type Registration = {
  id: string;
  slug: string;
  email: string;
  name: string;
  /** ISO timestamp — registrations are per-account, not per-browser. */
  at: string;
  /** The registrant's account role, or null when their account is gone. */
  role: string | null;
  /**
   * The division they entered (mens | womens | mixed). Null only for rows
   * saved before the division picker shipped — the UI shows no badge there
   * rather than guessing.
   */
  division: DivisionId | null;
  /**
   * The joined event row — carried by GET /api/registrations (the "My
   * events" list renders from it); the per-event inbox omits it, the event
   * being the one the caller already asked for.
   */
  event?: EventItem | null;
};

/** Per-event state: everyone gets count + their own flag; organizers the list. */
export type RegistrationState = {
  count: number;
  registered: boolean;
  /** The signed-in user's own division, when registered. */
  division: DivisionId | null;
  registrations: Registration[] | null;
};

/** Fetches count + registered badge + (for organizers) the inbox rows. */
export async function fetchRegistrationState(slug: string): Promise<RegistrationState> {
  const state = await parse<RegistrationState>(await fetch(`/api/events/${encodeURIComponent(slug)}/registrations`));
  return { ...state, division: isDivisionId(state.division) ? state.division : null };
}

/**
 * Registers the signed-in user in a division; idempotent on the server.
 * A legacy row with no division is backfilled with the one picked here.
 */
export async function registerForEvent(slug: string, division: DivisionId): Promise<RegistrationState> {
  const state = await parse<RegistrationState>(
    await fetch(`/api/events/${encodeURIComponent(slug)}/registrations`, jsonRequest({ division })),
  );
  return { ...state, division: isDivisionId(state.division) ? state.division : null };
}

/** Cancels the signed-in user's registration; safe to call twice. */
export async function unregisterFromEvent(slug: string): Promise<RegistrationState> {
  return parse<RegistrationState>(
    await fetch(`/api/events/${encodeURIComponent(slug)}/registrations`, { method: "DELETE" }),
  );
}

/** The signed-in user's registrations across all events, newest first. */
export async function fetchMyRegistrations(): Promise<Registration[]> {
  const body = await parse<{ registrations: Registration[] }>(await fetch("/api/registrations"));
  return body.registrations.map((r) => ({ ...r, division: isDivisionId(r.division) ? r.division : null }));
}

/** Organizer-side removal of any registration in the inbox. */
export async function removeRegistration(slug: string, id: string): Promise<void> {
  await parse<{ ok: boolean }>(
    await fetch(`/api/events/${encodeURIComponent(slug)}/registrations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
}
