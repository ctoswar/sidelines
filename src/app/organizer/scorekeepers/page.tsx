"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { keepers } from "@/lib/mock-data";

export default function ScorekeepersPage() {
  const { show, node } = useToast();
  return (
    <>
      <PageHeader title="Scorekeepers" subtitle="Invite people and assign each one to a field" />
      <div className="mb-5 flex max-w-xl gap-2">
        <input className="inp" placeholder="name@email.com" aria-label="Invite email" />
        <button className="btn btn-pri whitespace-nowrap" onClick={() => show("Invite sent")}>Send invite</button>
      </div>
      <div className="max-w-2xl divide-y divide-line rounded-lg border border-line bg-card">
        {keepers.map((k) => (
          <div key={k.name} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="font-bold">{k.name}</p>
              <p className="text-sm text-muted">{k.status}</p>
            </div>
            <select className="inp !w-auto" aria-label={`Field for ${k.name}`} defaultValue={k.field}>
              {["Unassigned", "Field 1", "Field 2", "Field 3"].map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        ))}
      </div>
      {node}
    </>
  );
}
