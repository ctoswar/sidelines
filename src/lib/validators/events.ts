import { z } from "zod";

/** Organizer-published announcement. `author` comes from the session, never the body. */
export const announcementSchema = z.object({
  slug: z.string().min(1, "Pick an event.").max(80),
  title: z.string().trim().min(1, "Give the announcement a title.").max(80, "Keep the title under 80 characters."),
  body: z.string().trim().min(1, "Write what players should know.").max(400, "Keep it under 400 characters."),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

/** Both crew slots, required together — the QR queue only generates when both are set. */
export const crewSchema = z.object({
  scorekeeper: z.string().trim().min(1, "Enter the scorekeeper name.").max(40, "Keep names under 40 characters."),
  umpire: z.string().trim().min(1, "Enter the umpire name.").max(40, "Keep names under 40 characters."),
});
export type CrewInput = z.infer<typeof crewSchema>;

/** Final score as typed by the panel: "11–7" (en dash or hyphen). */
export const resultSchema = z.object({
  score: z
    .string()
    .trim()
    .regex(/^\d{1,3}[–-]\d{1,3}$/, "Scores look like 11–7."),
});
export type ResultInput = z.infer<typeof resultSchema>;
