"use client";

import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useToast } from "@/components/dashboard/use-toast";
import { games } from "@/lib/mock-data";

const slots = [...new Set(games.map((g) => g.time))];

export default function SchedulePage() {
  const { show, node } = useToast();
  return (
    <>
      <PageHeader title="Schedule" subtitle="Saturday · 3 fields · tap a game to score it">
        <button className="btn btn-pri" onClick={() => show("Schedule generated for 3 fields")}>Auto-fill schedule</button>
      </PageHeader>
      {slots.map((t) => (
        <section key={t}>
          <h2 className="mb-2 mt-4 font-bold">{t} AM</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {games.filter((g) => g.time === t).map((g) => (
              <Link key={g.id} href="/organizer/score" className="rounded-lg border border-line bg-card p-4">
                <div className="flex justify-between text-sm text-muted"><span>{g.field}</span><StatusBadge status={g.status} /></div>
                <p className="mt-2 font-bold">{g.teamA} vs {g.teamB}</p>
                <p className="font-score text-3xl tabular-nums">{g.score || "–"}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {node}
    </>
  );
}
