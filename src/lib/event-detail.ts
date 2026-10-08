import type { EventItem } from "@/types";
import { getEvent } from "./events-data";

export type MatchStatus = "final" | "live" | "scheduled";
export interface TeamInfo { name: string; pool: "A" | "B"; seed: number; roster: number; spirit: number; color: string }
export interface MatchInfo {
  id: string; date: string; time: string; field: string; round: string;
  a: string; b: string; sa: number | null; sb: number | null; status: MatchStatus;
}
export interface PoolRow { team: string; pool: "A" | "B"; w: number; l: number; pf: number; pa: number }
export interface PlayerStat { name: string; team: string; goals: number; assists: number; ds: number }
export interface Mvp { name: string; team: string; score: number; votes: number }
export interface Crew { role: string; people: string[] }
export interface EventDetail {
  event: EventItem; about: string; venue: { name: string; address: string; mapUrl: string };
  tz: { label: string; offset: number }; hasResults: boolean; days: number; fields: number;
  facts: { label: string; value: string }[]; announcements: string[];
  teams: TeamInfo[]; matches: MatchInfo[]; pools: Record<"A" | "B", PoolRow[]>;
  overall: PoolRow[]; bracket: MatchInfo[]; players: PlayerStat[]; mvp: Mvp[]; crew: Crew[];
}

const NAMES = ["Ironwood", "Lowtide", "Harbor", "Redline", "Birch", "Static", "Northgate", "Pinecone", "Sundial", "Kestrel", "Marlin", "Thornfield", "Gridlock", "Offside", "Tidepool", "Wildfire"];
const PEOPLE = ["Alex Rivera", "Dana Cruz", "Miguel Tan", "Priya Nair", "Kai Santos", "Noor Haddad", "Lena Cho", "Jon Park", "Maya Reyes", "Sam Ortiz", "Ivy Lim", "Theo Park", "Rina Sato", "Omar Aziz", "Bea Lopez", "Nico Dela Cruz", "Hana Kim", "Luca Ferri", "Mei Tan", "Joel Reyes", "Ana Silva", "Ravi Shah", "Cleo Ward", "Finn Moore", "Zoe Chan", "Eli Brooks", "Tess Yu", "Gabe Cruz", "Nia Okoro", "Paolo Rey", "Sana Iqbal", "Dev Patel"];
const COLORS = ["#1f6b4a", "#e8590c", "#14213d", "#9b2c2c", "#6b46c1", "#0e7490", "#a16207", "#be185d"];
const SLOTS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];
const TZ: Record<string, { offset: number; city: string }> = {
  PH: { offset: 8, city: "Manila" }, JP: { offset: 9, city: "Tokyo" }, SG: { offset: 8, city: "Singapore" }, HK: { offset: 8, city: "Hong Kong" },
  AU: { offset: 11, city: "Sydney" }, KR: { offset: 9, city: "Seoul" }, TH: { offset: 7, city: "Bangkok" }, TW: { offset: 8, city: "Taipei" },
};
const FEE: Record<string, string> = { PH: "₱6,000 per team", JP: "¥60,000 per team", SG: "S$400 per team", HK: "HK$2,800 per team", AU: "A$550 per team", KR: "₩300,000 per team", TH: "฿6,000 per team", TW: "NT$5,000 per team" };

