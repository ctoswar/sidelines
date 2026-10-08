"use client";

import { useState } from "react";

type Side = "a" | "b";
const TARGET = 15;

export function LiveScoreboard() {
  const [score, setScore] = useState({ a: 11, b: 9 });
  const [bumped, setBumped] = useState<Side | null>(null);
  const finished = score.a >= TARGET || score.b >= TARGET;

  function addGoal(side: Side) {
    setScore((s) => (s.a >= TARGET || s.b >= TARGET ? { a: 11, b: 9 } : { ...s, [side]: s[side] + 1 }));
    setBumped(null);
    requestAnimationFrame(() => setBumped(side));
  }

  const teams: { side: Side; name: string }[] = [
    { side: "a", name: "Ironwood" },
    { side: "b", name: "Lowtide" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-field text-white shadow-xl" aria-label="Live scoreboard demo">
      <div className="flex items-center justify-between bg-black/25 px-5 py-3 text-sm">
        <span className="flex items-center gap-2 font-bold">
          <span className="pulse h-2.5 w-2.5 rounded-full bg-[#ff5a3c]" />
          Live · Field 3
        </span>
        <span className="text-white/70">Game to {TARGET}</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-white/15">
        {teams.map(({ side, name }) => (
          <div key={side} className="p-6 text-center">
            <p className="font-medium text-white/80">{name}</p>
            <p
              className={`font-score text-[7rem] font-bold leading-none tabular-nums ${bumped === side ? "bump" : ""}`}
              aria-live="polite"
            >
              {score[side]}
            </p>
            <button
              onClick={() => addGoal(side)}
              className="mt-3 w-full rounded-md bg-white py-3 font-bold text-[#14213d]"
              aria-label={`Add goal for ${name}`}
            >
              +1 goal
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-between bg-black/25 px-5 py-3 text-sm text-white/75">
        <span>Soft cap in 12:40</span>
        <span>{finished ? "Final. Tap again to reset" : "Tap a button to try it"}</span>
      </div>
    </div>
  );
}
