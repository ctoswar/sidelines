"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PageHeader } from "@/components/dashboard/page-header";
import { useToast } from "@/components/dashboard/use-toast";
import { games, keepers } from "@/lib/mock-data";
import { divisionLabel } from "@/lib/divisions";
import { fieldGameLabel, getFieldGameNumbers } from "@/lib/game-labels";
import { applyScheduleStartTime, readScheduleStartTime } from "@/lib/schedule-config";
import { GameSelect } from "@/components/dashboard/game-select";
import type { Game } from "@/types";
import { getDefaultGameCrew, getGameCrew, saveGameCrew, type GameCrew } from "@/lib/game-crew";

type QrCode = {
  gameId: string;
  gameLabel: string;
  name: string;
  role: "Scorekeeper" | "Umpire";
  dataUrl: string;
  url: string;
};

const roleStyles = {
  Scorekeeper: "scorekeeper-role scorekeeper-role-scorer",
  Umpire: "scorekeeper-role scorekeeper-role-umpire",
} as const;

const initialCrew = getDefaultGameCrew();

const defaultGameId = keepers.find((keeper) => keeper.gameId)?.gameId ?? games[0]?.id ?? "";

export default function ScorekeepersPage() {
  const { show, node } = useToast();
  const [schedule, setSchedule] = useState(games);
  const [crew, setCrew] = useState<Record<string, GameCrew>>(initialCrew);
  const [qrQueue, setQrQueue] = useState<QrCode[]>([]);
  const [selectedGameId, setSelectedGameId] = useState(defaultGameId);

  useEffect(() => {
    setSchedule(applyScheduleStartTime(games, readScheduleStartTime()));
    setCrew(getGameCrew());
  }, []);

  const gameNumberById = getFieldGameNumbers(schedule);
  const selectedGame = schedule.find((game) => game.id === selectedGameId) ?? schedule[0];

  const updateName = (gameId: string, role: keyof GameCrew, name: string) => {
    const nextCrew = { ...(crew[gameId] ?? { scorekeeper: "", umpire: "" }), [role]: name };
    setCrew((current) => ({ ...current, [gameId]: nextCrew }));
    saveGameCrew(gameId, nextCrew);
    setQrQueue((currentQueue) => currentQueue.filter((code) => code.gameId !== gameId));
  };

  const gameLabel = (game: Game) => `${game.time} · ${fieldGameLabel(game, gameNumberById)}`;

  const generateQr = async (game: Game) => {
    const current = crew[game.id] ?? { scorekeeper: "", umpire: "" };
    const scorekeeper = current.scorekeeper.trim();
    const umpire = current.umpire.trim();

    if (!scorekeeper || !umpire) {
      show("Enter both names before generating the QR codes");
      return;
    }

    try {
      const people: Array<{ name: string; role: QrCode["role"]; roleParam: string }> = [
        { name: scorekeeper, role: "Scorekeeper", roleParam: "scorer" },
        { name: umpire, role: "Umpire", roleParam: "umpire" },
      ];

      const codes = await Promise.all(people.map(async (person) => {
        const params = new URLSearchParams({
          role: person.roleParam,
          name: person.name,
          scheduleStart: readScheduleStartTime(),
        });
        const url = `${window.location.origin}/score/${game.id}?${params}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 320,
          margin: 1,
          color: { dark: "#17231f", light: "#fffdfa" },
        });

        return {
          gameId: game.id,
          gameLabel: gameLabel(game),
          name: person.name,
          role: person.role,
          dataUrl,
          url,
        };
      }));

      // Re-generating a game replaces its old links so the queue never shows stale names.
      setQrQueue((currentQueue) => [
        ...currentQueue.filter((code) => code.gameId !== game.id),
        ...codes,
      ]);
      show("QR codes added to the queue");
    } catch {
      show("Could not generate QR codes");
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
      .then(() => show("Link copied"))
      .catch(() => show("Copy failed"));
  };

  return (
    <>
      <PageHeader
        title="Scorekeepers"
        subtitle="Enter the two people for each game. Their role-specific QR codes will be ready in the queue below."
      />

      <div className="scorekeeper-page max-w-3xl">
        {selectedGame && (() => {
          const current = crew[selectedGame.id] ?? { scorekeeper: "", umpire: "" };
          const ready = Boolean(current.scorekeeper.trim() && current.umpire.trim());

          return (
            <section className="scorekeeper-game-card rounded-lg border border-line bg-card">
                <header className="scorekeeper-game-header border-b border-line">
                  <div>
                    <p className="scorekeeper-game-title">
                      {gameLabel(selectedGame)} · {selectedGame.teamA} vs {selectedGame.teamB}
                    </p>
                    <p className="scorekeeper-game-meta">
                      {divisionLabel(selectedGame.division)} · {selectedGame.tier} · {selectedGame.field}
                    </p>
                  </div>
                  <span className="scorekeeper-game-count">2 roles</span>
                </header>

                <div className="scorekeeper-crew">
                  <label className="scorekeeper-crew-row">
                    <span className={roleStyles.Scorekeeper}>Scorekeeper</span>
                    <input
                      className="scorekeeper-name-input"
                      aria-label={`Scorekeeper for ${gameLabel(selectedGame)}`}
                      placeholder="Enter scorekeeper name"
                      value={current.scorekeeper}
                      maxLength={40}
                      onChange={(event) => updateName(selectedGame.id, "scorekeeper", event.target.value)}
                    />
                  </label>

                  <label className="scorekeeper-crew-row">
                    <span className={roleStyles.Umpire}>Umpire</span>
                    <input
                      className="scorekeeper-name-input"
                      aria-label={`Umpire for ${gameLabel(selectedGame)}`}
                      placeholder="Enter umpire name"
                      value={current.umpire}
                      maxLength={40}
                      onChange={(event) => updateName(selectedGame.id, "umpire", event.target.value)}
                    />
                  </label>
                </div>

                <footer className="scorekeeper-game-footer border-t border-line">
                  <div className="scorekeeper-game-picker">
                    <span>Game in schedule</span>
                    <GameSelect
                      aria-label="Game in schedule"
                      value={selectedGame.id}
                      onChange={(gameId) => setSelectedGameId(gameId || defaultGameId)}
                      games={schedule}
                      gameNumberById={gameNumberById}
                      className="scorekeeper-game-select"
                    />
                  </div>
                  <button
                    className="btn btn-pri scorekeeper-generate"
                    disabled={!ready}
                    onClick={() => generateQr(selectedGame)}
                  >
                    Generate QR codes <span aria-hidden="true">↗</span>
                  </button>
                </footer>
              </section>
          );
        })()}

        {qrQueue.length > 0 && (
          <section className="scorekeeper-queue" aria-labelledby="qr-queue-title">
            <div className="scorekeeper-queue-heading">
              <div>
                <p className="scorekeeper-section-kicker">Ready to scan</p>
                <h2 id="qr-queue-title">QR queue</h2>
              </div>
              <span>{qrQueue.length} codes</span>
            </div>

            <div className="scorekeeper-qr-grid">
              {qrQueue.map((code) => (
                <article key={`${code.gameId}-${code.role}`} className="scorekeeper-qr-card">
                  <div className="scorekeeper-qr-topline">
                    <span className={roleStyles[code.role]}>{code.role}</span>
                    <span>{code.gameLabel}</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={code.dataUrl}
                    alt={`${code.role} QR code for ${code.name}`}
                    className="scorekeeper-qr-image"
                    width={220}
                    height={220}
                  />
                  <h3>{code.name}</h3>
                  <button className="btn scorekeeper-copy" onClick={() => copyLink(code.url)}>
                    Copy link
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
      {node}
    </>
  );
}
