// Create (or promote) the admin account.
//
// The admin role has no signup form on purpose. It curates the homepage
// Spotlight, so nobody gets to mint one by asking over HTTP — the account is
// written here, against the database, and src/app/api/auth/signup/route.ts
// coerces any "admin" it is handed back down to "player".
//
// Safe to re-run: an existing account with this email is promoted to admin
// and its password reset to whatever this invocation was given, so this is
// also how you rotate the admin password.
//
// Usage:
//   npm run db:admin
//   npm run db:admin -- admin@sidelines.app 'a-brand-new-password'
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:admin

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../server/db";
import * as t from "../server/schema";

const DEFAULT_EMAIL = "admin@sidelines.app";
const DEFAULT_PASSWORD = "Sidelines!2026";

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? DEFAULT_PASSWORD;

  // Better Auth's email/password policy refuses anything shorter, and a
  // silent failure here would look like a successful run.
  if (password.length < 8) {
    throw new Error("Better Auth requires at least 8 characters — give a longer password.");
  }
  if (!email.includes("@")) {
    throw new Error(`"${email}" is not an email address.`);
  }

  const [existing] = await db
    .select({ id: t.user.id, role: t.user.role })
    .from(t.user)
    .where(eq(t.user.email, email))
    .limit(1);

  const userId = existing?.id ?? randomUUID();

  if (existing) {
    await db
      .update(t.user)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(t.user.id, existing.id));
  } else {
    await db.insert(t.user).values({
      id: userId,
      name: "Sidelines Admin",
      email,
      emailVerified: true,
      role: "admin",
    });
  }

  // The credential lives on the account row, keyed by provider — the same
  // shape Better Auth's own signUpEmail writes, so sign-in needs no special case.
  const hashed = await hashPassword(password);
  const [credential] = await db
    .select({ id: t.account.id })
    .from(t.account)
    .where(and(eq(t.account.userId, userId), eq(t.account.providerId, "credential")))
    .limit(1);

  if (credential) {
    await db
      .update(t.account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(t.account.id, credential.id));
  } else {
    await db.insert(t.account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    });
  }

  const wasPromoted = existing?.role !== "admin";
  console.log(wasPromoted ? `Admin ready: ${email}` : `Admin already existed — password reset: ${email}`);
  console.log("  Sign in at /login, then the Spotlight lives at /admin.");
  console.log("  Pass a new email/password as arguments to mint a different admin.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
