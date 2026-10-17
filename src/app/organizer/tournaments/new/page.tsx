"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { DEFAULT_START_TIME } from "@/lib/schedule-config";
import { createTournament } from "@/lib/tournaments";

const steps = ["Basics", "Rules", "Divisions"] as const;
const divisionChoices = ["Open", "Women's", "Mixed"];

function Input({
  label,
  hint,
  ...p
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold">{label}</label>
      <input className="inp" {...p} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function NewTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Basics: the name and date range that land on the tournaments row.
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Rules: courts and the first slot are stored; the scoring defaults beside
  // them are the usual pickleball settings and are not persisted yet.
  const [courts, setCourts] = useState("3");
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [divisions, setDivisions] = useState<string[]>([divisionChoices[0]]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleDivision = (division: string) =>
    setDivisions((current) =>
      current.includes(division)
        ? current.filter((d) => d !== division)
        : [...current, division],
    );

  /** The Basics step gates on what the row cannot be created without. */
  const advance = () => {
    if (step === 0) {
      if (name.trim().length < 3) {
        setError("Give the tournament a name (3 characters or more).");
        return;
      }
      if (!startDate) {
        setError("Add a start date.");
        return;
      }
      if (endDate && endDate < startDate) {
        setError("The end date cannot be before the start date.");
        return;
      }
    }
    if (step === 1 && (!Number.isFinite(Number(courts)) || Number(courts) < 1)) {
      setError("Enter how many courts the tournament uses.");
      return;
    }
    setError("");
    setStep(step + 1);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await createTournament({
        name: name.trim(),
        startDate,
        endDate,
        courts: Number(courts),
        divisions,
        scheduleStart: startTime,
        // This wizard is the setup flow for the tournament about to run, so
        // the new row becomes the live tournament the workspace configures.
        status: "live",
      });
      router.push("/organizer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the tournament.");
      setSaving(false);
    }
  };

  const next = () => {
    if (step < 2) advance();
    else void submit();
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
            <Input
              label="Tournament name"
              placeholder="e.g. Spring Open"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              <Input
                label="End date"
                value={endDate}
                type="date"
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Game to" defaultValue="11" />
            <Input label="Win by" defaultValue="2" />
            <Input label="Timeouts per game" defaultValue="2" />
            <Input
              label="Courts"
              inputMode="numeric"
              value={courts}
              onChange={(event) => setCourts(event.target.value)}
            />
            <div>
              <Input
                label="First game starts"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
              <p className="mt-1 text-xs text-muted">Court times begin from this time.</p>
            </div>
            <p className="col-span-2 text-xs text-muted">
              Courts and the first game time are saved with the tournament.
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-3 text-sm text-muted">
              Pick the divisions. They land in the tournament summary; teams come next.
            </p>
            {divisionChoices.map((division) => (
              <label
                key={division}
                className="mb-2 flex items-center gap-3 rounded-md border border-line bg-card p-3"
              >
                <input
                  type="checkbox"
                  checked={divisions.includes(division)}
                  onChange={() => toggleDivision(division)}
                />{" "}
                {division}
              </label>
            ))}
            <p className="mt-3 text-xs text-muted">
              Creating this makes it the live tournament the workspace configures — any other live
              tournament returns to draft.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-flag px-3 py-2 text-sm font-medium text-flag">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <button className="btn" onClick={() => { setError(""); setStep(step - 1); }}>
              Back
            </button>
          )}
          <button className="btn btn-pri" onClick={next} disabled={saving}>
            {saving ? "Saving…" : step === 2 ? "Create tournament" : "Continue"}
          </button>
        </div>
      </div>
    </>
  );
}
