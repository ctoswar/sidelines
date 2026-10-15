// Team profile server helpers, shared by /api/team and /api/team/banner.
//
// The wire shape mirrors what the old localStorage profile held — except the
// banner travels as a stored path (`bannerPath`), never a data URL, and the
// client turns it into a cache-busted URL the same way Phase 3's photo works.

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/schema";
import { DEFAULT_TEAM } from "@/lib/team";

export type TeamRow = typeof t.teamProfiles.$inferSelect;

export type WireTeam = {
  name: string;
  tagline: string;
  /** Relative path under UPLOAD_DIR, or "" to use `preset`. */
  bannerPath: string;
  preset: string;
  accent: string;
  division: "mens" | "womens" | "mixed";
  seed: number;
};

/** Row -> wire shape; a player who never saved gets the seeded defaults. */
export function toTeamWire(row: TeamRow | null): WireTeam {
  return {
    name: row?.name ?? DEFAULT_TEAM.name,
    tagline: row?.tagline ?? DEFAULT_TEAM.tagline,
    bannerPath: row?.bannerPath ?? "",
    preset: row?.preset ?? DEFAULT_TEAM.preset,
    accent: row?.accent ?? DEFAULT_TEAM.accent,
    division: row?.division ?? DEFAULT_TEAM.division,
    seed: row?.seed ?? DEFAULT_TEAM.seed,
  };
}

export async function loadTeamRow(userId: string): Promise<TeamRow | null> {
  const [row] = await db
    .select()
    .from(t.teamProfiles)
    .where(eq(t.teamProfiles.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Upserts the player's team: `set` columns are written, everything else is
 * created from the seeded defaults (only `name` lacks a column default).
 * The banner upload uses the same path so a player who has never saved the
 * form still gets a row the moment they pick an image.
 */
export async function writeTeam(userId: string, set: Partial<WireTeam>): Promise<TeamRow> {
  const [row] = await db
    .insert(t.teamProfiles)
    .values({ userId, name: DEFAULT_TEAM.name, ...set })
    .onConflictDoUpdate({ target: t.teamProfiles.userId, set })
    .returning();
  if (!row) throw new Error("Could not save the team profile.");
  return row;
}
