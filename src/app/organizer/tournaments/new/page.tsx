"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { DEFAULT_START_TIME, saveScheduleStartTime } from "@/lib/schedule-config";

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

  const next = () => {
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    saveScheduleStartTime(startTime);
    router.push("/organizer");
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
            <Input label="Tournament name" defaultValue="Harbor Autumn Open" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start date" type="date" defaultValue="2026-11-07" />
              <Input label="End date" type="date" defaultValue="2026-11-08" />
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Game to" defaultValue="15" />
            <Input label="Win by" defaultValue="2" />
            <Input label="Soft cap (min)" defaultValue="75" />
            <Input label="Hard cap (min)" defaultValue="90" />
            <Input label="Timeouts per half" defaultValue="1" />
            <Input label="Fields" defaultValue="3" />
            <div>
              <Input
                label="First game starts"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
              <p className="mt-1 text-xs text-muted">Schedule times begin from this time.</p>
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

        <div className="mt-6 flex gap-3">
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="btn btn-pri" onClick={next}>{step === 2 ? "Create tournament" : "Continue"}</button>
        </div>
      </div>
    </>
  );
}
