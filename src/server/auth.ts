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

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
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
