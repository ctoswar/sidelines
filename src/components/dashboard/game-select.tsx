"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { divisionLabel } from "@/lib/divisions";
import { fieldGameLabel } from "@/lib/game-labels";
import type { Game } from "@/types";

type Props = {
  value: string;
  onChange: (value: string) => void;
  games: Game[];
  gameNumberById: ReadonlyMap<string, number>;
  className?: string;
  disabledGameIds?: ReadonlySet<string>;
  "aria-label"?: string;
};

export function GameSelect({
  value,
  onChange,
  games,
  gameNumberById,
  className = "",
  disabledGameIds,
  "aria-label": ariaLabel = "Game",
}: Props) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedGame = games.find((game) => game.id === value);
  const optionCount = games.length + 1;
  const isDisabled = (index: number) => index > 0 && disabledGameIds?.has(games[index - 1].id) === true;
  const firstAvailableIndex = () => {
    for (let index = 0; index < optionCount; index += 1) {
      if (!isDisabled(index)) return index;
    }
    return 0;
  };

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const roomBelow = window.innerHeight - rect.bottom;
      setPlacement(roomBelow < 330 && rect.top > roomBelow ? "up" : "down");
    }
    const selectedIndex = selectedGame ? games.findIndex((game) => game.id === selectedGame.id) + 1 : 0;
    setActiveIndex(isDisabled(selectedIndex) ? firstAvailableIndex() : selectedIndex);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    const owner = rootRef.current?.closest("section") ?? rootRef.current?.parentElement;
    if (!owner || !open) return;
    owner.classList.add("game-select-owner-open");
    return () => owner.classList.remove("game-select-owner-open");
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  const pick = (index: number) => {
    if (isDisabled(index)) return;
    onChange(index === 0 ? "" : games[index - 1].id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    let next = activeIndex;
    for (let step = 0; step < optionCount; step += 1) {
      next = (next + direction + optionCount) % optionCount;
      if (!isDisabled(next)) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(firstAvailableIndex());
    } else if (event.key === "End") {
      event.preventDefault();
      for (let last = optionCount - 1; last >= 0; last -= 1) {
        if (!isDisabled(last)) {
          setActiveIndex(last);
          break;
        }
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(index);
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) openMenu();
      else moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openMenu();
      else moveActive(-1);
    }
  };

  const triggerText = selectedGame ? `${selectedGame.time} · ${fieldGameLabel(selectedGame, gameNumberById)}` : "Unassigned";

  return (
    <div ref={rootRef} className={`game-select ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`game-select-trigger inp ${open ? "is-open" : ""}`}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selectedGame ? "" : "text-muted"}>{triggerText}</span>
        <span className="game-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div
          id={listboxId}
          className={`game-select-menu ${placement === "up" ? "is-up" : ""}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          <button
            ref={(element) => { optionRefs.current[0] = element; }}
            type="button"
            role="option"
            aria-selected={!value}
            className={`game-select-option ${activeIndex === 0 ? "is-active" : ""}`}
            onClick={() => pick(0)}
            onMouseEnter={() => setActiveIndex(0)}
            onKeyDown={(event) => handleOptionKeyDown(event, 0)}
          >
            <span className="game-select-option-title">Unassigned</span>
            <span className="game-select-option-meta">Choose a game later</span>
          </button>

          {games.map((game, index) => {
            const optionIndex = index + 1;
            const disabled = isDisabled(optionIndex);
            return (
              <button
                ref={(element) => { optionRefs.current[optionIndex] = element; }}
                key={game.id}
                type="button"
                role="option"
                aria-selected={value === game.id}
                aria-disabled={disabled}
                disabled={disabled}
                className={`game-select-option ${activeIndex === optionIndex ? "is-active" : ""}`}
                onClick={() => pick(optionIndex)}
                onMouseEnter={() => !disabled && setActiveIndex(optionIndex)}
                onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
              >
                <span className="game-select-option-kicker">{game.time} · {fieldGameLabel(game, gameNumberById)}</span>
                <span className="game-select-option-title">{game.teamA} vs {game.teamB}</span>
                <span className="game-select-option-meta">
                  {divisionLabel(game.division)} · {game.tier}{disabled ? " · Full" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
