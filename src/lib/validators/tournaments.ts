// Tournament config validation.
//
// The schedule start is the "HH:MM" 24-hour first slot the seeded schedule
// shifts from — validated with the same parser the client-side time shift
// uses, so a value the server accepts always shifts cleanly. The creation
// schema covers what the new-tournament wizard actually stores: a name, the
// date range, the optional courts/divisions that become the row's display
// `meta` (the table has no date columns), and that first slot.

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
    scheduleStart: scheduleStartSchema.shape.scheduleStart,
    status: tournamentStatusSchema.shape.status.optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });
