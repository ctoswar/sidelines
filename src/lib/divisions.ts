// Tournament division taxonomy: pick a division (Mens / Womens / Mixed),
// then a skill tier within it — like a tournament category poster.

export type DivisionId = "mens" | "womens" | "mixed";

export interface Division {
  id: DivisionId;
  label: string;
  tiers: string[];
}

export const divisions: Division[] = [
  { id: "mens", label: "Mens", tiers: ["Beginners", "Low Novice", "High Novice"] },
  { id: "womens", label: "Womens", tiers: ["Beginners", "Low Novice", "High Novice"] },
  { id: "mixed", label: "Mixed", tiers: ["Beginners", "Novice"] },
];

export const divisionLabel = (id: DivisionId) => divisions.find((d) => d.id === id)?.label ?? id;
