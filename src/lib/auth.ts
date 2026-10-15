// Client-side auth facade.
//
// Every consumer in the app talks to this module through the same shape the
// old localStorage demo exposed — getSession(), signIn(), signUp(), signOut(),
// homeFor(), AUTH_CHANGED_EVENT — so switching the backing store did not
// mean rewriting call sites.
//
// The one real change: Better Auth keeps the session in an httpOnly cookie on
// the server, so the session can no longer be read synchronously from
// localStorage. getSession() stays synchronous for callbacks that already
// exist (event handlers), but it reads a module-level cache that
// refreshSession()/useSession() fill from the server. Components that need
// the session on mount use useSession().

import { useCallback, useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";
import type {
  LoginInput,
  OrganizerSignupInput,
  PlayerSignupInput,
} from "@/lib/validators/auth";

export type Role = "player" | "organizer";
export type AuthResult =
  | { ok: true; message: string; role: Role }
  | { ok: false; message: string };

export type DemoSession = { email: string; name: string; username?: string; role: Role };

export const homeFor = (role: Role) => (role === "player" ? "/player" : "/organizer");

/** Fired when the session changes, so UI outside the workspace can react. */
export const AUTH_CHANGED_EVENT = "sidelines:auth-changed";

const authClient = createAuthClient();

// ---------- session cache ----------

let cachedSession: DemoSession | null = null;

/** Narrow Better Auth's user payload to the fields the app cares about. */
function toSession(user: unknown): DemoSession | null {
  if (!user || typeof user !== "object") return null;
  const u = user as Record<string, unknown>;
  if (typeof u.email !== "string") return null;
  return {
    email: u.email,
    name: typeof u.name === "string" ? u.name : "",
    username: typeof u.username === "string" ? u.username : undefined,
    role: u.role === "organizer" ? "organizer" : "player",
  };
}

/**
 * Synchronous read of the last session fetched from the server. Returns null
 * before the first refreshSession()/useSession() — callers in event handlers
 * run after mount, by which point the cache is warm.
 */
export function getSession(): DemoSession | null {
  return cachedSession;
}

/** Fetches the server session into the cache and notifies listeners. */
export async function refreshSession(): Promise<DemoSession | null> {
  const { data } = await authClient.getSession();
  const next = toSession(data?.user);
  const changed = next?.email !== cachedSession?.email || next?.role !== cachedSession?.role;
  cachedSession = next;
  // Only broadcast real changes: refreshSession() runs on mount and on focus,
  // and a flood of identical events would make every listener re-render.
  if (changed) window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  return cachedSession;
}

/**
 * React hook form of the session. Fetches on mount, re-syncs when another
 * part of the app broadcasts a change (sign-out from the header) and on
 * focus, which covers signing out in another tab.
 */
export function useSession(): DemoSession | null {
  const [session, setSession] = useState<DemoSession | null>(cachedSession);

  const sync = useCallback(() => {
    void refreshSession().then(setSession);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, [sync]);

  return session;
}

// ---------- actions ----------

export async function signIn(input: LoginInput): Promise<AuthResult> {
  const { data, error } = await authClient.signIn.email({
    email: input.email,
    password: input.password,
  });

  if (error) {
    return { ok: false, message: friendlyAuthError(error) };
  }

  const session = toSession(data?.user) ?? (await refreshSession());
  if (!session) return { ok: false, message: "Signed in, but the session could not be read." };

  cachedSession = session;
  return { ok: true, role: session.role, message: `Logged in as ${session.email}.` };
}

export async function signUp(
  role: Role,
  input: PlayerSignupInput | OrganizerSignupInput,
): Promise<AuthResult> {
  // The composite route creates the credential and the profile/organization
  // row together — Better Auth alone would leave the account with no profile.
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, role }),
  });

  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    message?: string;
    role?: Role;
  } | null;

  if (!response.ok || !result?.ok) {
    return { ok: false, message: result?.message ?? "Could not create the account. Try again." };
  }

  await refreshSession();
  return { ok: true, role, message: result.message ?? "Account created. You are now signed in." };
}

export async function signOut(): Promise<void> {
  // Clear locally first so the UI flips immediately even if the network is
  // slow; the server call invalidates the cookie in the background.
  cachedSession = null;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  await authClient.signOut().catch(() => undefined);
}

/**
 * Google sign-in stays a stub — OAuth needs client IDs and callback URLs that
 * do not exist yet. Kept so the button on both auth screens keeps working.
 */
export async function signInWithGoogle(): Promise<{ message: string }> {
  return { message: "Google sign-in would start here (demo)." };
}

// ---------- errors ----------

/** Turns Better Auth's error codes into the wording the forms already show. */
function friendlyAuthError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That password does not match this account.";
    case "USER_ALREADY_EXISTS":
      return "An account with that email already exists. Try logging in.";
    case "USERNAME_TAKEN":
      return "That username is already taken. Try another one.";
    case "WEAK_PASSWORD":
      return "Use at least 8 characters for your password.";
    default:
      return error.message || "Could not sign you in. Try again.";
  }
}
