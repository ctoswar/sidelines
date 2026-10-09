import type { Game } from "@/types";

const START_TIME_KEY = "sidelines.demo.schedule-start-time";
export const DEFAULT_START_TIME = "09:00";

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function minutesFromLabel(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12 || minutes > 59) return null;
  if (match[3].toUpperCase() === "AM") hours = hours === 12 ? 0 : hours;
  else hours = hours === 12 ? 12 : hours + 12;
  return hours * 60 + minutes;
}

function labelFromMinutes(total: number) {
  const normalized = ((total % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function readScheduleStartTime() {
  if (typeof window === "undefined") return DEFAULT_START_TIME;
  const value = window.localStorage.getItem(START_TIME_KEY);
  return minutesFromTime(value ?? "") === null ? DEFAULT_START_TIME : value!;
}

export function saveScheduleStartTime(value: string) {
  if (minutesFromTime(value) !== null && typeof window !== "undefined") {
    window.localStorage.setItem(START_TIME_KEY, value);
  }
}

/** Shift the seeded schedule while preserving the spacing between rounds. */
export function applyScheduleStartTime(schedule: readonly Game[], startTime: string) {
  const firstSlot = schedule[0] ? minutesFromLabel(schedule[0].time) : null;
  const desiredStart = minutesFromTime(startTime);
  if (firstSlot === null || desiredStart === null) return [...schedule];
  const shift = desiredStart - firstSlot;
  return schedule.map((game) => {
    const slot = minutesFromLabel(game.time);
    return slot === null ? game : { ...game, time: labelFromMinutes(slot + shift) };
  });
}
