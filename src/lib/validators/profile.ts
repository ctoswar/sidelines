import { z } from "zod";
import { genders, hands, levels, matches, positions, profileColors } from "./auth";

const choose = { errorMap: () => ({ message: "Please choose one." }) };

/**
 * Player profile edits. Identity fields (username/name/email) live on the
 * Better Auth `user` row; everything else lands in `player_profiles`.
 *
 * `photoPath` is deliberately absent — pictures go through the multipart
 * upload endpoint, never through this JSON body.
 */
export const profileUpdateSchema = z.object({
  username: z.string()
    .min(3, "Use at least 3 characters.")
    .max(20, "Keep your username under 20 characters.")
    .regex(/^[a-z0-9._]+$/, "Use lowercase letters, numbers, periods, or underscores only."),
  name: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email, like name@club.com."),
  nickname: z.string().max(32, "Keep your nickname under 32 characters.").optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(genders, choose),
  nationality: z.string().optional(),
  city: z.string().optional(),
  format: z.enum(positions, choose),
  experience: z.enum(levels, choose),
  dominantHand: z.enum(hands, choose),
  playingSince: z.string().optional(),
  match: z.enum(matches, choose),
  number: z.string().optional(),
  bio: z.string().max(250, "Keep your bio under 250 characters.").optional(),
  profileColor: z.enum(profileColors, choose),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
