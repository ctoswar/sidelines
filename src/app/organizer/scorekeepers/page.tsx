"use client";

import { useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { games, keepers } from "@/lib/mock-data";
import { divisionLabel } from "@/lib/divisions";
import type { Game, Keeper } from "@/types";

/** Each game takes at most two people — any mix of roles. */
const MAX_PER_GAME = 2;

const rolePill: Record<Keeper["role"], string> = {
  Scorer: "bg-[var(--desk-acid)] text-[var(--desk-ink)]",
  Umpire: "bg-[var(--desk-orange)] text-white",
};

const gameOptionLabel = (g: Game) =>
  `${g.time} · ${g.field} · ${g.teamA} vs ${g.teamB} (${divisionLabel(g.division)} ${g.tier})`;

const gameShortLabel = (g: Game) => `${g.time} · ${g.field}`;

type Group = { game: Game | null; people: Keeper[] };
type QrCode = { keeper: Keeper; dataUrl: string; url: string };

export default function ScorekeepersPage() {
  const { show, node } = useToast();
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Keeper["role"]>("Scorer");
  const [newGameId, setNewGameId] = useState("");
  const [list, setList] = useState<Keeper[]>(keepers);
  const [qr, setQr] = useState<{ codes: QrCode[]; index: number } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const labelFor = (gameId: string) => {
    const g = games.find((x) => x.id === gameId);
    return g ? gameShortLabel(g) : gameId;
  };

  /** How many people already sit in a game (optionally ignoring movers). */
  const occupants = (gameId: string, moving: string[] = []) =>
    list.filter((k) => k.gameId === gameId && !moving.includes(k.name)).length;

  const isFull = (gameId: string, exclude?: string) =>
    list.filter((k) => k.gameId === gameId && k.name !== exclude).length >= MAX_PER_GAME;

  const openQr = async (people: Keeper[]) => {
    const assigned = people.filter((p) => p.gameId);
    if (!assigned.length) return;
    try {
      const codes = await Promise.all(
        assigned.map(async (k) => {
          const params = new URLSearchParams({ role: k.role.toLowerCase(), name: k.name });
          const url = `${window.location.origin}/score/${k.gameId}?${params}`;
          const dataUrl = await QRCode.toDataURL(url, {
            width: 320,
            margin: 1,
            color: { dark: "#17231f", light: "#fffdfa" },
          });
          return { keeper: k, dataUrl, url };
        })
      );
      setQr({ codes, index: 0 });
    } catch {
      show("Could not generate QR code");
    }
  };

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    if (list.some((k) => k.name === name)) {
      show(`${name} is already on the list`);
      return;
    }
    if (newGameId && isFull(newGameId)) {
      show(`${labelFor(newGameId)} already has ${MAX_PER_GAME} people`);
      return;
    }
    setList((prev) => [...prev, { name, role: newRole, gameId: newGameId || null }]);
    setNewName("");
    setNewGameId("");
    show(`${name} added as ${newRole.toLowerCase()}`);
  };

  const update = (name: string, patch: Partial<Keeper>) => {
    if (patch.gameId && patch.gameId !== "") {
      const current = list.find((k) => k.name === name);
      if (current?.gameId !== patch.gameId && isFull(patch.gameId, name)) {
        show(`${labelFor(patch.gameId)} already has ${MAX_PER_GAME} people`);
        return; // select is controlled — bails back to the current game
      }
    }
    setList((prev) => prev.map((k) => (k.name === name ? { ...k, ...patch } : k)));
  };

  /** One dropdown for the whole card — the pair moves together. */
  const moveGroup = (gameId: string, people: Keeper[], currentGameId: string) => {
    const target = gameId || null;
    if (target === currentGameId) return;
    const names = people.map((p) => p.name);
    if (target) {
      const taken = occupants(target, names);
      if (taken + people.length > MAX_PER_GAME) {
        show(`${labelFor(target)} already has ${taken} of ${MAX_PER_GAME} filled`);
        return;
      }
    }
    setList((prev) => prev.map((k) => (names.includes(k.name) ? { ...k, gameId: target } : k)));
    show(target ? `Moved ${people.length} to ${labelFor(target)}` : `Moved ${people.length} to unassigned`);
  };

  const removePerson = (name: string) => {
    setList((prev) => prev.filter((k) => k.name !== name));
  };

  /** Empty-slot placeholder: preselect the game in the top form and jump to it. */
  const fillSlot = (gameId: string) => {
    setNewGameId(gameId);
    nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    nameRef.current?.focus({ preventScroll: true });
  };

  // Unassigned first, then games in schedule order (only those with someone assigned).
  const groups = useMemo<Group[]>(() => {
    const unassigned: Group = { game: null, people: list.filter((k) => !k.gameId) };
    const byGame = games
      .map((game) => ({ game, people: list.filter((k) => k.gameId === game.id) }))
      .filter((g) => g.people.length > 0);
    return [unassigned, ...byGame];
  }, [list]);

  const active = qr?.codes[qr.index] ?? null;

  return (
    <>
      <PageHeader
        title="Scorekeepers"
        subtitle="Add people by name and assign a game — each game takes up to two people, each QR opens their scoring screen, no accounts involved"
      />

      <div className="mb-5 flex max-w-3xl flex-wrap gap-2">
        <input
          ref={nameRef}
          className="inp min-w-44 flex-1"
          placeholder="Name — e.g. Sam Ortiz"
          aria-label="Name of scorer or umpire"
          value={newName}
          maxLength={40}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPerson()}
        />
        <select className="inp !w-auto" aria-label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value as Keeper["role"])}>
          <option>Scorer</option>
          <option>Umpire</option>
        </select>
        <select className="inp !w-auto" aria-label="Game" value={newGameId} onChange={(e) => setNewGameId(e.target.value)}>
          <option value="">Unassigned</option>
          {games.map((g) => (
            <option key={g.id} value={g.id} disabled={isFull(g.id)}>
              {gameOptionLabel(g)}
              {isFull(g.id) ? " — full" : ""}
            </option>
          ))}
        </select>
        <button className="btn btn-pri whitespace-nowrap" onClick={addPerson} disabled={!newName.trim()}>Add person</button>
      </div>

      <div className="max-w-3xl space-y-4">
        {groups.map(({ game, people }) => {
          const full = people.length >= MAX_PER_GAME;
          return (
            <section key={game?.id ?? "unassigned"} className="overflow-hidden rounded-lg border border-line bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {game ? `${game.time} · ${game.field} · ${game.teamA} vs ${game.teamB}` : "Unassigned"}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {game ? `${divisionLabel(game.division)} · ${game.tier}` : "Pick a game below to assign these people"}
                  </p>
                </div>
                {game && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider ${
                      full
                        ? "bg-[var(--desk-orange)] text-white"
                        : "border border-line bg-bg text-muted"
                    }`}
                  >
                    {people.length} of {MAX_PER_GAME}
                  </span>
                )}
              </div>

              <div className="divide-y divide-line">
                {people.map((k) => (
                  <div key={k.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-40 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{k.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider ${rolePill[k.role]}`}>
                          {k.role}
                        </span>
                      </div>
                    </div>

                    <select
                      className="inp !w-auto"
                      aria-label={`Role for ${k.name}`}
                      value={k.role}
                      onChange={(e) => update(k.name, { role: e.target.value as Keeper["role"] })}
                    >
                      <option>Scorer</option>
                      <option>Umpire</option>
                    </select>

                    {!game && (
                      <select
                        className="inp !w-auto"
                        aria-label={`Game for ${k.name}`}
                        value={k.gameId ?? ""}
                        onChange={(e) => update(k.name, { gameId: e.target.value || null })}
                      >
                        <option value="">Unassigned</option>
                        {games.map((g) => (
                          <option key={g.id} value={g.id}>
                            {gameOptionLabel(g)}
                          </option>
                        ))}
                      </select>
                    )}

                    {!game && (
                      <button
                        className="btn whitespace-nowrap"
                        disabled={!k.gameId}
                        title={k.gameId ? "Show QR code" : "Assign a game first"}
                        onClick={() => openQr([k])}
                      >
                        QR code
                      </button>
                    )}

                    <button
                      className="btn !px-3 text-flag"
                      title={`Remove ${k.name}`}
                      aria-label={`Remove ${k.name}`}
                      onClick={() => removePerson(k.name)}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {game && !full && (
                  <div className="px-3 py-3">
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-3 py-2.5 text-sm font-semibold text-muted transition hover:border-flag hover:text-flag"
                      onClick={() => fillSlot(game.id)}
                    >
                      + Add person
                    </button>
                  </div>
                )}

                {!game && people.length === 0 && (
                  <p className="px-4 py-4 text-sm text-muted">No one waiting — add a person above.</p>
                )}
              </div>

              {game && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
                  <select
                    className="inp min-w-52 flex-1"
                    aria-label={`Game for this slot`}
                    value={game.id}
                    onChange={(e) => moveGroup(e.target.value, people, game.id)}
                  >
                    <option value="">Unassigned</option>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {gameOptionLabel(g)}
                      </option>
                    ))}
                  </select>
                  <button className="btn whitespace-nowrap" onClick={() => openQr(people)}>
                    QR code
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {qr && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setQr(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-score text-2xl font-bold tracking-tight">Scan to score</p>
                <p className="text-sm text-muted">{active.keeper.name} · {active.keeper.role}</p>
              </div>
              <button className="btn !px-3 !py-1" onClick={() => setQr(null)} aria-label="Close">✕</button>
            </div>

            {qr.codes.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {qr.codes.map((c, i) => (
                  <button
                    key={c.keeper.name}
                    className={`btn !py-1 ${i === qr.index ? "btn-pri" : ""}`}
                    onClick={() => setQr((prev) => (prev ? { ...prev, index: i } : prev))}
                  >
                    {c.keeper.name}
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const game = games.find((g) => g.id === active.keeper.gameId);
              return game ? (
                <p className="mt-2 text-sm text-muted">
                  {game.teamA} vs {game.teamB} · {game.time} · {game.field}
                  <br />
                  {divisionLabel(game.division)} · {game.tier}
                </p>
              ) : null;
            })()}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.dataUrl} alt="QR code to open the scoring page" className="mx-auto mt-4 rounded-lg border border-line" width={280} height={280} />

            <p className="mt-3 break-all rounded-md bg-bg p-2 text-xs text-muted">{active.url}</p>
            <div className="mt-3 flex gap-2">
              <button
                className="btn flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(active.url).then(() => show("Link copied")).catch(() => show("Copy failed"));
                }}
              >
                Copy link
              </button>
              <button className="btn btn-pri flex-1" onClick={() => setQr(null)}>Done</button>
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              Opens {active.keeper.name}&apos;s scoring screen by name — no sign-up, no password.
            </p>
          </div>
        </div>
      )}
      {node}
    </>
  );
}
