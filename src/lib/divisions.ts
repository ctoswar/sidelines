// Pickleball tournament taxonomy: choose a division, then a DUPR-style skill tier.
//
// Three vocabularies used to disagree: the registration picker offered
// mens/womens/mixed, the organizer wizard advertised "Open / Women's /
// Mixed", and the public filters offered "Open / Women / Mixed" — so an event
// advertising "Open" had no registrable division for it. "Open" (any gender)
// is a real pickleball division, so players can register into it.
//
// The split below matters: `DivisionId` mirrors the Postgres enum on
// games/tournament_teams (three values), while registrations are plain text
// and can carry "open" too. Nothing DB-enum-backed accepts "open" until a
// migration widens that enum.

export type DivisionId = "mens" | "womens" | "mixed";

/** What a player may register as — the DB enum ids plus the text-only Open. */
export type RegistrationDivisionId = "open" | DivisionId;

export interface Division {
  id: DivisionId;
  label: string;
  /** Advertised skill tiers (DUPR-style). VERIFY exact bracket definitions. */
  tiers: string[];
}

export const divisions: Division[] = [
  { id: "mens", label: "Men's", tiers: ["3.0", "3.5", "4.0+"] },
  { id: "womens", label: "Women's", tiers: ["3.0", "3.5", "4.0+"] },
  { id: "mixed", label: "Mixed", tiers: ["3.0", "3.5", "4.0+"] },
];

/** The picker's options, in catalogue order: Open first. */
export const registrationDivisions: { id: RegistrationDivisionId; label: string }[] = [
  { id: "open", label: "Open" },
  ...divisions.map((d) => ({ id: d.id, label: d.label })),
];

export const divisionLabel = (id: DivisionId | RegistrationDivisionId) =>
  registrationDivisions.find((d) => d.id === id)?.label ?? id;

/**
 * True when a stored value is one of the three DB-enum ids. Games and team
 * rows carry the division as a Postgres enum, so every read maps the column
 * through this guard before it reaches a DivisionId-typed field.
 */
export const isDivisionId = (value: string | null | undefined): value is DivisionId =>
  divisions.some((d) => d.id === value);

/** Same guard for registration rows, which may also hold the text-only Open. */
export const isRegistrationDivisionId = (
  value: string | null | undefined,
): value is RegistrationDivisionId => registrationDivisions.some((d) => d.id === value);

/**
 * The divisions an event actually advertises, from its tag list. Wizard and
 * seed data write the display labels ("Open", "Women's", "Mixed") into tags;
 * unmatched tags fall back to offering the full taxonomy rather than hiding
 * divisions the organizer runs under a label this list doesn't know.
 */
export const divisionsForEvent = (tags: readonly string[]): { id: RegistrationDivisionId; label: string }[] => {
  const wanted = new Set(tags.map((tag) => tag.trim().toLowerCase()));
  const matched = registrationDivisions.filter((d) =>
    wanted.has(d.id) ||
    wanted.has(d.label.toLowerCase()) ||
    wanted.has(d.label.toLowerCase().replace("'s", "")),
  );
  return matched.length > 0 ? matched : registrationDivisions;
};
