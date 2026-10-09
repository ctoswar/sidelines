"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type AnimatedSelectOption = {
  value: string;
  label: string;
  meta?: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: AnimatedSelectOption[];
  className?: string;
  "aria-label"?: string;
};

export function AnimatedSelect({
  value,
  onChange,
  options,
  className = "",
  "aria-label": ariaLabel = "Select an option",
}: Props) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  const isDisabled = (index: number) => options[index]?.disabled === true;
  const firstAvailableIndex = () => options.findIndex((option) => !option.disabled);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const roomBelow = window.innerHeight - rect.bottom;
      setPlacement(roomBelow < 220 && rect.top > roomBelow ? "up" : "down");
    }
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
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  useEffect(() => {
    const owner = rootRef.current?.closest("section") ?? rootRef.current?.parentElement;
    if (!owner || !open) return;
    owner.classList.add("game-select-owner-open");
    return () => owner.classList.remove("game-select-owner-open");
  }, [open]);

  const pick = (index: number) => {
    if (isDisabled(index)) return;
    onChange(options[index].value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    let next = activeIndex;
    for (let step = 0; step < options.length; step += 1) {
      next = (next + direction + options.length) % options.length;
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
      for (let last = options.length - 1; last >= 0; last -= 1) {
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

  const selected = options[selectedIndex];

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
        <span>{selected?.label ?? "Select…"}</span>
        <span className="game-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div
          id={listboxId}
          className={`game-select-menu ${placement === "up" ? "is-up" : ""}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => (
            <button
              ref={(element) => { optionRefs.current[index] = element; }}
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled}
              disabled={option.disabled}
              className={`game-select-option ${activeIndex === index ? "is-active" : ""}`}
              onClick={() => pick(index)}
              onMouseEnter={() => !option.disabled && setActiveIndex(index)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              <span className="game-select-option-title">{option.label}</span>
              {option.meta && <span className="game-select-option-meta">{option.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
