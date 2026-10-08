"use client";

import { useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/dashboard/use-toast";
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
  | { type: "goal"; side: Side }
  | { type: "timeout"; side: Side }
  | { type: "undo" }
  | { type: "offline" }
  | { type: "pause" }
  | { type: "tick" }
  | { type: "reset" };

function makeInitial(scores: [number, number]): State {
  return {
    score: { a: scores[0], b: scores[1] }, timeouts: { a: 1, b: 1 }, log: [], stack: [],
    offline: false, queued: 0, secs: 760, running: true,
  };
}

// In the real app each action becomes a game_events row (queued locally when offline).
function makeReducer(names: [string, string]) {
  const initial = makeInitial([0, 0]);
  return function reducer(s: State, a: Action): State {
    const queued = (n = 1) => (s.offline ? s.queued + n : s.queued);
    switch (a.type) {
      case "goal": {
        const score = { ...s.score, [a.side]: s.score[a.side] + 1 };
        return { ...s, score, stack: [...s.stack, a.side], queued: queued(), log: [`Goal ${names[a.side === "a" ? 0 : 1]}  ${score.a}–${score.b}`, ...s.log] };
      }
      case "timeout":
        return { ...s, timeouts: { ...s.timeouts, [a.side]: s.timeouts[a.side] - 1 }, queued: queued(), log: [`Timeout ${names[a.side === "a" ? 0 : 1]}`, ...s.log] };
      case "undo": {
        const side = s.stack[s.stack.length - 1];
        if (!side) return s;
        return { ...s, score: { ...s.score, [side]: s.score[side] - 1 }, stack: s.stack.slice(0, -1), queued: queued(), log: ["Undid last goal", ...s.log] };
      }
      case "offline": return { ...s, offline: !s.offline, queued: s.offline ? 0 : s.queued };
      case "pause": return { ...s, running: !s.running };
      case "tick": return s.running && s.secs > 0 ? { ...s, secs: s.secs - 1 } : s;
      case "reset": return makeInitial([0, 0]);
    }
  };
}

export interface ScorePanelProps {
  teams: [string, string];
  field: string;
  target?: number;
  label?: string;
  role?: string;
  /** Public (QR-scanned) mode: no dashboard redirect on finish. */
  publicMode?: boolean;
}

export function ScorePanel({ teams, field, target = 15, label, role, publicMode = false }: ScorePanelProps) {
  const router = useRouter();
  const { show, node } = useToast();
  const [s, dispatch] = useReducer(makeReducer(teams), [0, 0] as [number, number], makeInitial);
  const finished = s.score.a >= target || s.score.b >= target;

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleOffline = () => {
    if (s.offline && s.queued) show(`${s.queued} events synced`);
    dispatch({ type: "offline" });
  };

  const finish = () => {
    show(publicMode ? "Game finalized. Thanks for keeping score!" : "Game finalized. Standings updated.");
    dispatch({ type: "reset" });
    if (!publicMode) router.push("/organizer/schedule");
  };

  return (
    <>
      <div className="mx-auto max-w-sm overflow-hidden rounded-[2rem] border-4 border-line bg-bg shadow-xl">
        <div className="flex items-center justify-between bg-field px-4 py-3 text-sm text-white">
          <span className="font-bold">{field} · Game to {target}</span>
          <button onClick={toggleOffline} className={`rounded px-2 py-1 ${s.offline ? "bg-flag" : "bg-white/15"}`}>
            {s.offline ? `Offline · ${s.queued} queued` : "Online"}
          </button>
        </div>
        <div className="bg-field pb-3 text-center text-sm text-white">
          {role && <span className="mr-2 font-bold uppercase tracking-wider">{role}</span>}
          Soft cap in <b className="tabular-nums">{clock(s.secs)}</b>
          <button onClick={() => dispatch({ type: "pause" })} className="ml-2 underline">{s.running ? "Pause" : "Resume"}</button>
        </div>

        <div className="grid grid-cols-2 divide-x divide-line">
          {teams.map((name, i) => {
            const side: Side = i === 0 ? "a" : "b";
            return (
              <div key={side} className="p-4 text-center">
                <p className="font-medium">{name}</p>
                <p className="font-score text-8xl font-bold leading-none tabular-nums" aria-live="polite">{s.score[side]}</p>
                <button className="btn btn-pri mt-3 w-full !py-4 text-lg" disabled={finished} onClick={() => dispatch({ type: "goal", side })}>+1 goal</button>
                <button className="btn mt-2 w-full" disabled={!s.timeouts[side]} onClick={() => dispatch({ type: "timeout", side })}>Timeout ({s.timeouts[side]})</button>
              </div>
            );
          })}
        </div>

        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={!s.stack.length} onClick={() => dispatch({ type: "undo" })}>Undo</button>
            <button className="btn flex-1" disabled={!finished} onClick={finish}>Finish game</button>
          </div>
          {label && <p className="mt-3 text-center text-xs uppercase tracking-wider text-muted">{label}</p>}
          <p className="mb-1 mt-4 text-sm font-bold">Event log</p>
          <ul className="max-h-28 space-y-1 overflow-auto text-sm text-muted">
            {s.log.length ? s.log.map((l, i) => <li key={i}>{l}</li>) : <li>No events yet. Tap +1 goal.</li>}
          </ul>
        </div>
      </div>
      {node}
    </>
  );
}
