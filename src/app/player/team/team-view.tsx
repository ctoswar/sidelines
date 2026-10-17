"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { DEFAULT_TEAM, deleteTeamBanner, fetchTeam, saveTeam, uploadTeamBanner, type TeamProfile } from "@/lib/team";
import type { RosterPlayer } from "@/types";
import {
  ACCENTS,
  BANNER_PRESETS,
  bannerFromFile,
  monogramOf,
  presetCss,
  readableOn,
} from "@/lib/team-banner";
import { divisions, divisionLabel, type DivisionId } from "@/lib/divisions";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

/** The team profile — roster arrives from the server page (Phase 7 DB swap). */
export function TeamView({ roster }: { roster: RosterPlayer[] }) {
  const { show, node } = useToast();
  const [team, setTeam] = useState<TeamProfile>(DEFAULT_TEAM);
  const [draft, setDraft] = useState<TeamProfile>(DEFAULT_TEAM);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The team lives in Postgres now, so it arrives after mount. Until then the
  // page shows the neutral placeholder — identical server and client HTML.
  useEffect(() => {
    let alive = true;
    fetchTeam()
      .then((loaded) => {
        if (!alive) return;
        setTeam(loaded);
        setDraft(loaded);
      })
      .catch((error: Error) => alive && show(error.message));
    return () => { alive = false; };
  }, [show]);

  const shown = editing ? draft : team;
  const patch = (next: Partial<TeamProfile>) => setDraft((d) => ({ ...d, ...next }));

  const startEdit = () => { setDraft({ ...team }); setError(""); setEditing(true); };
  const closeEdit = () => { setEditing(false); setError(""); };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      // Crop client-side, then upload — the old version kept the resulting
      // data URL in this browser's localStorage instead.
      const saved = await uploadTeamBanner(await bannerFromFile(file));
      setTeam(saved);
      patch({ banner: saved.banner });
      show("Banner updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use that image.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (name.length < 2) { setError("Team name needs at least 2 characters."); return; }
    if (name.length > 40) { setError("Team name must be 40 characters or fewer."); return; }

    const next: TeamProfile = {
      ...draft,
      name,
      tagline: draft.tagline.trim(),
      seed: Math.min(64, Math.max(1, Math.round(draft.seed) || 1)),
    };

    setBusy(true);
    setError("");
    try {
      let saved = await saveTeam(next);
      // Choosing a preset over an uploaded banner clears it in the same save,
      // so Cancel still reverts the whole choice.
      if (!next.banner && saved.banner) saved = await deleteTeamBanner();
      setTeam(saved);
      setDraft(saved);
      closeEdit();
      show("Team updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the team.");
    } finally {
      setBusy(false);
    }
  };

  // Derived from the team itself rather than a seeded constant, so a fresh
  // team gets its own code instead of a fixture's.
  const joinCode = `${monogramOf(shown.name)}-${String(shown.seed).padStart(4, "0")}`;

  const copyCode = () => {
    navigator.clipboard?.writeText(joinCode);
    show("Code copied");
  };

  return (
    <>
      <PageHeader
        title={shown.name}
        subtitle={`${roster.length} player${roster.length === 1 ? "" : "s"} · ${divisionLabel(shown.division)} division · Seed ${shown.seed}`}
      >
        <button type="button" className="btn btn-pri" onClick={editing ? closeEdit : startEdit}>
          {editing ? "Close editor" : "Edit team"}
        </button>
      </PageHeader>

      {/* Banner — the preset gradient, or the player's own uploaded image. */}
      <div
        className="relative mb-5 overflow-hidden rounded-xl border border-line"
        style={shown.banner ? undefined : { background: presetCss(shown.preset) }}
      >
        {shown.banner && (
          <img src={shown.banner} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
        <div className="relative flex min-h-[10.5rem] flex-col justify-end gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-lg font-score text-2xl font-bold"
              style={{ background: shown.accent, color: readableOn(shown.accent) }}
              aria-hidden="true"
            >
              {monogramOf(shown.name)}
            </span>
            <div className="min-w-0">
              {shown.tagline ? (
                <p className="font-score text-2xl font-bold leading-tight text-white sm:text-3xl">{shown.tagline}</p>
              ) : editing ? (
                <p className="text-sm text-white/70">Add a tagline to fill this space.</p>
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-sm font-bold text-white/75 underline underline-offset-4 hover:text-white"
                >
                  Add a tagline
                </button>
              )}
            </div>
          </div>
          <p className="shrink-0 self-start rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white sm:self-auto">
            Seed {shown.seed}
          </p>
        </div>
      </div>

      {editing && (
        <form onSubmit={submit} noValidate className="mb-5 space-y-5 rounded-xl border border-line bg-card p-5">
          {error && (
            <p role="alert" className="rounded-md border border-flag px-3 py-2 text-sm font-medium text-flag">
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Team name" hint="2–40 characters.">
              <input
                className="inp"
                value={draft.name}
                maxLength={40}
                autoComplete="off"
                placeholder="Night Owls"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field label="Tagline" hint="Shown on the banner. Leave blank to hide it.">
              <input
                className="inp"
                value={draft.tagline}
                maxLength={90}
                autoComplete="off"
                placeholder="Dinking past the kitchen"
                onChange={(e) => patch({ tagline: e.target.value })}
              />
            </Field>
            <Field label="Division">
              <select
                className="inp"
                value={draft.division}
                onChange={(e) => patch({ division: e.target.value as DivisionId })}
              >
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Seed" hint="Shown across the workspace.">
              <input
                className="inp"
                type="number"
                min={1}
                max={64}
                value={draft.seed}
                onChange={(e) => patch({ seed: Number(e.target.value) })}
              />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Banner</p>
            <div className="flex flex-wrap gap-2">
              {BANNER_PRESETS.map((p) => {
                const active = !draft.banner && draft.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.label}
                    aria-label={`${p.label} banner`}
                    aria-pressed={active}
                    onClick={() => patch({ preset: p.id, banner: "" })}
                    className={`h-11 w-16 rounded-md border-2 ${active ? "border-fg" : "border-line"}`}
                    style={{ background: p.css }}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>
                {busy ? "Working…" : "Upload image"}
              </button>
              {draft.banner && (
                <button type="button" className="btn" onClick={() => patch({ banner: "" })}>
                  Use a preset instead
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Upload a banner image"
                disabled={busy}
                onChange={onUpload}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              We crop it to 1600 × 500 before uploading, so it is stored with your account and follows your team to any device.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Accent colour</p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => {
                const active = draft.accent.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Accent colour ${c}`}
                    aria-pressed={active}
                    onClick={() => patch({ accent: c })}
                    className={`h-8 w-8 rounded-full border-2 ${active ? "border-fg" : "border-line"}`}
                    style={{ background: c }}
                  />
                );
              })}
              <input
                type="color"
                value={draft.accent}
                aria-label="Custom accent colour"
                onChange={(e) => patch({ accent: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-line bg-card p-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="submit" className="btn btn-pri" disabled={busy}>Save changes</button>
            <button type="button" className="btn" onClick={closeEdit}>Cancel</button>
          </div>
        </form>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card p-4">
        <div>
          <p className="text-sm text-muted">Team join code</p>
          <p className="font-score text-3xl font-bold tracking-wide">{joinCode}</p>
          <p className="mt-1 text-xs text-muted">Built from your team name and seed.</p>
        </div>
        <button className="btn" onClick={copyCode}>Copy code</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-left">
           <thead className="text-sm text-muted"><tr><th className="p-3">#</th><th className="p-3">Player</th><th className="p-3">Format</th></tr></thead>
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
