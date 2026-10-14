"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/dashboard/use-toast";
import { submitGameResult } from "@/lib/game-results";
import type { Side } from "@/types";

const clock = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

interface State {
  score: Record<Side, number>;
  timeouts: Record<Side, number>;
  log: string[];
  stack: Side[];
  offline: boolean;
  queued: number;
  secs: number;
  running: boolean;
}
type Action =
  | { type: "point"; side: Side }
  | { type: "timeout"; side: Side }
  | { type: "undo" }
  | { type: "offline" }
  | { type: "pause" }
  | { type: "tick" }
  | { type: "reset" };

function makeInitial(scores: [number, number]): State {
  return {
    score: { a: scores[0], b: scores[1] }, timeouts: { a: 1, b: 1 }, log: [], stack: [],
    offline: false, queued: 0, secs: 0, running: false,
  };
}

// In the real app each action becomes a game_events row (queued locally when offline).
function makeReducer(names: [string, string]) {
  const initial = makeInitial([0, 0]);
  return function reducer(s: State, a: Action): State {
    const queued = (n = 1) => (s.offline ? s.queued + n : s.queued);
    switch (a.type) {
      case "point": {
        const score = { ...s.score, [a.side]: s.score[a.side] + 1 };
        return { ...s, score, stack: [...s.stack, a.side], queued: queued(), log: [`Point for ${names[a.side === "a" ? 0 : 1]}  ${score.a}–${score.b}`, ...s.log] };
      }
      case "timeout":
        return { ...s, timeouts: { ...s.timeouts, [a.side]: s.timeouts[a.side] - 1 }, queued: queued(), log: [`Timeout ${names[a.side === "a" ? 0 : 1]}`, ...s.log] };
      case "undo": {
        const side = s.stack[s.stack.length - 1];
        if (!side) return s;
        return { ...s, score: { ...s.score, [side]: s.score[side] - 1 }, stack: s.stack.slice(0, -1), queued: queued(), log: ["Undid last point", ...s.log] };
      }
      case "offline": return { ...s, offline: !s.offline, queued: s.offline ? 0 : s.queued };
      case "pause": return { ...s, running: !s.running };
      case "tick": return s.running ? { ...s, secs: s.secs + 1 } : s;
      case "reset": return makeInitial([0, 0]);
    }
  };
}

export interface ScorePanelProps {
  teams: [string, string];
  field: string;
  scheduleLabel?: string;
  target?: number;
  winBy?: number;
  label?: string;
  role?: string;
  /** Person's name — resolved from the QR token server-side, for the footer. */
  keeper?: string;
  /** Public (QR-scanned) mode: no dashboard redirect on finish. */
  publicMode?: boolean;
  /** Schedule id used to persist the final result for the organizer schedule. */
  gameId?: string;
  /**
   * Capability token from a scanned QR link. Sent as a Bearer credential so
   * the result endpoint can verify this person may score THIS game; without
   * it the session (organizer pages) authenticates instead.
   */
  token?: string;
}

