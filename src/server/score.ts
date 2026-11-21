// Capability-token scoring.
//
// A QR code is not a credential by itself — the old link carried `role` and
// `name` query params anyone could edit. Phase 4 mints a random token per
// crew slot (scorekeeper, umpire), stores it on `game_crew`, and puts only
// the token in the QR URL. The score page resolves the token server-side and
// the result endpoint demands a token (or an organizer session) for the game
// being written.
//
// Minting a game's tokens again rotates them, so re-printing a QR code
// revokes the previous links — matching the queue's "replacing a game
// replaces its old links" behaviour.

import { randomBytes } from "node:crypto";
import { and, eq, ne, or } from "drizzle-orm";
import { db } from "@/server/db";
import { publish } from "@/server/realtime";
import * as t from "@/server/schema";

export type ScoreRole = "scorer" | "umpire";

export type GameCrewNames = { scorekeeper: string; umpire: string };
export type GameResultValue = { score: string; completedAt: string };

const newToken = () => randomBytes(24).toString("base64url");

/** Resolves a raw token to the game + role it grants, or null if unknown/rotated. */
export async function resolveScoreToken(
  token: string,
): Promise<{ gameId: string; role: ScoreRole } | null> {
  if (!token) return null;
  const [row] = await db
    .select({ gameId: t.gameCrew.gameId, scoreToken: t.gameCrew.scoreToken })
    .from(t.gameCrew)
    .where(or(eq(t.gameCrew.scoreToken, token), eq(t.gameCrew.umpireToken, token)))
    .limit(1);
  if (!row) return null;
  return { gameId: row.gameId, role: row.scoreToken === token ? "scorer" : "umpire" };
}

/**
 * Resolves a token *for one game*: the scanned person's role + name plus both
 * crew slots. Returns null when the token is unknown, rotated, or belongs to
 * a different game than the URL claims — which is what makes editing the
 * game id in the link useless.
 */
export async function resolveScoreGrant(
  gameId: string,
  token: string,
): Promise<{ role: ScoreRole; person: string; crew: GameCrewNames } | null> {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(t.gameCrew)
    .where(eq(t.gameCrew.gameId, gameId))
    .limit(1);
  if (!row) return null;
  const crew = { scorekeeper: row.scorekeeper, umpire: row.umpire };
  if (token && row.scoreToken === token) return { role: "scorer", person: row.scorekeeper, crew };
  if (token && row.umpireToken === token) return { role: "umpire", person: row.umpire, crew };
  return null;
}

/** True when the game exists in the schedule table (FK target for crew/results). */
export async function gameExists(gameId: string): Promise<boolean> {
  const [row] = await db.select({ id: t.games.id }).from(t.games).where(eq(t.games.id, gameId)).limit(1);
  return Boolean(row);
}

/**
 * Crew names for every game that has a row — the schedule/scorekeeper feed.
 * Pass the organizer's organization id from the workspace so one club's crew
 * names never appear in another club's queue.
 */
export async function getGameCrewMap(
  organizationId?: string,
): Promise<Record<string, GameCrewNames>> {
  const rows = organizationId
    ? await db
        .select({ gameId: t.gameCrew.gameId, scorekeeper: t.gameCrew.scorekeeper, umpire: t.gameCrew.umpire })
        .from(t.gameCrew)
        .innerJoin(t.games, eq(t.gameCrew.gameId, t.games.id))
        .innerJoin(t.tournaments, eq(t.games.tournamentId, t.tournaments.id))
        .where(eq(t.tournaments.organizationId, organizationId))
    : await db.select().from(t.gameCrew);
  return Object.fromEntries(
    rows.map((r) => [r.gameId, { scorekeeper: r.scorekeeper, umpire: r.umpire }]),
  );
}

/** Saves both names without touching existing tokens. */
export async function saveCrewNames(
  gameId: string,
  crew: GameCrewNames,
): Promise<{ scorekeeper: string; umpire: string } | null> {
  if (!(await gameExists(gameId))) return null;
  const names = { scorekeeper: crew.scorekeeper.trim(), umpire: crew.umpire.trim() };
  await db
    .insert(t.gameCrew)
    .values({ gameId, ...names })
    .onConflictDoUpdate({ target: t.gameCrew.gameId, set: names });
  publish("crew");
  return names;
}

/** Saves the names and mints fresh tokens; returns the raw tokens once. */
export async function mintGameTokens(
  gameId: string,
  crew: GameCrewNames,
): Promise<{ scoreToken: string; umpireToken: string } | null> {
  if (!(await gameExists(gameId))) return null;
  const names = { scorekeeper: crew.scorekeeper.trim(), umpire: crew.umpire.trim() };
  const tokens = { scoreToken: newToken(), umpireToken: newToken() };
  await db
    .insert(t.gameCrew)
    .values({ gameId, ...names, ...tokens })
    .onConflictDoUpdate({ target: t.gameCrew.gameId, set: { ...names, ...tokens } });
  publish("crew");
  return tokens;
}

/**
 * Writes the final score: upserts `game_results` and marks the game row
 * final. Returns null when the game is not in the schedule, and
 * `"final"` when a result is already recorded — a stale QR token must never
 * silently rewrite published standings. Callers that may correct a result
 * (the organizer workspace) pass `allowFinalized`.
 */
export async function writeGameResult(
  gameId: string,
  score: string,
  { allowFinalized = false }: { allowFinalized?: boolean } = {},
): Promise<GameResultValue | null | "final"> {
  const [existing] = await db
    .select({ status: t.games.status })
    .from(t.games)
    .where(eq(t.games.id, gameId))
    .limit(1);
  if (!existing) return null;
  if (existing.status === "final" && !allowFinalized) return "final";

  const completedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(t.gameResults)
      .values({ gameId, score, completedAt })
      .onConflictDoUpdate({
        target: t.gameResults.gameId,
        set: { score, completedAt },
      });
    await tx.update(t.games).set({ score, status: "final" }).where(eq(t.games.id, gameId));
  });
  publish("results");
  return { score, completedAt: completedAt.toISOString() };
}

/**
 * Writes an in-play score without recording a result. The game row's score and
 * `live` status are what the public event page overlays, so spectators see the
 * current game; `game_results` and standings keep waiting for the final.
 * Returns `"final"` once the game is closed, so a late update cannot rewrite
 * a recorded result.
 */
export async function writeLiveScore(
  gameId: string,
  score: string,
): Promise<{ score: string } | null | "final"> {
  const [existing] = await db
    .select({ status: t.games.status })
    .from(t.games)
    .where(eq(t.games.id, gameId))
    .limit(1);
  if (!existing) return null;
  if (existing.status === "final") return "final";

  // The status check above is not enough on its own: a final submit can land
  // between the check and this write. The conditional update makes the final
  // result win, so a slow live request cannot overwrite a recorded score.
  const updated = await db
    .update(t.games)
    .set({ score, status: "live" })
    .where(and(eq(t.games.id, gameId), ne(t.games.status, "final")))
    .returning({ id: t.games.id });
  if (updated.length === 0) return "final";
  publish("results");
  return { score };
}

/** Every saved result, keyed by game id — what the schedule overlays. */
export async function listGameResults(): Promise<Record<string, GameResultValue>> {
  const rows = await db.select().from(t.gameResults);
  return Object.fromEntries(
    rows.map((r) => [r.gameId, { score: r.score, completedAt: r.completedAt.toISOString() }]),
  );
}
