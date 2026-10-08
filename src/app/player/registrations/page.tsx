"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatRange, getEvent } from "@/lib/events-data";
import { myRegistrations, unregisterFromEvent, type Registration } from "@/lib/demo-store";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export default function MyEventsPage() {
  const [items, setItems] = useState<Registration[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(myRegistrations());
    setReady(true);
  }, []);

  const cancel = useCallback((slug: string) => {
    unregisterFromEvent(slug);
    setItems(myRegistrations());
  }, []);

  return (
    <>
      <PageHeader title="My events" subtitle="Tournaments you have registered for" />

      {!ready ? null : items.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-8 text-center">
          <p className="font-bold">No registrations yet</p>
          <p className="mt-1 text-muted">Browse open tournaments and register to see them here.</p>
          <Link href="/player/tournaments" className="btn btn-pri mt-4 inline-block">Find tournaments</Link>
        </div>
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-card">
          {items.map((r) => {
            const event = getEvent(r.slug);
            return (
              <div key={`${r.slug}-${r.email}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold">{event?.name ?? r.slug}</p>
                  <p className="text-sm text-muted">
                    {event ? `${formatRange(event.start, event.end)} · ${event.city}, ${event.country}` : r.slug}
                  </p>
                  <p className="text-xs text-muted">Registered {when(r.at)}</p>
                </div>
                <div className="flex gap-2">
                  <Link className="btn" href={`/events/${r.slug}`}>View event</Link>
                  <button className="btn" onClick={() => cancel(r.slug)}>Cancel</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
