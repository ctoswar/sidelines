"use client";

import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { openTournaments } from "@/lib/mock-data";

export function TournamentsView() {
  const { show, node } = useToast();
  return (
    <>
      <PageHeader title="Find tournaments" subtitle="Open for registration near you" />
      <div className="divide-y divide-line rounded-lg border border-line bg-card">
        {openTournaments.map((t) => (
          <div key={t.name} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{t.name}</p>
              <p className="text-sm text-muted">{t.meta}</p>
              <p className="text-sm"><span className="font-medium">{t.fee}</span> · <span className="text-flag">{t.spots}</span></p>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={() => show(`Following ${t.name}`)}>Follow</button>
              {t.slug ? <Link className="btn btn-pri" href={`/events/${t.slug}`}>View & register</Link> : <button className="btn btn-pri" onClick={() => show("Ask your captain to register the team")}>Register</button>}
            </div>
          </div>
        ))}
      </div>
      {node}
    </>
  );
}
