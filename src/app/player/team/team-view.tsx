"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { JOIN_CODE, MY_TEAM, roster } from "@/lib/mock-data";

export function TeamView() {
  const { show, node } = useToast();
  return (
    <>
      <PageHeader title={MY_TEAM} subtitle={`${roster.length} players · Pool A · Seed 1`} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card p-4">
        <div>
          <p className="text-sm text-muted">Team join code</p>
          <p className="font-score text-3xl font-bold tracking-wide">{JOIN_CODE}</p>
        </div>
        <button className="btn" onClick={() => { navigator.clipboard?.writeText(JOIN_CODE); show("Code copied"); }}>Copy code</button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-left">
          <thead className="text-sm text-muted"><tr><th className="p-3">#</th><th className="p-3">Player</th><th className="p-3">Position</th></tr></thead>
          <tbody className="divide-y divide-line">
            {roster.map((p) => (
              <tr key={p.name}><td className="p-3 tabular-nums">{p.number}</td><td className="p-3 font-bold">{p.name}</td><td className="p-3 text-muted">{p.position}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {node}
    </>
  );
}
