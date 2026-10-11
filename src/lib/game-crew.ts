import { keepers } from "@/lib/mock-data";

const CREW_KEY = "sidelines.demo.game-crew";
const CREW_EVENT = "sidelines:game-crew-updated";

export type GameCrew = {
  scorekeeper: string;
  umpire: string;
};

export type GameCrewMap = Record<string, GameCrew>;

export const getDefaultGameCrew = (): GameCrewMap => keepers.reduce<GameCrewMap>((result, keeper) => {
  if (!keeper.gameId) return result;
  const current = result[keeper.gameId] ?? { scorekeeper: "", umpire: "" };
  result[keeper.gameId] = keeper.role === "Scorer"
    ? { ...current, scorekeeper: keeper.name }
    : { ...current, umpire: keeper.name };
  return result;
}, {});

export function getGameCrew(): GameCrewMap {
  const fallback = getDefaultGameCrew();
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(CREW_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    return { ...fallback, ...(parsed as GameCrewMap) };
  } catch {
    return fallback;
  }
}

export function saveGameCrew(gameId: string, crew: GameCrew): void {
  if (typeof window === "undefined") return;
  const next = { ...getGameCrew(), [gameId]: crew };
  window.localStorage.setItem(CREW_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CREW_EVENT));
}

export function subscribeToGameCrew(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const refresh = () => listener();
  window.addEventListener(CREW_EVENT, refresh);
  window.addEventListener("storage", refresh);
  return () => {
    window.removeEventListener(CREW_EVENT, refresh);
    window.removeEventListener("storage", refresh);
  };
}
