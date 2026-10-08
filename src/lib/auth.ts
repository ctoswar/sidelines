import type { LoginInput, OrganizerSignupInput, PlayerSignupInput } from "@/lib/validators/auth";

export type Role = "player" | "organizer";
export type AuthResult = { ok: true; message: string; role: Role } | { ok: false; message: string };

export type DemoSession = { email: string; name: string; role: Role };
type DemoAccount = DemoSession & { password: string };
const ACCOUNTS_KEY = "sidelines.demo.accounts";
const SESSION_KEY = "sidelines.demo.session";
const EVENTS_KEY = "sidelines.demo.registrations";

export const homeFor = (role: Role) => (role === "player" ? "/player" : "/organizer");

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(window.localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

function write(key: string, value: unknown) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

export function getSession(): DemoSession | null { return read<DemoSession | null>(SESSION_KEY, null); }
export function isRegistered(slug: string) { return getSession() ? read<string[]>(EVENTS_KEY, []).includes(slug) : false; }
export function registerForEvent(slug: string) {
  if (!getSession()) return false;
  const registrations = read<string[]>(EVENTS_KEY, []);
  if (!registrations.includes(slug)) write(EVENTS_KEY, [...registrations, slug]);
  return true;
}

// Replace these stubs with your provider (Supabase, Better Auth, Auth.js...).
// Store the role on the user (e.g. profiles.role) and read it after sign-in.
export async function signIn(input: LoginInput): Promise<AuthResult> {
  await new Promise((r) => setTimeout(r, 500));
  const account = read<DemoAccount[]>(ACCOUNTS_KEY, []).find((item) => item.email.toLowerCase() === input.email.toLowerCase());
  if (account && account.password !== input.password) return { ok: false, message: "That password does not match this account." };
  // Keep the original demo shortcut for first-time testing, while real signups persist below.
  const role: Role = account?.role ?? (input.email.toLowerCase().startsWith("player") ? "player" : "organizer");
  const session = { email: account?.email ?? input.email, name: account?.name ?? "Demo user", role } satisfies DemoSession;
  write(SESSION_KEY, session);
  return { ok: true, role, message: `Logged in as ${session.email}.` };
}

export async function signUp(role: Role, input: PlayerSignupInput | OrganizerSignupInput): Promise<AuthResult> {
  await new Promise((r) => setTimeout(r, 500));
  const account = { email: input.email, name: input.name, password: input.password, role } satisfies DemoAccount;
  const accounts = read<DemoAccount[]>(ACCOUNTS_KEY, []);
  if (accounts.some((item) => item.email.toLowerCase() === account.email.toLowerCase())) return { ok: false, message: "An account with that email already exists. Try logging in." };
  write(ACCOUNTS_KEY, [...accounts, account]);
  write(SESSION_KEY, { email: account.email, name: account.name, role } satisfies DemoSession);
  return { ok: true, role, message: "Account created. You are now signed in." };
}

export async function signInWithGoogle(): Promise<{ message: string }> {
  return { message: "Google sign-in would start here (demo)." };
}
