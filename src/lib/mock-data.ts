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
  // 9:00 AM
  { id: "g1", field: "Court 1", time: "9:00 AM", teamA: "Harbor", teamB: "Redline", score: "11–8", status: "final", division: "mens", tier: "3.5" },
  { id: "g2", field: "Court 2", time: "9:00 AM", teamA: "Birch", teamB: "Static", score: "6–7", status: "live", division: "mixed", tier: "3.0" },
  { id: "g7", field: "Court 3", time: "9:00 AM", teamA: "Driftwood", teamB: "Kingsley", score: "4–3", status: "live", division: "mens", tier: "3.0" },
  // 10:30 AM
  { id: "g3", field: "Court 1", time: "10:30 AM", teamA: "Ironwood", teamB: "Lowtide", score: "11–9", status: "live", division: "mens", tier: "3.5" },
  { id: "g8", field: "Court 2", time: "10:30 AM", teamA: "Sparrow", teamB: "Meridian", score: "11–8", status: "final", division: "womens", tier: "3.0" },
  { id: "g9", field: "Court 3", time: "10:30 AM", teamA: "Quarry", teamB: "Sundown", score: "", status: "next", division: "mens", tier: "3.0" },
  // 12:00 PM
  { id: "g10", field: "Court 1", time: "12:00 PM", teamA: "Willow", teamB: "Ember", score: "", status: "next", division: "womens", tier: "3.5" },
  { id: "g11", field: "Court 2", time: "12:00 PM", teamA: "Jive", teamB: "Papaya", score: "", status: "next", division: "mixed", tier: "3.0" },
  { id: "g12", field: "Court 3", time: "12:00 PM", teamA: "Kestrel", teamB: "Marlin", score: "", status: "next", division: "womens", tier: "3.0" },
  // 1:30 PM
  { id: "g4", field: "Court 1", time: "1:30 PM", teamA: "Ironwood", teamB: "Harbor", score: "", status: "next", division: "mens", tier: "3.5" },
  { id: "g5", field: "Court 2", time: "1:30 PM", teamA: "Northgate", teamB: "Pinecone", score: "", status: "next", division: "mixed", tier: "3.5" },
  { id: "g6", field: "Court 3", time: "1:30 PM", teamA: "Lowtide", teamB: "Redline", score: "", status: "next", division: "mens", tier: "3.5" },
];

export const keepers: Keeper[] = [
  // g1 fills a two-person slot: a scorer and an umpire on the same game
  { name: "Maya Reyes", role: "Scorer", gameId: "g1" },
  { name: "Jon Park", role: "Umpire", gameId: "g1" },
  { name: "Lena Cho", role: "Scorer", gameId: "g3" },
  { name: "Sam Ortiz", role: "Scorer", gameId: null },
];

import type { OpenTournament, RosterPlayer } from "@/types";

export const MY_TEAM = "Ironwood";
export const JOIN_CODE = "IRON-4821";

export const roster: RosterPlayer[] = [
  { name: "Alex Rivera", number: 17, position: "Singles" },
  { name: "Dana Cruz", number: 4, position: "Doubles" },
  { name: "Miguel Tan", number: 9, position: "Doubles" },
  { name: "Priya Nair", number: 22, position: "Singles" },
  { name: "Kai Santos", number: 31, position: "Doubles" },
  { name: "Noor Haddad", number: 7, position: "Doubles" },
];

export const openTournaments: OpenTournament[] = [
  { name: "Manila Mixed Classic 2026", meta: "14–15 Nov · Mixed · Quezon City", fee: "₱6,000 per team", spots: "4 spots left", slug: "manila-mixed-classic" },
  { name: "Cebu Beach Pickleball Cup 2027", meta: "6–7 Feb · Mixed beach · Cebu", fee: "₱4,500 per team", spots: "2 spots left", slug: "cebu-beach-pickleball-cup" },
  { name: "Hong Kong Winter Cup", meta: "12–13 Dec · Open · Hong Kong", fee: "₱3,000 per team", spots: "Open", slug: "hong-kong-winter-cup" },
];
