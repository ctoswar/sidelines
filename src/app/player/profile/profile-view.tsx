"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { levels, matches, positions } from "@/lib/validators/auth";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="mb-1 block text-sm font-bold">{label}</label>{children}</div>);
}

export function ProfileView() {
  const { show, node } = useToast();
  return (
    <>
      <PageHeader title="Profile" subtitle="Details from your registration" />
      <div className="grid max-w-xl gap-4">
        <Row label="Full name"><input className="inp" defaultValue="Alex Rivera" /></Row>
        <Row label="City"><input className="inp" defaultValue="Imus, Cavite" /></Row>
        <Row label="Position"><select className="inp" defaultValue="Handler">{positions.map((p) => <option key={p}>{p}</option>)}</select></Row>
        <Row label="Experience"><select className="inp" defaultValue="Club level">{levels.map((l) => <option key={l}>{l}</option>)}</select></Row>
        <Row label="Gender match"><select className="inp" defaultValue="Open">{matches.map((m) => <option key={m}>{m}</option>)}</select></Row>
        <Row label="Jersey number"><input className="inp" defaultValue="17" /></Row>
        <div><button className="btn btn-pri" onClick={() => show("Profile saved (mockup)")}>Save changes</button></div>
      </div>
      {node}
    </>
  );
}
