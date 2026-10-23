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

/**
 * True when a stored value is one of the three division ids. Registrations
 * carry the division as plain text in Postgres, so every read maps the column
 * through this guard before it reaches a DivisionId-typed field.
 */
export const isDivisionId = (value: string | null | undefined): value is DivisionId =>
  divisions.some((d) => d.id === value);
