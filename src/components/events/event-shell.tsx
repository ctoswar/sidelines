"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventDetail } from "@/lib/event-detail";
import type { TimeMode } from "@/lib/event-time";
import { formatRange } from "@/lib/events-data";
import { EventLogo } from "./event-card";
import { CalendarIcon } from "./icons";
import { getSession, isRegistered, registerForEvent } from "@/lib/auth";
import * as S from "./event-sections";

const TABS = [
  { key: "info", label: "Info" }, { key: "teams", label: "Teams" }, { key: "schedule", label: "Schedule" },
  { key: "spirit", label: "Spirit" }, { key: "pools", label: "Pools" }, { key: "bracket", label: "Bracket" },
  { key: "stats", label: "Stats" }, { key: "mvp", label: "MVP" }, { key: "standings", label: "Standings" }, { key: "crew", label: "Crew" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function EventShell({ d }: { d: EventDetail }) {
  const e = d.event;
  const [tab, setTab] = useState<TabKey>("info");
  const [mode, setMode] = useState<TimeMode>("event");
  const [zone, setZone] = useState("your time zone");
  const [following, setFollowing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [registered, setRegistered] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const h = window.location.hash.slice(1) as TabKey;
    if (TABS.some((t) => t.key === h)) setTab(h);
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setSignedIn(Boolean(getSession()));
    setRegistered(isRegistered(e.slug));
  }, []);

  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>(".event-detail-page .event-reveal")];
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [tab]);

  const pick = (k: TabKey) => {
    setTab(k);
    window.history.replaceState(null, "", `#${k}`);
    document.getElementById(`tab-${k}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  };
  const scroll = (dx: number) => strip.current?.scrollBy({ left: dx, behavior: "smooth" });
  const share = async () => { await navigator.clipboard?.writeText(window.location.href.split("#")[0]); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const register = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/events/${e.slug}`)}`);
      return;
    }
    registerForEvent(e.slug);
    setRegistered(true);
  };

  return (
    <div className="event-detail-shell">
      <div className="event-time-bar flex justify-end">
        <div className="inline-flex rounded-full border border-line bg-card p-1 text-xs font-bold" role="group" aria-label="Time display">
          {([["event", `Event time (${d.tz.label})`], ["mine", `My time (${zone})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded-full px-3 py-1.5 ${mode === k ? "bg-brand text-onbrand" : "text-muted"}`}>{label}</button>
          ))}
        </div>
      </div>

      <header className="event-detail-hero mt-3 rounded-2xl p-5 text-white sm:p-7" style={{ "--hero-color": e.color } as CSSProperties}>
        <Link href="/" className="event-back-link text-sm text-white/70">← All events</Link>
        <div className="event-detail-hero-main mt-4 flex gap-4">
          <EventLogo e={e} />
          <div className="min-w-0">
            {e.live && <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-flag px-3 py-0.5 text-xs font-bold"><span className="pulse h-1.5 w-1.5 rounded-full bg-white" />Live now</span>}
            <h1 className="font-score text-3xl font-bold leading-tight sm:text-4xl">{e.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85"><CalendarIcon />{formatRange(e.start, e.end)}</p>
            <a href={d.venue.mapUrl} target="_blank" rel="noreferrer" className="mt-0.5 block text-sm text-white/85 underline">{d.venue.name}, {e.city} ↗</a>
          </div>
        </div>
        <p className="mt-4 text-sm text-white/70">{mode === "event" ? `All times are in ${e.city} (${d.tz.label}).` : `All times are converted to ${zone}.`}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setFollowing((f) => !f)} aria-pressed={following} className={`rounded-md px-4 py-2 text-sm font-bold ${following ? "bg-white/15 text-white" : "bg-white text-[#14213d]"}`}>{following ? "Following ✓" : "Follow event"}</button>
          {e.status === "upcoming" && <button onClick={register} aria-pressed={registered} className={`rounded-md border border-white/30 px-4 py-2 text-sm font-bold ${registered ? "bg-white/15 text-white" : "bg-white text-[#17231f]"}`}>{registered ? "Registered ✓" : "Register for event"}</button>}
          <button onClick={share} className="rounded-md border border-white/30 px-4 py-2 text-sm font-medium">{copied ? "Link copied" : "Share"}</button>
        </div>
      </header>

      <div className="event-detail-tabs sticky top-0 z-10 -mx-4 mt-5 border-b border-line bg-bg/95 px-4 backdrop-blur">
        <div className="flex items-center gap-1">
          <button aria-label="Scroll tabs left" onClick={() => scroll(-220)} className="hidden h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-card sm:grid">‹</button>
          <div ref={strip} role="tablist" aria-label="Event sections" className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
            {TABS.map((t) => (
              <button key={t.key} id={`tab-${t.key}`} role="tab" aria-selected={tab === t.key} aria-controls="panel" onClick={() => pick(t.key)}
                className={`whitespace-nowrap border-b-4 px-4 py-3 text-sm font-bold ${tab === t.key ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg"}`}>
                {t.label}
                {t.key === "teams" && <span className="ml-1.5 rounded-full bg-line px-1.5 py-0.5 text-[11px]">{e.teams}</span>}
              </button>
            ))}
          </div>
          <button aria-label="Scroll tabs right" onClick={() => scroll(220)} className="hidden h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-card sm:grid">›</button>
        </div>
      </div>

      <div id="panel" role="tabpanel" className="event-detail-panel mt-7">
        {tab === "info" && <S.InfoTab d={d} mode={mode} />}
        {tab === "teams" && <S.TeamsTab d={d} />}
        {tab === "schedule" && <S.ScheduleTab d={d} mode={mode} />}
        {tab === "spirit" && <S.SpiritTab d={d} />}
        {tab === "pools" && <S.PoolsTab d={d} />}
        {tab === "bracket" && <S.BracketTab d={d} mode={mode} />}
        {tab === "stats" && <S.StatsTab d={d} />}
        {tab === "mvp" && <S.MvpTab d={d} />}
        {tab === "standings" && <S.StandingsTab d={d} />}
        {tab === "crew" && <S.CrewTab d={d} />}
      </div>
    </div>
  );
}
