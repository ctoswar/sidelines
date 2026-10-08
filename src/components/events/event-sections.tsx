"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventDetail, MatchInfo, PoolRow } from "@/lib/event-detail";
import { dayLabel, shown, type TimeMode } from "@/lib/event-time";
import { StatusBadge } from "@/components/dashboard/status-badge";

type P = { d: EventDetail };
type PM = P & { mode: TimeMode };

const Card = ({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) => (
  <section className={`event-reveal rounded-xl border border-line bg-card p-5 ${accent ? "border-l-4 border-l-brand" : ""}`}>{children}</section>
);
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 font-score text-2xl font-bold">{children}</h2>;
const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="event-reveal rounded-xl border border-dashed border-line p-10 text-center">
    <p className="font-bold">{title}</p>
    <p className="mt-1 text-muted">{body}</p>
  </div>
);
const Dot = ({ color, label }: { color: string; label: string }) => (
  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: color }} aria-hidden="true">{label.slice(0, 2).toUpperCase()}</span>
);
const noResults = <Empty title="Not available yet" body="This section fills in once the first games are played." />;

// ---------- shared match card ----------
export function MatchCard({ m, d, mode }: { m: MatchInfo; d: EventDetail; mode: TimeMode }) {
  const done = m.status === "final";
  const aWon = done && m.sa! > m.sb!;
  const row = (name: string, score: number | null, won: boolean) => (
    <div className="flex items-center justify-between gap-3">
      <span className={`truncate ${won ? "font-bold" : done ? "text-muted" : "font-medium"}`}>{name}</span>
      <span className={`font-score text-2xl tabular-nums ${won ? "font-bold" : ""}`}>{score ?? "–"}</span>
    </div>
  );
  return (
    <div className={`event-reveal rounded-xl border bg-card p-4 ${m.status === "live" ? "border-flag" : "border-line"}`}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>{shown(m.date, m.time, d.tz.offset, mode)} · {m.field}</span>
        <StatusBadge status={m.status === "scheduled" ? "next" : m.status} />
      </div>
      {row(m.a, m.sa, aWon)}
      {row(m.b, m.sb, done && !aWon)}
      <p className="mt-2 text-xs text-muted">{m.round}</p>
    </div>
  );
}

// ---------- Info ----------
export function InfoTab({ d, mode }: PM) {
  const live = d.matches.filter((m) => m.status === "live");
  const gamesTotal = d.matches.length;
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => { setDays(Math.ceil((Date.parse(`${d.event.start}T00:00:00Z`) - d.tz.offset * 36e5 - Date.now()) / 864e5)); }, [d]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Teams", d.event.teams], ["Games", gamesTotal], ["Fields", d.fields], ["Days", d.days]].map(([k, v]) => (
          <div key={k} className="event-reveal rounded-xl border border-line bg-card p-4 text-center">
            <p className="font-score text-4xl font-bold leading-none tabular-nums">{v}</p>
            <p className="mt-1 text-sm text-muted">{k}</p>
          </div>
        ))}
      </div>

      {d.event.status === "upcoming" && days !== null && days > 0 && (
        <div className="event-reveal rounded-xl bg-field p-5 text-white">
          <p className="text-sm text-white/70">Starts in</p>
          <p className="font-score text-5xl font-bold leading-none">{days} {days === 1 ? "day" : "days"}</p>
        </div>
      )}

      {live.length > 0 && (
        <div>
          <H>Happening now</H>
          <div className="grid gap-3 sm:grid-cols-2">{live.map((m) => <MatchCard key={m.id} m={m} d={d} mode={mode} />)}</div>
        </div>
      )}

      <Card accent>
        <H>About this event</H>
        <p className="leading-relaxed">{d.about}</p>
      </Card>

      <Card>
        <H>Event details</H>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {d.facts.map((f) => (
            <div key={f.label}><dt className="text-sm text-muted">{f.label}</dt><dd className="font-medium">{f.value}</dd></div>
          ))}
        </dl>
      </Card>

      <Card>
        <H>Venue</H>
        <p className="font-bold">{d.venue.name}</p>
        <p className="text-muted">{d.venue.address}</p>
        <a href={d.venue.mapUrl} target="_blank" rel="noreferrer" className="btn mt-3 inline-block">Open in Maps ↗</a>
      </Card>

      <Card>
        <H>Announcements</H>
        <ul className="space-y-3">
          {d.announcements.map((a) => <li key={a} className="border-l-4 border-flag pl-3">{a}</li>)}
        </ul>
      </Card>
    </div>
  );
}

