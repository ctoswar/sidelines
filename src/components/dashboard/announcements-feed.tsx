"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getEvent } from "@/lib/events-data";
import { fetchAnnouncements, type Announcement } from "@/lib/announcements";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export function AnnouncementsFeed() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    let alive = true;
    fetchAnnouncements({ limit: 3 })
      .then((rows) => { if (alive) setItems(rows); })
      .catch(() => { /* feed is non-critical — keep the fallback */ });
    return () => { alive = false; };
  }, []);

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-card p-5">
        <p className="font-bold">Heads up</p>
        <p className="mt-1 text-muted">
          Your 10:30 match moved from Court 3 to Court 1. Check in with your partner 15 minutes before the serve.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">Announcements</p>
        <span className="text-xs uppercase tracking-wider text-muted">Latest</span>
      </div>
      <ul className="mt-3 space-y-3">
        {items.map((a) => {
          const event = getEvent(a.slug);
          return (
            <li key={a.id} className="border-l-4 border-flag pl-3">
              <p className="font-bold">{a.title}</p>
              <p className="text-sm text-muted">{a.body}</p>
              <p className="mt-1 text-xs text-muted">
                {event ? (
                  <Link href={`/events/${a.slug}`} className="font-medium text-brand hover:underline">
                    {event.name}
                  </Link>
                ) : (
                  "Sidelines"
                )}
                {` · ${when(a.at)}`}
                {a.author ? ` · ${a.author}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
