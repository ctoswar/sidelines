import type { Game } from "@/types";

/** Number each game in the order it appears on its field. */
export function getFieldGameNumbers(schedule: readonly Game[]) {
  const counts = new Map<string, number>();
  const numbers = new Map<string, number>();

  schedule.forEach((game) => {
    const number = (counts.get(game.field) ?? 0) + 1;
    counts.set(game.field, number);
    numbers.set(game.id, number);
  });

  return numbers;
}

export function fieldGameLabel(game: Game, numbers: ReadonlyMap<string, number>) {
  return `${game.field} · Game ${numbers.get(game.id) ?? 1}`;
}