// ---------- Teams ----------
export function TeamsTab({ d }: P) {
  const [pool, setPool] = useState<"All" | "A" | "B">("All");
  const list = d.teams.filter((t) => pool === "All" || t.pool === pool);
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["All", "A", "B"] as const).map((p) => (
          <button key={p} onClick={() => setPool(p)} aria-pressed={pool === p} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${pool === p ? "border-brand bg-brand text-onbrand" : "border-line"}`}>
            {p === "All" ? "All teams" : `Pool ${p}`}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((t) => (
          <div key={t.name} className="event-reveal flex items-center gap-3 rounded-xl border border-line bg-card p-4">
            <Dot color={t.color} label={t.name} />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{t.name}</p>
              <p className="text-sm text-muted">Pool {t.pool} · Seed {t.seed} · {t.roster} players</p>
            </div>
            {d.hasResults && <span className="text-right text-xs text-muted">Spirit<br /><b className="text-base text-fg tabular-nums">{t.spirit}</b></span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Schedule ----------
export function ScheduleTab({ d, mode }: PM) {
  const [team, setTeam] = useState("All");
  const [field, setField] = useState("All");
  const [status, setStatus] = useState<"all" | "live" | "scheduled" | "final">("all");
  const fields = useMemo(() => [...new Set(d.matches.map((m) => m.field))].sort(), [d]);

  const list = d.matches.filter((m) => (team === "All" || m.a === team || m.b === team) && (field === "All" || m.field === field) && (status === "all" || m.status === status))
    .sort((p, q) => (p.date + p.time).localeCompare(q.date + q.time) || p.field.localeCompare(q.field));
  const dates = [...new Set(list.map((m) => m.date))];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)} className="inp !w-auto"><option>All</option>{d.teams.map((t) => <option key={t.name}>{t.name}</option>)}</select>
        <select aria-label="Field" value={field} onChange={(e) => setField(e.target.value)} className="inp !w-auto"><option>All</option>{fields.map((f) => <option key={f}>{f}</option>)}</select>
        {(["all", "live", "scheduled", "final"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize ${status === s ? "border-brand bg-brand text-onbrand" : "border-line"}`}>{s === "scheduled" ? "Upcoming" : s}</button>
        ))}
      </div>
      {list.length === 0 && <Empty title="No games match" body="Try clearing a filter." />}
      {dates.map((date, i) => (
        <section key={date} className="event-reveal mb-6">
          <h2 className="mb-2 font-score text-2xl font-bold">{dayLabel(date)} <span className="text-base font-medium text-muted">· Day {i + 1}</span></h2>
          <div className="grid gap-3 sm:grid-cols-2">{list.filter((m) => m.date === date).map((m) => <MatchCard key={m.id} m={m} d={d} mode={mode} />)}</div>
        </section>
      ))}
    </div>
  );
}

