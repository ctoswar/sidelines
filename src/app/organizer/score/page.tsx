"use client";

import { useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import type { Side } from "@/types";

const TARGET = 15;
const NAMES: Record<Side, string> = { a: "Ironwood", b: "Lowtide" };

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

const initial: State = {
  score: { a: 11, b: 9 }, timeouts: { a: 1, b: 1 }, log: [], stack: [],
  offline: false, queued: 0, secs: 760, running: true,
};

// In the real app each action becomes a game_events row (queued locally when offline).
function reducer(s: State, a: Action): State {
  const queued = (n = 1) => (s.offline ? s.queued + n : s.queued);
  switch (a.type) {
    case "goal": {
      const score = { ...s.score, [a.side]: s.score[a.side] + 1 };
      return { ...s, score, stack: [...s.stack, a.side], queued: queued(), log: [`Goal ${NAMES[a.side]}  ${score.a}–${score.b}`, ...s.log] };
    }
    case "timeout":
      return { ...s, timeouts: { ...s.timeouts, [a.side]: s.timeouts[a.side] - 1 }, queued: queued(), log: [`Timeout ${NAMES[a.side]}`, ...s.log] };
    case "undo": {
      const side = s.stack[s.stack.length - 1];
      if (!side) return s;
      return { ...s, score: { ...s.score, [side]: s.score[side] - 1 }, stack: s.stack.slice(0, -1), queued: queued(), log: ["Undid last goal", ...s.log] };
    }
    case "offline": return { ...s, offline: !s.offline, queued: s.offline ? 0 : s.queued };
    case "pause": return { ...s, running: !s.running };
    case "tick": return s.running && s.secs > 0 ? { ...s, secs: s.secs - 1 } : s;
    case "reset": return initial;
  }
}

const clock = (secs: number) =>
  `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

export default function ScorePage() {
  const router = useRouter();
  const { show, node } = useToast();
  const [s, dispatch] = useReducer(reducer, initial);
  const finished = s.score.a >= TARGET || s.score.b >= TARGET;

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleOffline = () => {
    if (s.offline && s.queued) show(`${s.queued} events synced`);
    dispatch({ type: "offline" });
  };

  const finish = () => {
    show("Game finalized. Standings updated.");
    dispatch({ type: "reset" });
    router.push("/organizer/schedule");
  };

  return (
    <>
      <PageHeader title="Score a game" subtitle="Scorekeeper view, built for a phone on the sideline" />
      <div className="mx-auto max-w-sm overflow-hidden rounded-[2rem] border-4 border-line bg-bg shadow-xl">
        <div className="flex items-center justify-between bg-field px-4 py-3 text-sm text-white">
          <span className="font-bold">Field 3 · Game to {TARGET}</span>
          <button onClick={toggleOffline} className={`rounded px-2 py-1 ${s.offline ? "bg-flag" : "bg-white/15"}`}>
            {s.offline ? `Offline · ${s.queued} queued` : "Online"}
          </button>
        </div>
        <div className="bg-field pb-3 text-center text-sm text-white">
          Soft cap in <b className="tabular-nums">{clock(s.secs)}</b>
          <button onClick={() => dispatch({ type: "pause" })} className="ml-2 underline">{s.running ? "Pause" : "Resume"}</button>
        </div>

        <div className="grid grid-cols-2 divide-x divide-line">
          {(["a", "b"] as Side[]).map((side) => (
            <div key={side} className="p-4 text-center">
              <p className="font-medium">{NAMES[side]}</p>
              <p className="font-score text-8xl font-bold leading-none tabular-nums" aria-live="polite">{s.score[side]}</p>
              <button className="btn btn-pri mt-3 w-full !py-4 text-lg" disabled={finished} onClick={() => dispatch({ type: "goal", side })}>+1 goal</button>
              <button className="btn mt-2 w-full" disabled={!s.timeouts[side]} onClick={() => dispatch({ type: "timeout", side })}>Timeout ({s.timeouts[side]})</button>
            </div>
          ))}
        </div>

        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={!s.stack.length} onClick={() => dispatch({ type: "undo" })}>Undo</button>
            <button className="btn flex-1" disabled={!finished} onClick={finish}>Finish game</button>
          </div>
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
