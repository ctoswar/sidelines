"use client";

import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatRange } from "@/lib/events-data";
import type { EventItem } from "@/types";

/** Catalogue rows — loaded by the server page, counts included (Phase 7). */
type CatalogueItem = EventItem & { registrationCount: number };

/** The event hub list — events arrive from the server page (Phase 7 DB swap). */
export function EventsView({ events }: { events: CatalogueItem[] }) {
  const sorted = [...events].sort((a, b) => (a.status === b.status ? a.start.localeCompare(b.start) : a.status === "upcoming" ? -1 : 1));

  return (
    <>
      <PageHeader title="Event hub" subtitle="Overview, registrations and announcements per event" />
      <div className="divide-y divide-line rounded-lg border border-line bg-card">
        {sorted.map((e) => (
          <div key={e.slug} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{e.name}</p>
              <p className="text-sm text-muted">{formatRange(e.start, e.end)} · {e.city}, {e.country}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${e.live ? "text-flag" : "text-muted"}`}>
                {e.status === "upcoming" ? `${e.registrationCount} registered` : e.live ? "Live now" : "Past"}
              </span>
              <Link className="btn btn-pri" href={`/organizer/events/${e.slug}`}>Open hub</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
