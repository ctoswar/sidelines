// Pickleball scoring rules — one place, one config.
//
// The score panel and the public demo scoreboard each used to hardcode their
// own numbers (target 11, win by 2, 1 timeout per side), while the organizer
// wizard shows 2 timeouts per side. This module is the single source of truth
// for what a "game" means until tournaments carry their own rule set.
//
// VERIFY against the official rulebook (USA Pickleball / local federation)
// before treating any value here as a rule:
//   - Standard competitive play is side-out scoring; several leagues (and
//     this app's current behaviour) use rally scoring. The mode below says
//     what the app actually does today — it must never be relabelled without
//     changing the point logic to match.
//   - Game target (11, 15 or 21) and best-of are event-level choices the
//     organizer should set per tournament.
export const SCORING = {
  /** How a point is won. "rally" = every rally scores (current behaviour). */
  mode: "rally" as "rally" | "side-out",
  /** Points needed to win a game, subject to winBy. */
  target: 11,
  /** Margin required once the target is reached. */
  winBy: 2,
  /** Timeouts each side gets per game. */
  timeoutsPerGame: 2,
  /** Server number (1 or 2) that doubles score calls carry — display only. */
  doublesServerNumbers: 2,
} as const;

/** The score line a game header shows, e.g. "Rally scoring · First to 11 · win by 2". */
export const scoringLabel = () =>
  `${SCORING.mode === "rally" ? "Rally scoring" : "Side-out scoring"} · First to ${SCORING.target} · win by ${SCORING.winBy}`;

/** True when `a`/`b` is a finished game under SCORING. */
export const isGameFinal = (a: number, b: number) => {
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  return winner >= SCORING.target && winner - loser >= SCORING.winBy;
};