function hash(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

type Pair = [TeamInfo, TeamInfo];
function roundRobin(ts: TeamInfo[]): Pair[][] {
  const arr: (TeamInfo | null)[] = [...ts];
  if (arr.length % 2) arr.push(null);
  const n = arr.length, out: Pair[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: Pair[] = [];
    for (let i = 0; i < n / 2; i++) { const x = arr[i], y = arr[n - 1 - i]; if (x && y) round.push([x, y]); }
    out.push(round);
    arr.splice(1, 0, arr.pop() as TeamInfo | null);
  }
  return out;
}

function layout(rs: Pair[][], fields: number) {
  const games: { a: TeamInfo; b: TeamInfo; slot: number; field: number; round: number }[] = [];
  let slot = 0, f = 0;
  rs.forEach((round, ri) => {
    round.forEach(([a, b]) => { if (f === fields) { slot++; f = 0; } games.push({ a, b, slot, field: f, round: ri + 1 }); f++; });
    if (f > 0) { slot++; f = 0; }
  });
  return { games, slots: slot };
}

export function getEventDetail(slug: string): EventDetail | null {
  const e = getEvent(slug);
  if (!e) return null;
  const r = rng(hash(e.slug));
  const isTournament = e.tags.includes("Tournament");
  const hasResults = e.status === "past" || !!e.live;
  const tz = TZ[e.code] ?? { offset: 0, city: e.city };

  const teams: TeamInfo[] = NAMES.slice(0, e.teams).map((name, i) => ({
    name, pool: i % 2 ? "B" : "A", seed: i + 1, roster: 11 + Math.floor(r() * 5),
    spirit: Math.round((10.5 + r() * 3.5) * 10) / 10, color: COLORS[i % COLORS.length],
  }));
  const bySeed = new Map(teams.map((t) => [t.name, t]));

  // ---- dates + pool schedule ----
  const span = Math.round((Date.parse(e.end) - Date.parse(e.start)) / 864e5) + 1;
  const poolDays = isTournament ? Math.max(1, span - 1) : 99;
  const rsA = roundRobin(teams.filter((t) => t.pool === "A")), rsB = roundRobin(teams.filter((t) => t.pool === "B"));
  const merged: Pair[][] = Array.from({ length: Math.max(rsA.length, rsB.length) }, (_, i) => [...(rsA[i] ?? []), ...(rsB[i] ?? [])]);
  let fields = 3, plan = layout(merged, fields);
  if (isTournament) while (plan.slots > SLOTS.length * poolDays && fields < 8) plan = layout(merged, ++fields);
  const dateFor = (day: number) => (isTournament ? addDays(e.start, Math.min(day, span - 1)) : addDays(e.start, day * 7));
  const poolSessions = Math.ceil(plan.slots / SLOTS.length);

  // ---- statuses and scores ----
  const aWins = (a: TeamInfo, b: TeamInfo) => r() < Math.min(0.85, Math.max(0.15, 0.5 + (b.seed - a.seed) * 0.035));
  const finalScore = (a: TeamInfo, b: TeamInfo) => { const lose = 5 + Math.floor(r() * 9); return aWins(a, b) ? [15, lose] : [lose, 15]; };
  const total = plan.games.length, doneCount = e.live ? Math.floor(total * 0.55) : e.status === "past" ? total : 0;

  const matches: MatchInfo[] = plan.games.map((g, i) => {
    const base = { id: `p${i + 1}`, date: dateFor(Math.floor(g.slot / SLOTS.length)), time: SLOTS[g.slot % SLOTS.length], field: `Field ${g.field + 1}`, round: `Pool ${g.a.pool} · Round ${g.round}`, a: g.a.name, b: g.b.name };
    if (i < doneCount) { const [sa, sb] = finalScore(g.a, g.b); return { ...base, sa, sb, status: "final" as const }; }
    if (e.live && i < doneCount + 3) return { ...base, sa: 4 + Math.floor(r() * 8), sb: 3 + Math.floor(r() * 8), status: "live" as const };
    return { ...base, sa: null, sb: null, status: "scheduled" as const };
  });

  // ---- pool tables ----
  const rows = new Map<string, PoolRow>(teams.map((t) => [t.name, { team: t.name, pool: t.pool, w: 0, l: 0, pf: 0, pa: 0 }]));
  matches.filter((m) => m.status === "final").forEach((m) => {
    const x = rows.get(m.a)!, y = rows.get(m.b)!;
    x.pf += m.sa!; x.pa += m.sb!; y.pf += m.sb!; y.pa += m.sa!;
    if (m.sa! > m.sb!) { x.w++; y.l++; } else { y.w++; x.l++; }
  });
  const cmp = (p: PoolRow, q: PoolRow) => q.w - p.w || (q.pf - q.pa) - (p.pf - p.pa) || q.pf - p.pf || bySeed.get(p.team)!.seed - bySeed.get(q.team)!.seed;
  const pools = { A: [...rows.values()].filter((x) => x.pool === "A").sort(cmp), B: [...rows.values()].filter((x) => x.pool === "B").sort(cmp) };

  // ---- bracket ----
  const finalDay = isTournament ? span - 1 : poolSessions;
  const bDate = dateFor(finalDay);
  const mk = (id: string, round: string, time: string, field: string, a: string, b: string): MatchInfo => {
    if (e.status !== "past") return { id, date: bDate, time, field, round, a, b, sa: null, sb: null, status: "scheduled" };
    const [sa, sb] = finalScore(bySeed.get(a)!, bySeed.get(b)!);
    return { id, date: bDate, time, field, round, a, b, sa, sb, status: "final" };
  };
  const known = e.status === "past";
  const lab = (p: "A" | "B", i: number) => (known ? pools[p][i].team : `${i + 1}${i ? "nd" : "st"} Pool ${p}`);
  const sf1 = mk("sf1", "Semifinal", SLOTS[1], "Field 1", lab("A", 0), lab("B", 1));
  const sf2 = mk("sf2", "Semifinal", SLOTS[1], "Field 2", lab("B", 0), lab("A", 1));
  const win = (m: MatchInfo) => (m.sa! > m.sb! ? m.a : m.b), lose = (m: MatchInfo) => (m.sa! > m.sb! ? m.b : m.a);
  const bracket = known
    ? [sf1, sf2, mk("third", "Third place", SLOTS[3], "Field 2", lose(sf1), lose(sf2)), mk("final", "Final", SLOTS[4], "Field 1", win(sf1), win(sf2))]
    : [sf1, sf2, mk("third", "Third place", SLOTS[3], "Field 2", "Loser SF1", "Loser SF2"), mk("final", "Final", SLOTS[4], "Field 1", "Winner SF1", "Winner SF2")];

  // ---- overall standings ----
  let overall: PoolRow[];
  if (known) {
    const [t3, t4] = [bracket[2], bracket[3]];
    const podium = [win(t4), lose(t4), win(t3), lose(t3)];
    const rest = [...rows.values()].filter((x) => !podium.includes(x.team)).sort((p, q) => pools[p.pool].indexOf(p) - pools[q.pool].indexOf(q) || cmp(p, q));
    overall = [...podium.map((n) => rows.get(n)!), ...rest];
  } else overall = [...rows.values()].sort(cmp);

  // ---- players, MVP ----
  const scale = e.live ? 0.55 : 1;
  const players: PlayerStat[] = hasResults
    ? teams.flatMap((t, i) => [0, 1].map((k) => ({ name: PEOPLE[(i * 2 + k) % PEOPLE.length], team: t.name, goals: Math.round((4 + r() * 10) * scale), assists: Math.round((3 + r() * 9) * scale), ds: Math.round((1 + r() * 6) * scale) })))
    : [];
  const mvp: Mvp[] = [...players].sort((p, q) => q.goals + q.assists + q.ds - (p.goals + p.assists + p.ds)).slice(0, 6)
    .map((p) => ({ name: p.name, team: p.team, score: p.goals + p.assists + p.ds, votes: 20 + Math.floor(r() * 120) }));

  // ---- text + meta ----
  const division = e.tags.find((t) => ["Open", "Women", "Mixed"].includes(t)) ?? "Open";
  const setting = (e.tags.find((t) => ["Outdoor", "Indoor", "Beach"].includes(t)) ?? "Outdoor").toLowerCase();
  const about = `${e.name} brings ${e.teams} ${division.toLowerCase()} division teams to ${e.city}, ${e.country}, for ${isTournament ? `${span} days of` : "a season of"} ${setting} ultimate. Expect competitive pool play, a knockout finals day with live scores on this page, and a spirit circle after every game. Players, captains and spectators can follow every field from their phone without an account.`;
  const venue = { name: `${e.city} Ultimate Fields`, address: `${e.city}, ${e.country}`, mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.city} ultimate frisbee fields ${e.country}`)}` };

  return {
    event: e, about, venue, tz: { label: `GMT+${tz.offset}`, offset: tz.offset }, hasResults, days: isTournament ? span : poolSessions + 1, fields,
    facts: [
      { label: "Format", value: `${division} division · ${setting}` },
      { label: "Pools", value: `2 pools of ${e.teams / 2}, then knockout` },
      { label: "Game rules", value: "To 15, win by 2 · soft cap 75 min · hard cap 90 min" },
      { label: "Entry fee", value: FEE[e.code] ?? "Contact organizers" },
      { label: "Spirit", value: "Scored 0–20 after every game" },
      { label: "Local time", value: `${tz.city} (GMT+${tz.offset})` },
    ],
    announcements: e.live ? ["Field 3 has moved next to the spirit tent. Check the schedule tab for updated fields.", "Lightning rule is active. Games pause for 30 minutes after the last strike."] : e.status === "past" ? ["Thanks to every team and volunteer. Final standings and MVP results are now posted."] : ["Registration is open. Rosters lock one week before the first pull.", "The full schedule is published 3 days before the event."],
    teams, matches: [...matches, ...bracket], pools, overall, bracket, players, mvp,
    crew: [
      { role: "Tournament director", people: [PEOPLE[0]] }, { role: "Tournament assistants", people: [PEOPLE[1], PEOPLE[2]] },
      { role: "Scorekeepers", people: [PEOPLE[3], PEOPLE[4], PEOPLE[5], PEOPLE[6]] }, { role: "Spirit coordinators", people: [PEOPLE[7], PEOPLE[8]] },
      { role: "Medical", people: [PEOPLE[9]] }, { role: "Media and live stream", people: [PEOPLE[10], PEOPLE[11]] },
    ],
  };
}
