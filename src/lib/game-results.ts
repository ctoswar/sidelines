import type { Game } from "@/types";

const RESULTS_KEY = "sidelines.demo.game-results";
const RESULTS_EVENT = "sidelines:game-results-updated";

type SavedResult = {
  score: string;
  completedAt: string;
};

type SavedResults = Record<string, SavedResult>;

function readResults(): SavedResults {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RESULTS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as SavedResults;
  } catch {
    return {};
  }
}

/** Applies browser-saved final scores over the seeded schedule. */
export function applySavedGameResults(schedule: readonly Game[]): Game[] {
  const results = readResults();
  return schedule.map((game) => {
    const result = results[game.id];
    return result ? { ...game, score: result.score, status: "final" } : game;
  });
}

/** Marks a game finished and notifies other open dashboard views. */
export function markGameFinished(gameId: string, score: string): void {
  if (typeof window === "undefined") return;
  const results = readResults();
  results[gameId] = { score, completedAt: new Date().toISOString() };
  window.localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
  window.dispatchEvent(new Event(RESULTS_EVENT));
}

export function subscribeToGameResults(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const refresh = () => listener();
  window.addEventListener(RESULTS_EVENT, refresh);
  window.addEventListener("storage", refresh);
  return () => {
    window.removeEventListener(RESULTS_EVENT, refresh);
    window.removeEventListener("storage", refresh);
  };
}
