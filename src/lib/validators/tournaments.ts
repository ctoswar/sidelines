// Tournament config validation.
//
// The schedule start is the "HH:MM" 24-hour first slot the seeded schedule
// shifts from — validated with the same parser the client-side time shift
// uses, so a value the server accepts always shifts cleanly.

import { z } from "zod";
import { minutesFromTime } from "@/lib/schedule-config";

export const scheduleStartSchema = z.object({
  scheduleStart: z.string().refine(
    (value) => minutesFromTime(value) !== null,
    "Use a 24-hour time like 09:00.",
  ),
});
