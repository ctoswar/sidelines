"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { teams } from "@/lib/mock-data";

export default function TeamsPage() {
  const { show, node } = useToast();
  return (
    <>
      <PageHeader title="Teams" subtitle="Harbor Spring Open · Open division · 8 of 8 teams">
        <div className="flex gap-2">
          <button className="btn" onClick={() => show("CSV import would open here")}>Import CSV</button>
          <button className="btn btn-pri" onClick={() => show("Add team form would open here")}>Add team</button>
        </div>
      </PageHeader>
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-left">
          <thead className="text-sm text-muted">
            <tr><th className="p-3">Team</th><th className="p-3">Pool</th><th className="p-3">Seed</th><th className="p-3">Roster</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {teams.map((t) => (
              <tr key={t.name}>
                <td className="p-3 font-bold">{t.name}</td>
                <td className="p-3">{t.pool}</td>
                <td className="p-3 tabular-nums">{t.seed}</td>
                <td className="p-3 text-muted">{10 + (t.seed % 4)} players</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {node}
    </>
  );
}
