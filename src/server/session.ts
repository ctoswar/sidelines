// Server-side session reads.
//
// Used by the workspace layouts, which render on the server and can therefore
// do the check the edge middleware cannot: load the real session from the
// database and verify the role before a single byte of the workspace ships.

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, readUserFlags, type AppRole } from "./auth";
import type { DemoSession } from "@/lib/auth";

/**
 * Loads the signed-in user for the current request. Wrapped in React's cache()
 * so multiple layouts/components in one render share a single lookup.
 */
export const getServerSession = cache(async (): Promise<DemoSession | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user || typeof user.email !== "string") return null;

  const { role, username } = readUserFlags(user);
  return {
    email: user.email,
    name: user.name ?? "",
    username: username ?? undefined,
    role,
  };
});

/**
 * Requires a session with the given role, redirecting otherwise. Call from a
 * server component layout/page; it never returns a mismatched session.
 *
 * This is the authoritative gate. Middleware only checks that *some* session
 * cookie exists — it runs on the edge and cannot reach the database — so a
 * stray or forged cookie is caught here instead, before the workspace renders.
 */
export async function requireRole(role: AppRole): Promise<DemoSession> {
  const session = await getServerSession();

  if (!session) redirect(`/login?next=/${role}`);
  if (session.role !== role) redirect(session.role === "player" ? "/player" : "/organizer");

  return session;
}
