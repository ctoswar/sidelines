// Better Auth server instance.
//
// Owns sign-up/sign-in/session handling against the Postgres schema from
// Phase 1. `role` and `username` are registered as additional user fields so
// they ride along with the standard email+password flow and come back on the
// session — which is what lets the app keep its player/organizer split.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import * as schema from "./schema";

export const ROLES = ["player", "organizer"] as const;
export type AppRole = (typeof ROLES)[number];

/** Normalizes a URL-ish value to a bare origin; null when empty/invalid. */
function toOrigin(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

/**
 * The origin a request arrived on — the host and scheme the browser actually
 * reached, which is not necessarily `BETTER_AUTH_URL`.
 *
 * `Host` comes from the URL the browser typed, so it can only ever name *this*
 * server; `x-forwarded-proto` only swaps the scheme, for TLS terminated at a
 * proxy in front of the app. Neither can be steered to a foreign origin.
 */
function requestOrigin(request: Request | undefined): string | null {
  if (!request) return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : url.protocol.replace(/:$/, "");
  const host = request.headers.get("host")?.trim() || url.host;
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return url.origin;
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Better Auth trusts only `BETTER_AUTH_URL` (localhost:3000 in .env) by
  // default, so every sign-in/sign-out/sign-up POST sent from
  // `http://192.168.75.101:3000` — how the Pi deployment is opened from other
  // machines, and how players' phones reach the QR links — came back as
  // `Invalid origin` and was rejected. Accept three things instead:
  //
  //   1. `NEXT_PUBLIC_APP_URL`, the public origin .env already declares.
  //   2. An optional comma-separated `AUTH_TRUSTED_ORIGINS` env var, for any
  //      additional origin (a separate frontend domain, a tunnel) known up
  //      front.
  //   3. The origin of the incoming request — whatever address this server was
  //      actually reached at: localhost, the Pi's LAN IP, an mDNS name, a
  //      reverse proxy's host. Nothing to keep in sync with .env when the
  //      address changes.
  //
  // (3) is not a blanket allow. It only accepts an `Origin` equal to the
  // address the request was sent to, so a page on any other site still fails
  // the check — the CSRF protection origin validation exists for is intact.
  trustedOrigins: (request) =>
    [
      toOrigin(process.env.NEXT_PUBLIC_APP_URL),
      ...(process.env.AUTH_TRUSTED_ORIGINS ?? "").split(",").map(toOrigin),
      requestOrigin(request),
    ].filter((origin): origin is string => origin !== null),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "player",
        required: false,
        input: true,
      },
      username: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  // Must be last: it lets Better Auth set session cookies from route handlers.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;

/**
 * Reads `role`/`username` off a Better Auth user.
 *
 * They are registered as additionalFields above, so they are present at
 * runtime, but Better Auth's generated `User` type only describes the built-in
 * columns. Rather than fight that with a module augmentation — `User` is a
 * type alias, which TypeScript refuses to augment — narrow it here once.
 */
export function readUserFlags(user: unknown): { role: AppRole; username: string | null } {
  const record = (user ?? {}) as Record<string, unknown>;
  return {
    role: record.role === "organizer" ? "organizer" : "player",
    username: typeof record.username === "string" && record.username ? record.username : null,
  };
}
