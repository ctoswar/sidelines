"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { formatRange, getEvent } from "@/lib/events-data";
import { myRegistrations, unregisterFromEvent, type Registration } from "@/lib/demo-store";
import type { EventItem } from "@/types";

const CHIP = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide";

type Entry = { registration: Registration; event: EventItem | null; chip: { label: string; cls: string } };

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "on this device"
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Fallback title for a registration whose event has left the catalogue. */
const titleFromSlug = (slug: string) =>
  slug.split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const chipFor = (event: EventItem | null) => {
  if (!event) return { label: "Archived", cls: "border-line text-muted" };
  if (event.live) return { label: "Live", cls: "border-flag text-flag" };
  if (event.status === "past") return { label: "Past", cls: "border-line text-muted" };
  return { label: "Upcoming", cls: "border-brand text-brand" };
};

const startsIn = (iso: string) => {
  const days = Math.ceil((Date.parse(`${iso}T00:00:00Z`) - Date.now()) / 864e5);
  if (days > 1) return `Starts in ${days} days`;
  if (days === 1) return "Starts tomorrow";
  if (days === 0) return "Starts today";
  return "Under way";
};

function EventRow({
  entry,
  confirming,
  onConfirm,
  onKeep,
}: {
  entry: Entry;
  confirming: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const { registration: r, event, chip } = entry;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {event ? (
            <Link href={`/events/${r.slug}`} className="hover:underline">{event.name}</Link>
          ) : (
            titleFromSlug(r.slug)
          )}
          <span className={`${CHIP} ${chip.cls}`}>
            {chip.label === "Live" && <span className="pulse h-1.5 w-1.5 rounded-full bg-flag" />}
            {chip.label}
          </span>
        </p>
        <p className="text-sm text-muted">
          {event
            ? `${formatRange(event.start, event.end)} · ${event.city}, ${event.country}`
            : "This event is no longer listed publicly."}
        </p>
        <p className="text-xs text-muted">
          Registered {shortDate(r.at)}
          {event && event.status === "upcoming" ? ` · ${startsIn(event.start)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {confirming ? (
          <>
            <button type="button" className="btn border-flag text-flag" onClick={onConfirm} autoFocus>
              Yes, cancel
            </button>
            <button type="button" className="btn" onClick={onKeep}>No, keep it</button>
          </>
        ) : (
          <>
            <Link className="btn" href={`/events/${r.slug}`}>View event</Link>
            <button type="button" className="btn" onClick={onConfirm}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

export function MyEvents() {
  const { show, node } = useToast();
  const [items, setItems] = useState<Registration[]>([]);
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    setItems(myRegistrations());
    setReady(true);
  }, []);

  const cancel = useCallback((slug: string) => {
    if (confirming !== slug) {
      setConfirming(slug);
      return;
    }
    unregisterFromEvent(slug);
    setConfirming(null);
    setItems(myRegistrations());
    show("Registration cancelled");
  }, [confirming, show]);

  const entries: Entry[] = items.map((registration) => {
    const event = getEvent(registration.slug) ?? null;
    return { registration, event, chip: chipFor(event) };
  });
  const upcoming = entries.filter((e) => e.event && e.event.status !== "past");
  const past = entries.filter((e) => !e.event || e.event.status === "past");

  const section = (title: string, list: Entry[]) => (
    <section className="mb-6" aria-label={title}>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
        {title} <span className="tabular-nums">({list.length})</span>
      </h2>
      <div className="divide-y divide-line rounded-lg border border-line bg-card">
        {list.map((entry) => (
          <EventRow
            key={`${entry.registration.slug}-${entry.registration.email}`}
            entry={entry}
            confirming={confirming === entry.registration.slug}
            onConfirm={() => cancel(entry.registration.slug)}
            onKeep={() => setConfirming(null)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <>
      <PageHeader title="My events" subtitle="Tournaments you have registered for">
        {ready && entries.length > 0 && (
          <p className="text-sm text-muted">
            <b className="text-fg tabular-nums">{entries.length}</b> registered ·{" "}
            <b className="text-fg tabular-nums">{upcoming.length}</b> upcoming
          </p>
        )}
      </PageHeader>

      {!ready ? (
        <div className="rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-bold">Loading your registrations…</p>
          <p className="mt-1 text-muted">One moment while we pull up your events.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-bold">No registrations yet</p>
          <p className="mt-1 text-muted">Browse open tournaments and register to see them here.</p>
          <Link href="/player/tournaments" className="btn btn-pri mt-4 inline-block">Find tournaments</Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && section("Upcoming", upcoming)}
          {past.length > 0 && section("Past", past)}
          <p className="text-xs text-muted">
            Register from any event page — your registrations are saved to this browser in demo mode.
          </p>
        </>
      )}
      {node}
    </>
  );
}
