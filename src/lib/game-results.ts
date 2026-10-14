// Final-score client.
//
// Results live in Postgres behind /api/score; the public score page submits
// with its capability token (Bearer), the organizer score page with the
// session cookie. `applyGameResults` is a pure overlay: callers fetch the
// map and lay it over the seeded schedule, so the schedule page keeps its
// single source of truth for game rows.

import { parse } from "./api-client";

export type GameResult = {
  score: string;
  completedAt: string;
};

export type GameResults = Record<string, GameResult>;

/** Every saved result, keyed by game id. Public — scores are scoreboard data. */
export async function fetchGameResults(): Promise<GameResults> {
  const body = await parse<{ results: GameResults }>(await fetch("/api/score/results"));
  return body.results;
}

/**
 * Submits the final score for a game. Pass `token` (from a scanned QR link)
 * to authenticate as that game's crew; without one the session must be an
 * organizer. Throws the server's message on rejection.
 */
export async function submitGameResult(gameId: string, score: string, token?: string): Promise<GameResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = await parse<{ result: GameResult }>(
    await fetch(`/api/score/games/${encodeURIComponent(gameId)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ score }),
    }),
  );
  resultListeners.forEach((listener) => listener());
  return body.result;
}

/** Applies saved final scores over the seeded schedule. */
export function applyGameResults<T extends { id: string; score: string; status: string }>(
  schedule: readonly T[],
  results: GameResults,
): T[] {
  return schedule.map((game) => {
    const result = results[game.id];
    return result ? { ...game, score: result.score, status: "final" as const } : game;
  });
}

type ResultListener = () => void;
const resultListeners = new Set<ResultListener>();

/** Fires after this tab submits a result, so open views refresh. */
export function subscribeToGameResults(listener: ResultListener): () => void {
  resultListeners.add(listener);
  return () => { resultListeners.delete(listener); };
}
