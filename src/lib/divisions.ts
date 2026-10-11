// Pickleball tournament taxonomy: choose a division, then a DUPR-style skill tier.

export type DivisionId = "mens" | "womens" | "mixed";

export interface Division {
  id: DivisionId;
  label: string;
  tiers: string[];
}

export const divisions: Division[] = [
  { id: "mens", label: "Men's", tiers: ["3.0", "3.5", "4.0+"] },
  { id: "womens", label: "Women's", tiers: ["3.0", "3.5", "4.0+"] },
  { id: "mixed", label: "Mixed", tiers: ["3.0", "3.5", "4.0+"] },
];

export const divisionLabel = (id: DivisionId) => divisions.find((d) => d.id === id)?.label ?? id;
