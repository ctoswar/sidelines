// Event registration validation.
//
// The register flow on the event page is per-account and per-division: the
// picker sends one of the three taxonomy ids (the same ones the team profile
// editor and the DB rows use), so a missing or unknown division is a bad
// request rather than a silent default.

import { z } from "zod";

export const registerSchema = z.object({
  division: z.enum(["mens", "womens", "mixed"], {
    errorMap: () => ({ message: "Pick one of the three divisions." }),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
