// Event registrations client.
//
// Registrations live in Postgres behind /api/events/[slug]/registrations;
// this module is what the event shell, the player's "My events" list and the
// organizer hub call. The server is the source of truth for the badge: the
// mutations return the fresh count + registered flag, so the UI flips from
// the answer rather than optimistic state.

import { parse } from "./api-client";

export type Registration = {
  id: string;
  slug: string;
  email: string;
  name: string;
  /** ISO timestamp — registrations are per-account, not per-browser. */
  at: string;
  /** The registrant's account role, or null when their account is gone. */
  role: string | null;
};

/** Per-event state: everyone gets count + their own flag; organizers the list. */
export type RegistrationState = {
  count: number;
  registered: boolean;
  registrations: Registration[] | null;
};

/** Fetches count + registered badge + (for organizers) the inbox rows. */
export async function fetchRegistrationState(slug: string): Promise<RegistrationState> {
  return parse<RegistrationState>(await fetch(`/api/events/${encodeURIComponent(slug)}/registrations`));
}

/** Registers the signed-in user; idempotent on the server. */
export async function registerForEvent(slug: string): Promise<RegistrationState> {
  return parse<RegistrationState>(
    await fetch(`/api/events/${encodeURIComponent(slug)}/registrations`, { method: "POST" }),
  );
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
  return body.registrations;
}

/** Organizer-side removal of any registration in the inbox. */
export async function removeRegistration(slug: string, id: string): Promise<void> {
  await parse<{ ok: boolean }>(
    await fetch(`/api/events/${encodeURIComponent(slug)}/registrations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
}

/** Live registration counts per event slug — the event hub list feed. */
export async function fetchRegistrationCounts(): Promise<Record<string, number>> {
  const body = await parse<{ events: Array<{ slug: string; registrationCount: number }> }>(
    await fetch("/api/events"),
  );
  return Object.fromEntries(body.events.map((e) => [e.slug, e.registrationCount]));
}
