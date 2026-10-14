// Game crew client.
//
// Crew names live in Postgres behind /api/score/games; this module maps that
// route onto the Record<gameId, crew> shape the schedule and scorekeeper
// screens already speak. Saving notifies in-tab subscribers so the schedule
// picks up a rename without a reload (cross-tab sync arrives with SSE).

import { parse } from "./api-client";

export type GameCrew = {
  scorekeeper: string;
  umpire: string;
};

export type GameCrewMap = Record<string, GameCrew>;

/** Loads every game's assigned scorekeeper + umpire. Organizer only. */
export async function fetchGameCrew(): Promise<GameCrewMap> {
  const body = await parse<{ crew: GameCrewMap }>(await fetch("/api/score/games"));
  return body.crew;
}

/** Saves one game's names (no token mint). Notifies in-tab subscribers. */
export async function saveGameCrew(gameId: string, crew: GameCrew): Promise<void> {
  await parse<{ crew: GameCrew }>(
    await fetch(`/api/score/games/${encodeURIComponent(gameId)}/crew`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crew),
    }),
  );
  crewListeners.forEach((listener) => listener());
}

/** Mints (rotates) a game's capability tokens; returns them raw, once. */
export async function mintGameTokens(
  gameId: string,
  crew: GameCrew,
): Promise<{ scoreToken: string; umpireToken: string }> {
  return parse<{ scoreToken: string; umpireToken: string }>(
    await fetch(`/api/score/games/${encodeURIComponent(gameId)}/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crew),
    }),
  );
}

type CrewListener = () => void;
const crewListeners = new Set<CrewListener>();

/** Fires after this tab saves crew, so open views refresh. */
export function subscribeToGameCrew(listener: CrewListener): () => void {
  crewListeners.add(listener);
  return () => { crewListeners.delete(listener); };
}
