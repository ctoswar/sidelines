"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { EventItem } from "@/types";
import { dayOf, filterGroups, monthLabel, monthShort } from "@/lib/events-data";
import { EventCard } from "./event-card";
import { CalendarIcon, FilterIcon, SearchIcon } from "./icons";

type Tab = "upcoming" | "past";

export function EventsBrowser({ events }: { events: EventItem[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [calendar, setCalendar] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    setVisibleCount(5);
  }, [tab, q, picked, calendar]);

  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  const clear = () => { setQ(""); setPicked([]); };
  const searching = q.trim() !== "" || picked.length > 0;

  const matches = (e: EventItem) => {
    const text = `${e.name} ${e.country} ${e.city}`.toLowerCase();
    if (q.trim() && !text.includes(q.trim().toLowerCase())) return false;
    return filterGroups.every((g) => {
      const chosen = g.options.filter((o) => picked.includes(o));
      return chosen.length === 0 || e.tags.some((t) => chosen.includes(t));
    });
  };

  const inTab = useMemo(() => {
    const list = events.filter((e) => e.status === tab && matches(e));
    return list.sort((a, b) => (tab === "upcoming" ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tab, q, picked]);

  const showFeatured = tab === "upcoming" && !searching && !calendar;
  const featured = showFeatured ? inTab.filter((e) => e.featured) : [];
  const rest = showFeatured ? inTab.filter((e) => !e.featured) : inTab;

  useEffect(() => {
    if (calendar || visibleCount >= rest.length || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount((count) => Math.min(count + 5, rest.length));
    }, { rootMargin: "240px" });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [calendar, rest.length, visibleCount]);

  const months = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    inTab.forEach((e) => map.set(monthLabel(e.start), [...(map.get(monthLabel(e.start)) ?? []), e]));
    return [...map.entries()];
  }, [inTab]);

  return (
    <div>
      <div className="events-toolbar">
        <label className="events-search">
          <SearchIcon />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search event, city or country" aria-label="Search events" />
          <span className="events-search-shortcut">⌘ K</span>
        </label>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Filters" className="events-filter-button">
          <FilterIcon />
          <span>Filter</span>
          {picked.length > 0 && <b>{picked.length}</b>}
        </button>
      </div>

      {open && (
        <div className="events-filter-panel">
          {filterGroups.map((g) => (
            <div key={g.label}>
              <p>{g.label}</p>
              <div className="events-filter-options">
                {g.options.map((o) => (
                  <button key={o} onClick={() => toggle(o)} aria-pressed={picked.includes(o)} className={picked.includes(o) ? "is-selected" : ""}>{o}</button>
                ))}
              </div>
            </div>
          ))}
          {searching && <button onClick={clear} className="events-clear">Clear all</button>}
        </div>
      )}

      {featured.length > 0 && (
        <section className="events-spotlight" aria-label="Featured events">
          <div className="events-section-label"><span>Spotlight</span><span>Selected events / 2026—27</span></div>
          <div className="events-spotlight-grid">
            <EventCard event={featured[0]} variant="spotlight" index={1} />
            <div className="events-spotlight-stack">
              {featured.slice(1).map((e, i) => <EventCard key={e.slug} event={e} variant="compact" index={i + 2} />)}
            </div>
          </div>
        </section>
      )}

      <div className="events-list-heading">
        <div role="tablist" className="events-tabs">
          {(["upcoming", "past"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? "is-active" : ""}>
              {t === "upcoming" ? "Upcoming Events" : "Past Events"}
            </button>
          ))}
        </div>
        <button onClick={() => setCalendar((c) => !c)} className="events-calendar-toggle">
          <CalendarIcon />{calendar ? "List View" : "Calendar View"}
        </button>
      </div>

      <div className="events-results">
        {inTab.length === 0 && (
          <div className="events-empty">
            <p>No events match your search</p>
            <button onClick={clear}>Clear search and filters</button>
          </div>
        )}

        {!calendar && rest.length > 0 && <div className="events-queue-head"><span>{tab === "upcoming" ? "The season queue" : "The archive"}</span><span>{rest.length} events</span></div>}
        {!calendar && rest.slice(0, visibleCount).map((e, i) => <EventCard key={e.slug} event={e} index={i + 1} />)}
        {!calendar && visibleCount < rest.length && <div ref={loadMoreRef} className="event-load-sentinel" aria-live="polite">Loading more events<span>•••</span></div>}

        {calendar && months.map(([label, list]) => (
          <section key={label} className="events-month">
            <h2>{label}</h2>
            <div className="events-month-list">
              {list.map((e) => (
                <Link key={e.slug} href={`/events/${e.slug}`} className="events-month-item">
                  <div className="events-month-date">
                    <p>{dayOf(e.start)}</p>
                    <span>{monthShort(e.start)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate">{e.name}</p>
                    <span>{e.city}, {e.country} · {e.tags.join(" · ")}</span>
                  </div>
                  <span className="event-row-arrow">↗</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