export function ScorePanel({ teams, field, scheduleLabel, target = 11, winBy = 2, label, role, keeper, publicMode = false, gameId, token }: ScorePanelProps) {
  const router = useRouter();
  const { show, node } = useToast();
  const [s, dispatch] = useReducer(makeReducer(teams), [0, 0] as [number, number], makeInitial);
  const [bumped, setBumped] = useState<Side | null>(null);
  const submitting = useRef(false);
  const finished = (s.score.a >= target || s.score.b >= target) && Math.abs(s.score.a - s.score.b) >= winBy;

  useEffect(() => {
    if (!s.running) return;
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, [s.running]);

  useEffect(() => {
    if (!finished || !gameId) return;
    // Fire once per finished score; the reducer can't change the score after
    // finish without an undo, and the endpoint upserts anyway.
    if (submitting.current) return;
    submitting.current = true;
    submitGameResult(gameId, `${s.score.a}–${s.score.b}`, token)
      .catch((error: unknown) => {
        show(error instanceof Error ? error.message : "Could not save the final score");
      })
      .finally(() => { submitting.current = false; });
  }, [finished, gameId, s.score.a, s.score.b, token, show]);

  const toggleOffline = () => {
    if (s.offline && s.queued) show(`${s.queued} events synced`);
    dispatch({ type: "offline" });
  };

  const finish = () => {
    show(publicMode ? "Game finalized. Thanks for keeping score!" : "Game finalized. Standings updated.");
    dispatch({ type: "reset" });
    if (!publicMode) router.push("/organizer/schedule");
  };

  const scorePoint = (side: Side) => {
    setBumped(null);
    dispatch({ type: "point", side });
    requestAnimationFrame(() => setBumped(side));
  };

  // Footer meta line — keeper · role · division/tier (keeper + role only on scanned links).
  const meta = [!publicMode && keeper, !publicMode && role, label].filter(Boolean).join(" · ");

  return (
    <>
      <div className={`score-panel mx-auto max-w-sm overflow-hidden rounded-[2rem] border-4 border-line bg-bg shadow-xl${publicMode ? " score-panel-public" : ""}`}>
        {!publicMode && (
          <div className="score-panel-head flex items-center justify-between bg-field px-4 py-3 text-sm text-white">
            <span className="font-bold">{scheduleLabel ?? `${field} · Game to ${target}`}</span>
            <button onClick={toggleOffline} className={`rounded px-2 py-1 ${s.offline ? "bg-flag" : "bg-white/15"}`}>
              {s.offline ? `Offline · ${s.queued} queued` : "Online"}
            </button>
          </div>
        )}
        <div className="score-panel-clock bg-field pb-3 text-center text-sm text-white">
          <div className="score-clock-row">
             <span>Match clock <b className="score-clock tabular-nums">{clock(s.secs)}</b></span>
             <span className="score-rule">First to {target} · win by {winBy}</span>
            <span className="score-clock-actions">
              {publicMode && (
                <button onClick={toggleOffline} className={`score-connection ${s.offline ? "is-offline" : ""}`}>
                  <span className="score-connection-dot" aria-hidden="true" />
                  {s.offline ? `Offline · ${s.queued}` : "Online"}
                </button>
              )}
              <button onClick={() => dispatch({ type: "pause" })} className={`score-pause ${!s.running && s.secs === 0 ? "is-start" : ""}`}>
                {s.running ? "Pause" : s.secs === 0 ? "Start" : "Resume"}
              </button>
            </span>
          </div>
        </div>

        <div className="score-panel-teams grid grid-cols-2 divide-x divide-line">
          {teams.map((name, i) => {
            const side: Side = i === 0 ? "a" : "b";
            return (
              <div key={side} className={`score-side p-4 text-center ${bumped === side ? "is-scored" : ""} ${finished && s.score[side] >= target ? "is-winning" : ""}`}>
                <span className="score-side-index" aria-hidden="true">{i === 0 ? "A" : "B"}</span>
                <p className="score-team-name font-medium">{name}</p>
                <p className="score-value font-score text-8xl font-bold leading-none tabular-nums" aria-live="polite">{s.score[side]}</p>
                <button className="btn btn-pri score-point-button mt-3 w-full !py-4 text-lg" disabled={finished} onClick={() => scorePoint(side)}>
                  +1<span className="sr-only"> point for {name}</span>
                </button>
                <button className="btn mt-2 w-full" disabled={!s.timeouts[side]} onClick={() => dispatch({ type: "timeout", side })}>Timeout ({s.timeouts[side]})</button>
              </div>
            );
          })}
        </div>

        <div className="score-panel-footer px-4 pb-4">
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={!s.stack.length} onClick={() => dispatch({ type: "undo" })}>Undo</button>
            <button className="btn flex-1" disabled={!finished} onClick={finish}>Finish game</button>
          </div>
          {meta && <p className="mt-3 text-center text-xs uppercase tracking-wider text-muted">{meta}</p>}
          <p className="mb-1 mt-4 text-sm font-bold">Event log</p>
          <ul className="max-h-28 space-y-1 overflow-auto text-sm text-muted">
            {s.log.length ? s.log.map((l, i) => <li key={i}>{l}</li>) : <li>No events yet. Tap +1 point.</li>}
          </ul>
        </div>
      </div>
      {node}
    </>
  );
}
