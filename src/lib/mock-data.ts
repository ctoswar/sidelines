import type { Game, Keeper, Team, Tournament } from "@/types";

export const tournaments: Tournament[] = [
  { name: "Harbor Spring Open", meta: "Oct 24–25 · 8 teams · Open division", status: "Live" },
  { name: "Riverside Mixed Classic", meta: "Nov 15 · 12 teams · Mixed", status: "Draft" },
  { name: "Winter Indoor Cup", meta: "Jan 9 · 6 teams · Open", status: "Draft" },
];

export const teams: Team[] = [
  { name: "Ironwood", pool: "A", seed: 1 }, { name: "Lowtide", pool: "A", seed: 4 },
  { name: "Harbor", pool: "A", seed: 5 }, { name: "Redline", pool: "A", seed: 8 },
  { name: "Birch", pool: "B", seed: 2 }, { name: "Static", pool: "B", seed: 3 },
  { name: "Northgate", pool: "B", seed: 6 }, { name: "Pinecone", pool: "B", seed: 7 },
];

export const games: Game[] = [
  { id: "g1", field: "Field 1", time: "9:00", teamA: "Harbor", teamB: "Redline", score: "15–12", status: "final" },
  { id: "g2", field: "Field 2", time: "9:00", teamA: "Birch", teamB: "Static", score: "6–7", status: "live" },
  { id: "g3", field: "Field 3", time: "9:00", teamA: "Ironwood", teamB: "Lowtide", score: "11–9", status: "live" },
  { id: "g4", field: "Field 1", time: "10:30", teamA: "Ironwood", teamB: "Harbor", score: "", status: "next" },
  { id: "g5", field: "Field 2", time: "10:30", teamA: "Northgate", teamB: "Pinecone", score: "", status: "next" },
  { id: "g6", field: "Field 3", time: "10:30", teamA: "Lowtide", teamB: "Redline", score: "", status: "next" },
];

export const keepers: Keeper[] = [
  { name: "Maya Reyes", field: "Field 1", status: "Accepted" },
  { name: "Jon Park", field: "Field 2", status: "Accepted" },
  { name: "Lena Cho", field: "Field 3", status: "Accepted" },
  { name: "sam@club.com", field: "Unassigned", status: "Invite sent" },
];

import type { OpenTournament, RosterPlayer } from "@/types";

export const MY_TEAM = "Ironwood";
export const JOIN_CODE = "IRON-4821";

export const roster: RosterPlayer[] = [
  { name: "Alex Rivera", number: 17, position: "Handler" },
  { name: "Dana Cruz", number: 4, position: "Cutter" },
  { name: "Miguel Tan", number: 9, position: "Cutter" },
  { name: "Priya Nair", number: 22, position: "Handler" },
  { name: "Kai Santos", number: 31, position: "Cutter" },
  { name: "Noor Haddad", number: 7, position: "Cutter" },
];

export const openTournaments: OpenTournament[] = [
  { name: "Manila Mixed Classic 2026", meta: "14–15 Nov · Mixed · Quezon City", fee: "₱6,000 per team", spots: "4 spots left", slug: "manila-mixed-classic" },
  { name: "Cebu Beach Ultimate Cup 2027", meta: "6–7 Feb · Mixed beach · Cebu", fee: "₱4,500 per team", spots: "2 spots left", slug: "cebu-beach-ultimate-cup" },
  { name: "Hong Kong Winter Cup", meta: "12–13 Dec · Open · Hong Kong", fee: "₱3,000 per team", spots: "Open", slug: "hong-kong-winter-cup" },
];
