// Player profile API.
//
//   GET /api/profile  — the signed-in player's profile (identity + details)
//   PUT /api/profile  — update it
//
// Identity fields (username/name/email) live on the Better Auth `user` row;
// everything else lands in `player_profiles`. Email is just a column on the
// user — Better Auth finds the credential account through the user id, so
// sign-in keeps working after a change without touching the account table.

import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { getServerSessionUser } from "@/server/session";
import { profileUpdateSchema } from "@/lib/validators/profile";

/** Composes the API shape from the user row + its profile row. */
function toProfile(user: { name: string; email: string; username?: string }, profile: typeof t.playerProfiles.$inferSelect | null) {
  return {
    username: user.username ?? "",
    name: user.name,
    email: user.email,
    nickname: profile?.nickname ?? "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    gender: profile?.gender ?? "Prefer not to say",
    nationality: profile?.nationality ?? "",
    city: profile?.city ?? "",
    format: profile?.format ?? "Singles",
    experience: profile?.experience ?? "Recreational",
    dominantHand: profile?.dominantHand ?? "Right",
    playingSince: profile?.playingSince ?? "",
    match: profile?.match ?? "Open",
    number: profile?.number ?? "",
    bio: profile?.bio ?? "",
    profileColor: profile?.profileColor ?? "#c8ef70",
    photoPath: profile?.photoPath ?? null,
  };
}

async function loadProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(t.playerProfiles)
    .where(eq(t.playerProfiles.userId, userId))
    .limit(1);
  return profile ?? null;
}

export async function GET() {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "player") {
    return NextResponse.json({ message: "Only player accounts have a player profile." }, { status: 403 });
  }

  const profile = await loadProfile(user.id);
  return NextResponse.json({ profile: toProfile(user, profile) });
}

export async function PUT(request: Request) {
  const user = await getServerSessionUser();
  if (!user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  if (user.role !== "player") {
    return NextResponse.json({ message: "Only player accounts have a player profile." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Send a JSON body." }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Check the form and try again.", path: first?.path.join(".") },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  // Reject duplicates up front so the user gets our wording, not a driver error.
  const [emailTaken, usernameTaken] = await Promise.all([
    db.select({ id: t.user.id }).from(t.user)
      .where(and(ne(t.user.id, user.id), eq(t.user.email, email))).limit(1),
    db.select({ id: t.user.id }).from(t.user)
      .where(and(ne(t.user.id, user.id), eq(t.user.username, data.username))).limit(1),
  ]);
  if (emailTaken.length > 0) {
    return NextResponse.json(
      { message: "Another account already uses that email.", path: "email" },
      { status: 409 },
    );
  }
  if (usernameTaken.length > 0) {
    return NextResponse.json(
      { message: "That username is already taken. Try another one.", path: "username" },
      { status: 409 },
    );
  }

  const profileFields = {
    nickname: data.nickname ?? "",
    dateOfBirth: data.dateOfBirth ?? "",
    gender: data.gender,
    nationality: data.nationality ?? "",
    city: data.city ?? "",
    format: data.format,
    experience: data.experience,
    dominantHand: data.dominantHand,
    playingSince: data.playingSince ?? "",
    match: data.match,
    number: data.number ?? "",
    bio: data.bio ?? "",
    profileColor: data.profileColor,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    await tx.update(t.user)
      .set({ name: data.name, username: data.username, email, updatedAt: new Date() })
      .where(eq(t.user.id, user.id));

    // No account-table write: Better Auth keys the credential account on
    // accountId === user.id and finds it via findUserByEmail, so changing
    // user.email is all a sign-in email change needs. (An earlier version
    // rewrote account.accountId to the email here, which detached the
    // credential row and made the account un-signable-in.)

    await tx.insert(t.playerProfiles).values({ userId: user.id, ...profileFields })
      .onConflictDoUpdate({ target: t.playerProfiles.userId, set: profileFields });
  });

  const profile = await loadProfile(user.id);
  return NextResponse.json({ profile: toProfile({ ...user, email, name: data.name, username: data.username }, profile) });
}
