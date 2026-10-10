"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useToast } from "@/components/dashboard/use-toast";
import { games } from "@/lib/mock-data";
import { divisions, divisionLabel, type DivisionId } from "@/lib/divisions";
import { fieldGameLabel, getFieldGameNumbers } from "@/lib/game-labels";
import { applyScheduleStartTime, readScheduleStartTime } from "@/lib/schedule-config";

const pill = (active: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${
    active
      ? "border-transparent bg-[var(--desk-ink)] text-white"
      : "border-line bg-card text-fg hover:border-[var(--desk-ink)]"
  }`;

export default function SchedulePage() {
  const { show, node } = useToast();
  const [division, setDivision] = useState<DivisionId | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [schedule, setSchedule] = useState(games);

  useEffect(() => {
    setSchedule(applyScheduleStartTime(games, readScheduleStartTime()));
  }, []);

  const tiers = divisions.find((d) => d.id === division)?.tiers ?? [];
  const filtered = schedule.filter(
    (g) => (!division || g.division === division) && (!tier || g.tier === tier)
  );
  const slots = [...new Set(filtered.map((g) => g.time))];
  const gameNumberById = getFieldGameNumbers(schedule);

  const filterNote = division
    ? ` · ${divisionLabel(division)}${tier ? ` ${tier}` : ""}`
    : "";

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`Saturday · 3 fields · ${filtered.length} game${filtered.length === 1 ? "" : "s"}${filterNote} · tap a game to score it`}
      >
        <button className="btn btn-pri" onClick={() => show("Schedule generated for 3 fields")}>Auto-fill schedule</button>
      </PageHeader>

      <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="Division">
        <button className={pill(!division)} aria-pressed={!division} onClick={() => { setDivision(null); setTier(null); }}>
          All divisions
        </button>
        {divisions.map((d) => (
          <button
            key={d.id}
            className={pill(division === d.id)}
            aria-pressed={division === d.id}
            onClick={() => { setDivision(division === d.id ? null : d.id); setTier(null); }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {division && (
        <div className="tier-row mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Skill tier">
          <span className="text-xs uppercase tracking-wider text-muted">{divisionLabel(division)} levels</span>
          <button className={pill(!tier)} aria-pressed={!tier} onClick={() => setTier(null)}>
            All levels
          </button>
          {tiers.map((t) => (
            <button
              key={t}
              className={pill(tier === t)}
              aria-pressed={tier === t}
              onClick={() => setTier(tier === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-line bg-card p-8 text-center text-muted">
          No games in this division yet. Use Auto-fill to add some.
        </div>
      ) : (
        slots.map((t) => (
          <section key={t}>
            <h2 className="mb-2 mt-4 font-bold">{t}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {filtered.filter((g) => g.time === t).map((g) => (
                <Link key={g.id} href={`/organizer/score?game=${g.id}&scheduleStart=${encodeURIComponent(readScheduleStartTime())}`} className="rounded-lg border border-line bg-card p-4">
                  <div className="flex justify-between text-sm text-muted">
                    <span>{fieldGameLabel(g, gameNumberById)}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <p className="mt-2 font-bold">{g.teamA} vs {g.teamB}</p>
                  <p className="font-score text-3xl tabular-nums">{g.score || "–"}</p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-muted">{divisionLabel(g.division)} · {g.tier}</p>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
      {node}
    </>
  );
}
