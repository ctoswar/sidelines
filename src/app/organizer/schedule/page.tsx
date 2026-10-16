"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useToast } from "@/components/dashboard/use-toast";
import { games } from "@/lib/mock-data";
import { divisions, divisionLabel, type DivisionId } from "@/lib/divisions";
import { fieldGameLabel, getFieldGameNumbers } from "@/lib/game-labels";
import { applyScheduleStartTime, DEFAULT_START_TIME } from "@/lib/schedule-config";
import { applyGameResults, fetchGameResults, subscribeToGameResults, type GameResults } from "@/lib/game-results";
import { fetchGameCrew, subscribeToGameCrew, type GameCrewMap } from "@/lib/game-crew";
import { fetchLiveTournament } from "@/lib/tournaments";
import { useLiveSubscription } from "@/lib/realtime";

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
  const [results, setResults] = useState<GameResults>({});
  const [crew, setCrew] = useState<GameCrewMap>({});
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [selectedGame, setSelectedGame] = useState<(typeof games)[number] | null>(null);

  // The first slot lives on the live tournament row; failures keep the default.
  useEffect(() => {
    let alive = true;
    fetchLiveTournament()
      .then((tournament) => { if (alive) setStartTime(tournament.scheduleStart); })
      .catch(() => { /* the schedule renders from the default 09:00 slot */ });
    return () => { alive = false; };
  }, []);

  // Results + crew come from the server; failures keep the last good overlay.
  useEffect(() => {
    let alive = true;
    const refreshResults = () =>
      fetchGameResults()
        .then((next) => { if (alive) setResults(next); })
        .catch(() => { /* schedule still renders with the seeded scores */ });
    refreshResults();
    return subscribeToGameResults(refreshResults);
  }, []);

  useEffect(() => {
    let alive = true;
    const refreshCrew = () =>
      fetchGameCrew()
        .then((next) => { if (alive) setCrew(next); })
        .catch(() => { /* crew modal shows "Not assigned" */ });
    refreshCrew();
    return subscribeToGameCrew(refreshCrew);
  }, []);

  // Realtime from other devices: a scorer submitting a result, a crew save,
  // or a schedule-start change anywhere pushes the matching refetch here.
  // Polling is the fallback when the stream is unavailable.
  useLiveSubscription(["results", "crew", "schedule"], (topic) => {
    if (topic === "results") void fetchGameResults().then(setResults).catch(() => {});
    if (topic === "crew") void fetchGameCrew().then(setCrew).catch(() => {});
    if (topic === "schedule") {
      void fetchLiveTournament()
        .then((t) => setStartTime(t.scheduleStart))
        .catch(() => {});
    }
  });

  const base = applyScheduleStartTime(games, startTime);
  const schedule = applyGameResults(base, results);

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
        subtitle={`Saturday · 3 courts · ${filtered.length} match${filtered.length === 1 ? "" : "es"}${filterNote} · tap a match to view its crew`}
      >
         <button className="btn btn-pri" onClick={() => show("Schedule generated for 3 courts")}>Auto-fill schedule</button>
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
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGame(g)}
                  className="w-full rounded-lg border border-line bg-card p-4 text-left"
                >
                  <div className="flex justify-between text-sm text-muted">
                    <span>{fieldGameLabel(g, gameNumberById)}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <p className="mt-2 font-bold">{g.teamA} vs {g.teamB}</p>
                  <p className="font-score text-3xl tabular-nums">{g.score || "–"}</p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-muted">{divisionLabel(g.division)} · {g.tier}</p>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
      {selectedGame && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setSelectedGame(null)}>
          <div className="schedule-crew-modal w-full max-w-md rounded-2xl border border-line bg-card p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="dashboard-eyebrow">Game crew</p>
                <h2 className="mt-2 font-score text-3xl font-bold leading-none">{selectedGame.teamA} vs {selectedGame.teamB}</h2>
                <p className="mt-2 text-sm text-muted">{selectedGame.time} · {selectedGame.field} · {fieldGameLabel(selectedGame, gameNumberById)}</p>
              </div>
              <button className="btn !px-3 !py-1" onClick={() => setSelectedGame(null)} aria-label="Close game crew popup">✕</button>
            </div>

            <div className="schedule-crew-list mt-6">
              {(["scorekeeper", "umpire"] as const).map((role) => (
                <div key={role} className="schedule-crew-row">
                  <span className={`scorekeeper-role ${role === "scorekeeper" ? "scorekeeper-role-scorer" : "scorekeeper-role-umpire"}`}>
                    {role === "scorekeeper" ? "Scorekeeper" : "Umpire"}
                  </span>
                  <strong>{crew[selectedGame.id]?.[role] || "Not assigned"}</strong>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              <button className="btn flex-1" onClick={() => setSelectedGame(null)}>Close</button>
              <Link
                className="btn btn-pri flex-1 text-center"
                href={`/organizer/score?game=${selectedGame.id}&scheduleStart=${encodeURIComponent(startTime)}`}
              >
                Open scorecard
              </Link>
            </div>
          </div>
        </div>
      )}
      {node}
    </>
  );
}
