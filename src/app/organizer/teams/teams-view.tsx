"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import {
  addTeams,
  buildPoolFromSignups,
  parseTeamCsv,
  removeTeam,
  type PoolTeam,
} from "@/lib/teams";

type ViewData = {
  teams: PoolTeam[];
  tournament: { id: string; name: string } | null;
  eventSlug: string | null;
  signupCount: number;
};

const SOURCE_LABEL: Record<PoolTeam["source"], string> = {
  manual: "Added",
  csv: "CSV",
  signups: "Signup",
};

/** The pool table — real writes now: add, CSV import, build from signups. */
export function TeamsView({ view }: { view: ViewData }) {
  const router = useRouter();
  const { show, node } = useToast();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pool, setPool] = useState<"A" | "B">("A");
  const fileRef = useRef<HTMLInputElement>(null);

  const { teams, tournament, eventSlug, signupCount } = view;

  // Any write re-renders the server page, so the table always shows what the
  // database holds rather than optimistic state.
  const act = async (work: () => Promise<string | void>) => {
    setBusy(true);
    try {
      const message = await work();
      if (message) show(message);
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    void act(async () => {
      const result = await addTeams([{ name: trimmed, pool }]);
      setName("");
      setAdding(false);
      return result.skipped.length
        ? `${trimmed} is already in the pool`
        : `Added ${trimmed} to pool ${pool}`;
    });
  };

  const importCsv = (file: File) => {
    void act(async () => {
      const entries = parseTeamCsv(await file.text());
      if (!entries.length) return "No rows found — expected lines like “Dana Cruz,B”";
      const result = await addTeams(entries, "csv");
      const skipped = result.skipped.length;
      return `Imported ${result.added.length} player${result.added.length === 1 ? "" : "s"}${
        skipped ? `, skipped ${skipped} already in the pool` : ""
      }`;
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const buildFromSignups = () => {
    void act(async () => {
      const result = await buildPoolFromSignups();
      if (result.message) return result.message;
      if (!result.added.length && !result.skipped.length) {
        return `No signups to pull — ${signupCount} registration${signupCount === 1 ? "" : "s"} already in the pool`;
      }
      return `Added ${result.added.length} of ${result.candidates} signup${result.candidates === 1 ? "" : "s"} to the pool`;
    });
  };

  const remove = (entrant: PoolTeam) => {
    void act(async () => {
      await removeTeam(entrant.name);
      return `Removed ${entrant.name}`;
    });
  };

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle={
          teams.length
            ? `${teams.length} in the pool · ${tournament?.name ?? "live tournament"}`
            : tournament
              ? `No players in the pool yet — add them, import a CSV, or pull from the ${signupCount} signup${signupCount === 1 ? "" : "s"}`
              : "No live tournament yet — create one to open the pool"
        }
      >
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importCsv(file);
            }}
          />
          <button className="btn" disabled={busy || !tournament} onClick={() => fileRef.current?.click()}>
            Import CSV
          </button>
          {signupCount > 0 && (
            <button className="btn" disabled={busy || !tournament} onClick={buildFromSignups}>
              Pull from signups ({signupCount})
            </button>
          )}
          <button
            className="btn btn-pri"
            disabled={!tournament}
            onClick={() => setAdding((open) => !open)}
          >
            Add player
          </button>
        </div>
      </PageHeader>

      {adding && (
        <form onSubmit={submitAdd} className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-card p-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-sm font-bold" htmlFor="entrant-name">
              Player or team name
            </label>
            <input
              id="entrant-name"
              className="inp"
              placeholder="e.g. Dana Cruz"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold" htmlFor="entrant-pool">
              Pool
            </label>
            <select
              id="entrant-pool"
              className="inp w-auto"
              value={pool}
              onChange={(event) => setPool(event.target.value === "B" ? "B" : "A")}
            >
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </div>
          <button className="btn btn-pri" type="submit" disabled={busy || !name.trim()}>
            Add
          </button>
          <button className="btn" type="button" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-left">
          <thead className="text-sm text-muted">
            <tr>
              <th className="p-3">Team</th>
              <th className="p-3">Pool</th>
              <th className="p-3">Seed</th>
              <th className="p-3">Source</th>
              <th className="p-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {teams.map((team) => (
              <tr key={team.name}>
                <td className="p-3 font-bold">{team.name}</td>
                <td className="p-3">{team.pool}</td>
                <td className="p-3 tabular-nums">{team.seed}</td>
                <td className="p-3 text-sm text-muted">{SOURCE_LABEL[team.source] ?? team.source}</td>
                <td className="p-3 text-right">
                  <button
                    className="text-sm font-bold text-flag hover:underline"
                    disabled={busy}
                    onClick={() => remove(team)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr>
                <td className="p-3 text-muted" colSpan={5}>
                  {tournament
                    ? "The pool is empty. Add a player, import a CSV, or pull from signups."
                    : "Create a live tournament to open the pool."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {eventSlug && (
        <p className="mt-3 text-xs text-muted">
          The pool feeds the schedule and the public event page for{" "}
          <span className="font-bold">{eventSlug}</span>. Players who register solo appear here by name.
        </p>
      )}
      {node}
    </>
  );
}
