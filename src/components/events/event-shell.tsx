"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventDetail } from "@/lib/event-detail";
import type { TimeMode } from "@/lib/event-time";
import { formatRange } from "@/lib/events-data";
import { divisions, divisionLabel, type DivisionId } from "@/lib/divisions";
import { EventLogo } from "./event-card";
import { CalendarIcon } from "./icons";
import { AUTH_CHANGED_EVENT, refreshSession } from "@/lib/auth";
import { fetchRegistrationState, registerForEvent, unregisterFromEvent } from "@/lib/registrations";
import { useLiveSubscription } from "@/lib/realtime";
import * as S from "./event-sections";

const TABS = [
  { key: "info", label: "Info" }, { key: "teams", label: "Teams" }, { key: "schedule", label: "Schedule" },
  { key: "sportsmanship", label: "Sportsmanship" }, { key: "pools", label: "Pools" }, { key: "bracket", label: "Bracket" },
  { key: "stats", label: "Stats" }, { key: "mvp", label: "MVP" }, { key: "standings", label: "Standings" }, { key: "crew", label: "Crew" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/**
 * Whether this event has anything to show in a section.
 *
 * The strip used to offer all ten tabs unconditionally, so an event with no
 * results handed the visitor Sportsmanship, Stats and MVP — three sections
 * with no source anywhere in the schema — each answering "Not available yet".
 * A section now stays out of the strip until its rows exist and reappears on
 * its own the moment they do, which keeps the strip honest without needing an
 * organizer to curate it. Info, Teams, Schedule and Bracket always show: their
 * empty states say something useful about progress ("registrations land
 * here", "bracket not drawn yet").
 */
function tabHasContent(key: TabKey, d: EventDetail): boolean {
  switch (key) {
    case "sportsmanship": return d.teams.some((team) => team.sportsmanship > 0);
    case "pools": return d.teams.length > 0;
    case "stats": return d.players.length > 0;
    case "mvp": return d.mvp.length > 0;
    case "standings": return d.hasResults;
    case "crew": return d.crew.length > 0;
    default: return true;
  }
}

export function EventShell({ d }: { d: EventDetail }) {
  const e = d.event;
  const tabs = TABS.filter((t) => tabHasContent(t.key, d));
  const [tab, setTab] = useState<TabKey>("info");
  const [mode, setMode] = useState<TimeMode>("event");
  const [zone, setZone] = useState("your time zone");
  const [following, setFollowing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [registered, setRegistered] = useState(false);
  /** The division this account entered, when registered; null on legacy rows. */
  const [myDivision, setMyDivision] = useState<DivisionId | null>(null);
  /** The register flow's division picker — open until one is picked or cancelled. */
  const [picking, setPicking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const h = window.location.hash.slice(1) as TabKey;
    // A deep link to a section this event cannot fill yet opens Info instead
    // of a panel that never renders.
    if (TABS.some((t) => t.key === h) && tabHasContent(h, d)) setTab(h);
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [d]);

  // The public header can sign you out without this page being replaced, so
  // re-read the session when it changes - and on focus, which covers signing
  // out in another tab. The badge itself is server state now: after every
  // session change we re-fetch the registration, and a signed-out visitor
  // simply gets registered:false. The realtime `registrations` frame (someone
  // else registering) triggers the same refetch from the stream.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const syncRegistration = useCallback(async () => {
    try {
      const state = await fetchRegistrationState(e.slug);
      if (mounted.current) {
        setRegistered(state.registered);
        setMyDivision(state.division);
      }
    } catch {
      /* signed out or offline - leave the badge off */
    }
  }, [e.slug]);

  useEffect(() => {
    const sync = async () => {
      await refreshSession();
      await syncRegistration();
    };
    void sync();
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, [syncRegistration]);

  useLiveSubscription(["registrations"], syncRegistration);

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
  const applyState = (state: { registered: boolean; division: DivisionId | null }) => {
    setRegistered(state.registered);
    setMyDivision(state.division);
  };
  const register = async () => {
    // Re-read the session rather than trusting state: you can sign out of the
    // public header while standing here, and a click must never flip the badge
    // without actually storing the registration. Cancelling just needs the
    // server's answer; starting opens the division picker, because a
    // registration now always belongs to one of the three divisions.
    const session = await refreshSession();
    if (!session) {
      applyState({ registered: false, division: null });
      setPicking(false);
      router.push(`/login?next=${encodeURIComponent(`/events/${e.slug}`)}`);
      return;
    }
    if (!registered) {
      setPicking(true);
      return;
    }
    try {
      applyState(await unregisterFromEvent(e.slug));
    } catch {
      /* keep the server's answer as-is; a retry on focus re-syncs */
    }
  };
  /** Confirms a division in the picker and stores the registration. */
  const chooseDivision = async (division: DivisionId) => {
    setRegistering(true);
    try {
      applyState(await registerForEvent(e.slug, division));
      setPicking(false);
    } catch {
      /* keep the server's answer as-is; a retry on focus re-syncs */
    } finally {
      setRegistering(false);
    }
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
          {e.status === "upcoming" && (
            <button onClick={register} aria-pressed={registered} title={registered ? "Click to cancel your registration" : "Pick a division to register"} className={`rounded-md border border-white/30 px-4 py-2 text-sm font-bold ${registered ? "bg-white/15 text-white" : "bg-white text-[#17231f]"}`}>
              {registered ? `Registered ✓${myDivision ? ` · ${divisionLabel(myDivision)}` : ""}` : "Register for event"}
            </button>
          )}
          <button onClick={share} className="rounded-md border border-white/30 px-4 py-2 text-sm font-medium">{copied ? "Link copied" : "Share"}</button>
        </div>
      </header>

      <div className="event-detail-tabs sticky top-0 z-10 -mx-4 mt-5 border-b border-line bg-bg/95 px-4 backdrop-blur">
        <div className="flex items-center gap-1">
          <button aria-label="Scroll tabs left" onClick={() => scroll(-220)} className="hidden h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-card sm:grid">‹</button>
          <div ref={strip} role="tablist" aria-label="Event sections" className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
            {tabs.map((t) => (
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
        {tab === "info" && <S.InfoTab d={d} mode={mode} onJump={pick} />}
        {tab === "teams" && <S.TeamsTab d={d} />}
        {tab === "schedule" && <S.ScheduleTab d={d} mode={mode} />}
        {tab === "sportsmanship" && <S.SportsmanshipTab d={d} />}
        {tab === "pools" && <S.PoolsTab d={d} />}
        {tab === "bracket" && <S.BracketTab d={d} mode={mode} />}
        {tab === "stats" && <S.StatsTab d={d} />}
        {tab === "mvp" && <S.MvpTab d={d} />}
        {tab === "standings" && <S.StandingsTab d={d} />}
        {tab === "crew" && <S.CrewTab d={d} />}
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Choose your division" onClick={() => !registering && setPicking(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-score text-2xl font-bold">Choose your division</h2>
            <p className="mt-1 text-sm text-muted">Registering for {e.name}. You can cancel any time from this page or My events.</p>
            <div className="mt-5 grid gap-2">
              {divisions.map((division) => (
                <button
                  key={division.id}
                  onClick={() => void chooseDivision(division.id)}
                  disabled={registering}
                  className={`flex items-center justify-between rounded-md border px-4 py-3 text-left text-sm font-bold transition-colors ${myDivision === division.id ? "border-brand bg-brand/10 text-fg" : "border-line text-fg hover:border-brand/60"} disabled:opacity-60`}
                >
                  {division.label}
                  <span className="text-xs font-medium text-muted">{division.tiers.join(" · ")}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPicking(false)} disabled={registering} className="mt-4 w-full rounded-md border border-line px-4 py-2 text-sm font-bold text-muted hover:text-fg disabled:opacity-60">
              {registering ? "Registering…" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
