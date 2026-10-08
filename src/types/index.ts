import type { DivisionId } from "@/lib/divisions";

export type GameStatus = "live" | "final" | "next";
export type Side = "a" | "b";

export interface Team { name: string; pool: "A" | "B"; seed: number }
export interface Game {
  id: string; field: string; time: string;
  teamA: string; teamB: string; score: string; status: GameStatus;
  division: DivisionId; tier: string;
}
export interface Keeper {
  name: string;
  role: "Scorer" | "Referee";
  gameId: string | null;
}
export interface Tournament { name: string; meta: string; status: "Live" | "Draft" }

export interface RosterPlayer { name: string; number: number; position: "Handler" | "Cutter" }
export interface OpenTournament { name: string; meta: string; fee: string; spots: string; slug?: string }

export interface EventItem {
  slug: string;
  name: string;
  start: string; // ISO date, e.g. 2026-11-14
  end: string;
  city: string;
  country: string;
  code: string;  // short country code shown on the chip
  tags: string[];
  status: "upcoming" | "past";
  featured?: boolean;
  live?: boolean;
  teams: number;
  color: string;     // logo tile colour
  monogram: string;  // logo tile letters
  hasLogo: boolean;  // false -> shows a date tile instead, like an event without a logo
}
