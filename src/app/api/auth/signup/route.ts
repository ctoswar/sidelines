// POST /api/auth/signup
//
// The client-side signup forms collect far more than an email + password —
// players fill in a whole pickleball profile, organizers fill in an
// organization. Better Auth only owns the credential, so this handler does
// both: create the account through Better Auth's server API, then write the
// matching profile/organization row in the same request.
//
// One extra hop over the plain Better Auth endpoint, but it keeps the
// existing form payloads untouched and avoids leaving an account with no
// profile behind it.

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { auth, type AppRole } from "@/server/auth";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import {
  organizerSignupSchema,
  playerSignupSchema,
} from "@/lib/validators/auth";

type PlayerBody = Record<string, unknown>;

/** Maps the signup payload onto a player_profiles row. */
function playerProfileRow(userId: string, body: PlayerBody) {
  const text = (key: string) => {
    const value = body[key];
    return typeof value === "string" ? value : "";
  };
  return {
    userId,
    nickname: text("nickname"),
    dateOfBirth: text("dateOfBirth"),
    gender: text("gender") || "Prefer not to say",
    nationality: text("nationality"),
    city: text("city"),
    format: text("position") || "Singles",
    experience: text("level") || "Recreational",
    dominantHand: text("dominantHand") || "Right",
    playingSince: text("playingSince"),
    match: text("match") || "Open",
    number: text("number"),
    bio: text("bio"),
    profileColor: text("profileColor") || "#c8ef70",
  };
}

function organizationRow(ownerUserId: string, body: PlayerBody) {
  const text = (key: string) => {
    const value = body[key];
    return typeof value === "string" ? value : "";
  };
  return {
    ownerUserId,
    name: text("org"),
    orgType: text("orgType"),
    title: text("title"),
    volume: text("volume"),
    city: text("city"),
    site: text("site") || null,
  };
}

export async function POST(request: Request) {
  let body: PlayerBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Send a JSON body." }, { status: 400 });
  }

  const role: AppRole = body.role === "organizer" ? "organizer" : "player";

  // Same schemas the forms already run, re-checked server-side.
  const parsed = role === "organizer"
    ? organizerSignupSchema.safeParse(body)
    : playerSignupSchema.safeParse(body);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, message: first?.message ?? "Check the form and try again." },
      { status: 400 },
    );
  }

  // Reject duplicates up front so the user gets our wording, not a driver error.
  const email = String(body.email).toLowerCase();
  const username = String(body.username).toLowerCase();
  const [emailTaken, usernameTaken] = await Promise.all([
    db.select({ id: t.user.id }).from(t.user).where(sql`lower(${t.user.email}) = ${email}`).limit(1),
    db.select({ id: t.user.id }).from(t.user).where(sql`lower(${t.user.username}) = ${username}`).limit(1),
  ]);
  if (emailTaken.length > 0) {
    return NextResponse.json(
      { ok: false, message: "An account with that email already exists. Try logging in." },
      { status: 409 },
    );
  }
  if (usernameTaken.length > 0) {
    return NextResponse.json(
      { ok: false, message: "That username is already taken. Try another one." },
      { status: 409 },
    );
  }

  // Better Auth creates the credential + a session cookie. `username`/`role`
  // are additionalFields (see src/server/auth.ts); the generated input type
  // only describes built-in columns, hence the cast.
  type SignUpBody = NonNullable<Parameters<typeof auth.api.signUpEmail>[0]>["body"];
  const created = await auth.api.signUpEmail({
    body: {
      email,
      password: String(body.password),
      name: String(body.name),
      username,
      role,
    } as SignUpBody,
  });

  if (!created?.user?.id) {
    return NextResponse.json(
      { ok: false, message: "Could not create the account. Try again." },
      { status: 500 },
    );
  }

  const userId = created.user.id;

  if (role === "player") {
    await db.insert(t.playerProfiles).values(playerProfileRow(userId, body));
  } else {
    await db.insert(t.organizations).values(organizationRow(userId, body));
  }

  return NextResponse.json({ ok: true, role, message: "Account created. You are now signed in." });
}