// ---------- Spirit ----------
export function SpiritTab({ d }: P) {
  if (!d.hasResults) return noResults;
  const ranked = [...d.teams].sort((a, b) => b.spirit - a.spirit);
  return (
    <Card>
      <H>Spirit ranking</H>
      <p className="mb-4 text-sm text-muted">Average score out of 20, from opponents after each game.</p>
      <ol className="space-y-3">
        {ranked.map((t, i) => (
          <li key={t.name} className="grid grid-cols-[1.5rem_7rem_1fr_3rem] items-center gap-3">
            <span className="font-score text-xl text-muted tabular-nums">{i + 1}</span>
            <span className="truncate font-medium">{t.name}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-brand" style={{ width: `${(t.spirit / 20) * 100}%` }} /></span>
            <span className="text-right font-bold tabular-nums">{t.spirit}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ---------- Pools / standings tables ----------
function Table({ rows, qualify = 0 }: { rows: PoolRow[]; qualify?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <thead className="text-muted"><tr><th className="p-3">#</th><th className="p-3">Team</th><th className="p-3 text-right">W</th><th className="p-3 text-right">L</th><th className="p-3 text-right">PF</th><th className="p-3 text-right">PA</th><th className="p-3 text-right">+/-</th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={r.team} className={i < qualify ? "bg-brand/10" : ""}>
              <td className="p-3 tabular-nums">{i + 1}</td><td className="p-3 font-bold">{r.team}</td>
              <td className="p-3 text-right tabular-nums">{r.w}</td><td className="p-3 text-right tabular-nums">{r.l}</td>
              <td className="p-3 text-right tabular-nums">{r.pf}</td><td className="p-3 text-right tabular-nums">{r.pa}</td>
              <td className="p-3 text-right font-bold tabular-nums">{r.pf - r.pa > 0 ? "+" : ""}{r.pf - r.pa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PoolsTab({ d }: P) {
  return (
    <div className="space-y-6">
      {(["A", "B"] as const).map((p) => (
        <section key={p}><H>Pool {p}</H><Table rows={d.pools[p]} qualify={2} /></section>
      ))}
      <p className="text-sm text-muted">Highlighted rows advance to the semifinals. Ties are broken by point difference, then points scored.</p>
    </div>
  );
}

export function StandingsTab({ d }: P) {
  if (!d.hasResults) return noResults;
  return (
    <div>
      <H>{d.event.status === "past" ? "Final standings" : "Standings so far"}</H>
      <Table rows={d.overall} />
    </div>
  );
}

// ---------- Bracket ----------
function BracketCard({ m, d, mode }: { m: MatchInfo; d: EventDetail; mode: TimeMode }) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold text-muted">{m.round}</p>
      <MatchCard m={m} d={d} mode={mode} />
    </div>
  );
}
export function BracketTab({ d, mode }: PM) {
  const [sf1, sf2, third, final] = d.bracket;
  return (
    <div className="grid items-center gap-6 md:grid-cols-[1fr_1fr]">
      <div className="space-y-4"><BracketCard m={sf1} d={d} mode={mode} /><BracketCard m={sf2} d={d} mode={mode} /></div>
      <div className="space-y-4">
        <BracketCard m={final} d={d} mode={mode} />
        <BracketCard m={third} d={d} mode={mode} />
      </div>
      {d.event.status !== "past" && <p className="text-sm text-muted md:col-span-2">Teams fill in as pool play finishes. Top two from each pool advance.</p>}
    </div>
  );
}

// ---------- Stats ----------
export function StatsTab({ d }: P) {
  if (!d.hasResults) return noResults;
  const boards = [["Goals", "goals"], ["Assists", "assists"], ["Defensive blocks", "ds"]] as const;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {boards.map(([title, key]) => {
        const rows = [...d.players].sort((a, b) => b[key] - a[key]).slice(0, 8);
        return (
          <Card key={key}>
            <H>{title}</H>
            <ol className="space-y-2.5">
              {rows.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="w-5 font-score text-lg text-muted tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span><span className="text-xs text-muted">{p.team}</span></span>
                  <span className="font-score text-2xl font-bold tabular-nums">{p[key]}</span>
                </li>
              ))}
            </ol>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- MVP ----------
export function MvpTab({ d }: P) {
  const [votes, setVotes] = useState(d.mvp.map((m) => m.votes));
  const [picked, setPicked] = useState<number | null>(null);
  if (!d.hasResults) return noResults;
  const total = votes.reduce((a, b) => a + b, 0);
  const closed = d.event.status === "past";
  const top = votes.indexOf(Math.max(...votes));

  const vote = (i: number) => { if (picked !== null || closed) return; setPicked(i); setVotes((v) => v.map((x, j) => (j === i ? x + 1 : x))); };

  return (
    <div>
      <p className="mb-4 text-muted">{closed ? "Voting has closed. Congratulations to the winner." : "Voting is open to everyone at the event. One vote each."}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {d.mvp.map((m, i) => (
          <div key={m.name} className={`rounded-xl border bg-card p-4 ${closed && i === top ? "border-flag" : "border-line"}`}>
            <div className="flex items-center justify-between">
              <div><p className="font-bold">{m.name}</p><p className="text-sm text-muted">{m.team} · {m.score} contributions</p></div>
              {closed && i === top && <span className="rounded-full bg-flag px-3 py-0.5 text-xs font-bold text-white">MVP</span>}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${(votes[i] / total) * 100}%` }} /></div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted tabular-nums">{Math.round((votes[i] / total) * 100)}% · {votes[i]} votes</span>
              {!closed && <button onClick={() => vote(i)} disabled={picked !== null} className="btn btn-pri !py-1.5 text-sm">{picked === i ? "Voted" : "Vote"}</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Crew ----------
export function CrewTab({ d }: P) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {d.crew.map((c) => (
        <Card key={c.role}>
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-brand">{c.role}</p>
          <ul className="space-y-1">{c.people.map((p) => <li key={p} className="font-medium">{p}</li>)}</ul>
        </Card>
      ))}
    </div>
  );
}
