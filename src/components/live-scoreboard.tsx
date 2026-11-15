"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/motion/primitives";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { SCORING } from "@/lib/scoring";

type Side = "a" | "b";
const TARGET = SCORING.target;
// The demo clock starts at 12:40 and ticks down once per second after mount.
const START_CLOCK = 12 * 60 + 40;

const isFinal = (s: { a: number; b: number }) =>
  (s.a >= TARGET && s.a - s.b >= SCORING.winBy) || (s.b >= TARGET && s.b - s.a >= SCORING.winBy);

export function LiveScoreboard() {
  const [score, setScore] = useState({ a: 8, b: 6 });
  const [clock, setClock] = useState(START_CLOCK);
  const reduced = !!usePrefersReducedMotion();
  const finished = isFinal(score);

  // The server and the first client render both show the static start time;
  // the interval only exists after hydration, so there is no mismatch.
  useEffect(() => {
    const id = setInterval(() => setClock((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  function addPoint(side: Side) {
    setScore((s) => (isFinal(s) ? { a: 8, b: 6 } : { ...s, [side]: s[side] + 1 }));
  }

  const teams: { side: Side; name: string }[] = [
    { side: "a", name: "Ironwood" },
    { side: "b", name: "Lowtide" },
  ];

  const clockLabel = `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`;

  return (
    <div
      className="live-scoreboard overflow-hidden rounded-2xl border border-line bg-field text-white shadow-xl"
      aria-label="Live scoreboard"
    >
      <div className="flex items-center justify-between bg-black/25 px-5 py-3 text-sm">
        <span className="flex items-center gap-2 font-bold">
          <motion.span
            // Remount on the reduced-motion flip so a mid-pulse dot snaps
            // back to rest instead of freezing at an intermediate keyframe.
            key={reduced ? "dot-reduced" : "dot"}
            className="h-2.5 w-2.5 rounded-full bg-[#ff5a3c]"
            animate={reduced ? undefined : { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
            transition={reduced ? undefined : { duration: 1.6, ease: "easeInOut", repeat: Infinity }}
          />
          Live · Court 3
        </span>
        <span className="text-white/70">{SCORING.mode === "rally" ? "Rally scoring" : "Side-out scoring"} · First to {TARGET} · win by {SCORING.winBy}</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-white/15">
        {teams.map(({ side, name }) => (
          <div key={side} className="p-6 text-center">
            <p className="font-medium text-white/80">{name}</p>
            {/* The visible number is decorative; the sr-only span is what screen readers announce. */}
            <p className="font-score text-[7rem] font-bold leading-none tabular-nums" aria-live="polite">
              <span className="sr-only">{`${name} ${score[side]}`}</span>
              <span aria-hidden="true">
                <AnimatedNumber value={score[side]} />
              </span>
            </p>
            <motion.button
              type="button"
              onClick={() => addPoint(side)}
              className="mt-3 w-full rounded-md bg-white py-3 font-bold text-[#14213d]"
              whileTap={reduced ? undefined : { scale: 0.94 }}
              aria-label={`Add point for ${name}`}
            >
              +1 point
            </motion.button>
          </div>
        ))}
      </div>

      <div className="flex justify-between bg-black/25 px-5 py-3 text-sm text-white/75">
        <span className="tabular-nums">Match clock {clockLabel}</span>
        <span>{finished ? "Final. Tap again to reset" : "Tap a button to try it"}</span>
      </div>
    </div>
  );
}
