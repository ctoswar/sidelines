// Event registration validation.
//
// The register flow on the event page is per-account and per-division: the
// picker sends one of the taxonomy ids (the same ones the team profile
// editor and the DB rows use), so a missing or unknown division is a bad
// request rather than a silent default. "open" is the any-gender division the
// catalogue advertises; the column is plain text, so older rows are unaffected.

import { z } from "zod";

export const registerSchema = z.object({
  division: z.enum(["open", "mens", "womens", "mixed"], {
    errorMap: () => ({ message: "Pick one of the event's divisions." }),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
