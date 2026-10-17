"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { DEFAULT_START_TIME } from "@/lib/schedule-config";
import { saveScheduleStart } from "@/lib/tournaments";

const steps = ["Basics", "Rules", "Divisions"] as const;

function Input({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold">{label}</label>
      <input className="inp" {...p} />
    </div>
  );
}

export default function NewTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const next = async () => {
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    // The schedule start now lands on the live tournament row instead of
    // this browser, so wait for the save before leaving the page.
    setSaving(true);
    setError("");
    try {
      await saveScheduleStart(startTime);
      router.push("/organizer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the start time.");
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="New tournament" subtitle={`Step ${step + 1} of 3: ${steps[step]}`} />
      <div className="mb-6 flex gap-2">
        {steps.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-brand" : "bg-line"}`} />
        ))}
      </div>

      <div className="max-w-xl">
        {step === 0 && (
          <div className="space-y-3">
            <Input label="Tournament name" placeholder="e.g. Spring Open" autoComplete="off" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start date" type="date" />
              <Input label="End date" type="date" />
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Game to" defaultValue="11" />
            <Input label="Win by" defaultValue="2" />
            <Input label="Timeouts per game" defaultValue="2" />
            <Input label="Courts" defaultValue="3" />
            <div>
              <Input
                label="First game starts"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
               <p className="mt-1 text-xs text-muted">Court times begin from this time.</p>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <p className="mb-3 text-sm text-muted">Choose divisions. Teams are added next.</p>
            {["Open", "Women's", "Mixed"].map((d, i) => (
              <label key={d} className="mb-2 flex items-center gap-3 rounded-md border border-line bg-card p-3">
                <input type="checkbox" defaultChecked={i === 0} /> {d}
              </label>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-flag px-3 py-2 text-sm font-medium text-flag">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="btn btn-pri" onClick={next} disabled={saving}>
            {saving ? "Saving…" : step === 2 ? "Create tournament" : "Continue"}
          </button>
        </div>
      </div>
    </>
  );
}
