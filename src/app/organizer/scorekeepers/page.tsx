"use client";

import { useCallback, useState } from "react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { games, keepers } from "@/lib/mock-data";
import { divisionLabel } from "@/lib/divisions";
import type { Keeper } from "@/types";

const rolePill: Record<Keeper["role"], string> = {
  Scorer: "bg-[var(--desk-acid)] text-[var(--desk-ink)]",
  Referee: "bg-[var(--desk-orange)] text-white",
};

export default function ScorekeepersPage() {
  const { show, node } = useToast();
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Keeper["role"]>("Scorer");
  const [list, setList] = useState<Keeper[]>(keepers);
  const [qr, setQr] = useState<{ keeper: Keeper; dataUrl: string; url: string } | null>(null);

  const update = useCallback((name: string, patch: Partial<Keeper>) => {
    setList((prev) => prev.map((k) => (k.name === name ? { ...k, ...patch } : k)));
  }, []);

  const openQr = useCallback(async (k: Keeper) => {
    if (!k.gameId) return;
    const params = new URLSearchParams({ role: k.role.toLowerCase(), name: k.name });
    const url = `${window.location.origin}/score/${k.gameId}?${params}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#17231f", light: "#fffdfa" } });
      setQr({ keeper: k, dataUrl, url });
    } catch {
      show("Could not generate QR code");
    }
  }, [show]);

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    setList((prev) => [...prev, { name, role: newRole, gameId: null }]);
    setNewName("");
    show(`${name} added as ${newRole.toLowerCase()}`);
  };

  const removePerson = (name: string) => {
    setList((prev) => prev.filter((k) => k.name !== name));
  };

  return (
    <>
      <PageHeader
        title="Scorekeepers"
        subtitle="Add people by name and assign a game — each QR opens their scoring screen, no accounts involved"
      />

      <div className="mb-5 flex max-w-2xl flex-wrap gap-2">
        <input
          className="inp flex-1"
          placeholder="Name — e.g. Sam Ortiz"
          aria-label="Name of scorer or referee"
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPerson()}
        />
        <select className="inp !w-auto" aria-label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value as Keeper["role"])}>
          <option>Scorer</option>
          <option>Referee</option>
        </select>
        <button className="btn btn-pri whitespace-nowrap" onClick={addPerson} disabled={!newName.trim()}>Add person</button>
      </div>

      <div className="max-w-3xl divide-y divide-line rounded-lg border border-line bg-card">
        {list.map((k) => {
          const game = games.find((g) => g.id === k.gameId);
          return (
            <div key={k.name} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-40 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold">{k.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider ${rolePill[k.role]}`}>
                    {k.role}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {game ? `${game.field} · ${game.time} · ${game.teamA} vs ${game.teamB}` : "No game assigned yet"}
                </p>
              </div>

              <select
                className="inp !w-auto"
                aria-label={`Role for ${k.name}`}
                value={k.role}
                onChange={(e) => update(k.name, { role: e.target.value as Keeper["role"] })}
              >
                <option>Scorer</option>
                <option>Referee</option>
              </select>

              <select
                className="inp !w-auto"
                aria-label={`Game for ${k.name}`}
                value={k.gameId ?? ""}
                onChange={(e) => update(k.name, { gameId: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.time} · {g.field} · {g.teamA} vs {g.teamB} ({divisionLabel(g.division)} {g.tier})
                  </option>
                ))}
              </select>

              <button
                className="btn whitespace-nowrap"
                disabled={!game}
                title={game ? "Show QR code" : "Assign a game first"}
                onClick={() => openQr(k)}
              >
                QR code
              </button>

              <button
                className="btn !px-3 text-flag"
                title={`Remove ${k.name}`}
                aria-label={`Remove ${k.name}`}
                onClick={() => removePerson(k.name)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setQr(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-score text-2xl font-bold tracking-tight">Scan to score</p>
                <p className="text-sm text-muted">{qr.keeper.name} · {qr.keeper.role}</p>
              </div>
              <button className="btn !px-3 !py-1" onClick={() => setQr(null)} aria-label="Close">✕</button>
            </div>

            {(() => {
              const game = games.find((g) => g.id === qr.keeper.gameId);
              return game ? (
                <p className="mt-2 text-sm text-muted">
                  {game.teamA} vs {game.teamB} · {game.time} · {game.field}
                  <br />
                  {divisionLabel(game.division)} · {game.tier}
                </p>
              ) : null;
            })()}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.dataUrl} alt="QR code to open the scoring page" className="mx-auto mt-4 rounded-lg border border-line" width={280} height={280} />

            <p className="mt-3 break-all rounded-md bg-bg p-2 text-xs text-muted">{qr.url}</p>
            <div className="mt-3 flex gap-2">
              <button
                className="btn flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(qr.url).then(() => show("Link copied")).catch(() => show("Copy failed"));
                }}
              >
                Copy link
              </button>
              <button className="btn btn-pri flex-1" onClick={() => setQr(null)}>Done</button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              Opens {qr.keeper.name}&apos;s scoring screen by name — no sign-up, no password.
            </p>
          </div>
        </div>
      )}
      {node}
    </>
  );
}
