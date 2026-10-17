// Server-side session reads.
//
// Used by the workspace layouts, which render on the server and can therefore
// do the check the edge middleware cannot: load the real session from the
// database and verify the role before a single byte of the workspace ships.

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, readUserFlags, type AppRole } from "./auth";
import type { AppSession } from "@/lib/auth";

/** Full server-side identity, including the id the client never sees. */
export type SessionUser = AppSession & { id: string };

/**
 * Loads the signed-in user for the current request, including their id.
 * Wrapped in React's cache() so multiple layouts/components in one render
 * share a single lookup.
 */
export const getServerSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user || typeof user.email !== "string") return null;

  const { role, username } = readUserFlags(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    username: username ?? undefined,
    role,
  };
});

/** Same lookup, without the id — what the client-shaped consumers expect. */
export const getServerSession = cache(async (): Promise<AppSession | null> => {
  const user = await getServerSessionUser();
  if (!user) return null;
  const { id: _id, ...rest } = user;
  return rest;
});

/**
 * Requires a session with the given role, redirecting otherwise. Call from a
 * server component layout/page; it never returns a mismatched session.
 *
 * This is the authoritative gate. Middleware only checks that *some* session
 * cookie exists — it runs on the edge and cannot reach the database — so a
 * stray or forged cookie is caught here instead, before the workspace renders.
 *
 * Returns the full identity (including `id`), so pages that need the user's
 * own rows — team profile, organization — can load them from the same cached
 * lookup that performed the check.
 */
export async function requireRole(role: AppRole): Promise<SessionUser> {
  const user = await getServerSessionUser();

  if (!user) redirect(`/login?next=/${role}`);
  if (user.role !== role) redirect(user.role === "player" ? "/player" : "/organizer");

  return user;
}
