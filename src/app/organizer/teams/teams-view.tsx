"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import type { Team } from "@/types";

/** The pool table — teams arrive from the server page (Phase 7 DB swap). */
export function TeamsView({ teams }: { teams: Team[] }) {
  const { show, node } = useToast();
  return (
    <>
      <PageHeader
        title="Teams"
        subtitle={
          teams.length
            ? `${teams.length} team${teams.length === 1 ? "" : "s"} · pool table of the live tournament`
            : "No teams yet — the pool table fills in when the live tournament has teams"
        }
      >
        <div className="flex gap-2">
          <button className="btn" onClick={() => show("CSV import would open here")}>Import CSV</button>
          <button className="btn btn-pri" onClick={() => show("Add team form would open here")}>Add team</button>
        </div>
      </PageHeader>
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-left">
          <thead className="text-sm text-muted">
            <tr><th className="p-3">Team</th><th className="p-3">Pool</th><th className="p-3">Seed</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {teams.map((t) => (
              <tr key={t.name}>
                <td className="p-3 font-bold">{t.name}</td>
                <td className="p-3">{t.pool}</td>
                <td className="p-3 tabular-nums">{t.seed}</td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr>
                <td className="p-3 text-muted" colSpan={3}>No teams to show yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {node}
    </>
  );
}
