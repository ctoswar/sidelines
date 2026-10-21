// Tournament config validation.
//
// The schedule start is the "HH:MM" 24-hour first slot the seeded schedule
// shifts from — validated with the same parser the client-side time shift
// uses, so a value the server accepts always shifts cleanly. The creation
// schema covers what the new-tournament wizard actually stores: a name, the
// date range, the optional courts/divisions that become the row's display
// `meta` (the table has no date columns), the place the tournament is listed
// under, and that first slot.

import { z } from "zod";
import { minutesFromTime } from "@/lib/schedule-config";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-07" is accepted; anything else is a form the date input cannot send. */
const isoDate = (message: string) =>
  z.string().refine((value) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)), message);

export const scheduleStartSchema = z.object({
  scheduleStart: z.string().refine(
    (value) => minutesFromTime(value) !== null,
    "Use a 24-hour time like 09:00.",
  ),
});

export const tournamentStatusSchema = z.object({
  status: z.enum(["live", "draft"], {
    errorMap: () => ({ message: "Status must be live or draft." }),
  }),
});

/**
 * The homepage Spotlight toggle. `featured` lives on the published event, not
 * the tournament, so it is only meaningful once the tournament is live and has
 * a catalogue row — the route no-ops on a draft.
 */
export const tournamentFeaturedSchema = z.object({
  featured: z.boolean({
    errorMap: () => ({ message: "Featured must be true or false." }),
  }),
});

/**
 * One pool-table entrant. Pickleball players register solo, so `name` is a
 * player's name as often as a team's; either way it is one slot in a pool.
 * `seed` is optional on the wire — the server continues the numbering when a
 * caller (CSV import, the signups bridge) leaves it blank.
 */
export const teamEntrySchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Give the entrant a name.")
    .max(60, "Keep the name under 60 characters."),
  pool: z.enum(["A", "B"], {
    errorMap: () => ({ message: "Pool must be A or B." }),
  }),
  seed: z.coerce.number()
    .int("Use a whole-number seed.")
    .min(1, "Seeds start at 1.")
    .max(9999, "That is more seeds than a draw has room for.")
    .optional(),
});

/** Bulk add — the shape both "Add team" and CSV import post. */
export const teamImportSchema = z.object({
  teams: z
    .array(teamEntrySchema)
    .min(1, "Add at least one entrant.")
    .max(500, "Five hundred entrants is plenty for one import."),
  /**
   * How these entrants arrived, for the table's provenance badge. Defaults to
   * "manual"; the CSV importer sends "csv". The server never accepts "signups"
   * here — that source is only written by the registrations bridge.
   */
  source: z.enum(["manual", "csv"]).optional(),
});

export const tournamentCreateSchema = z
  .object({
    name: z.string()
      .trim()
      .min(3, "Give the tournament a name (3 characters or more).")
      .max(80, "Keep the tournament name under 80 characters."),
    startDate: isoDate("Add a start date."),
    endDate: z.union([isoDate("Check the end date."), z.literal("")]).optional(),
    courts: z.coerce.number()
      .int("Use a whole number of courts.")
      .min(1, "A tournament uses at least one court.")
      .max(64, "That is more courts than a day has hours for.")
      .optional(),
    divisions: z.array(z.string().trim().min(1)).max(6, "Six divisions is plenty.").optional(),
    // The place a published event is listed under. Optional on the wire (an
    // API caller falls back to the organization's city); the wizard asks for
    // both, because the public card renders "City, Country".
    city: z.string().trim().max(60, "Keep the city under 60 characters.").optional(),
    country: z.string().trim().max(60, "Keep the country under 60 characters.").optional(),
    scheduleStart: scheduleStartSchema.shape.scheduleStart,
    status: tournamentStatusSchema.shape.status.optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });
