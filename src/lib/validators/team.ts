// Team profile validation.
//
// The editor form sends every field on save, so this is a full-update schema
// rather than a partial patch. `preset` is checked against the shipped
// BANNER_PRESETS list and `division` against the same ids the taxonomy
// module and the DB enum use.

import { z } from "zod";
import { BANNER_PRESETS } from "@/lib/team-banner";

export const teamUpdateSchema = z.object({
  name: z.string().trim().min(2, "Team name needs at least 2 characters.")
    .max(40, "Team name must be 40 characters or fewer."),
  tagline: z.string().trim().max(90, "Tagline must be 90 characters or fewer."),
  preset: z.string().refine(
    (id) => BANNER_PRESETS.some((p) => p.id === id),
    "That banner style does not exist.",
  ),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #c8ef70."),
  division: z.enum(["mens", "womens", "mixed"], { errorMap: () => ({ message: "Pick one of the three divisions." }) }),
  seed: z.number().int().min(1, "Seed must be at least 1.").max(64, "Seed must be 64 or lower."),
});

export type TeamUpdate = z.infer<typeof teamUpdateSchema>;
