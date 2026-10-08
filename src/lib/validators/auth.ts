import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email, like name@club.com."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export const positions = ["Handler", "Cutter", "Both"] as const;
export const levels = ["First season", "Club level", "College or national"] as const;
export const matches = ["Prefer not to say", "Open", "Women's", "Mixed: MMP", "Mixed: WMP"] as const;
export const orgTypes = ["Club", "League", "School or university", "Independent organizer"] as const;
export const volumes = ["1 to 2", "3 to 5", "6 or more"] as const;

const choose = { errorMap: () => ({ message: "Please choose one." }) };

const credentials = {
  name: z.string().min(2, "Enter your full name."),
  email: loginSchema.shape.email,
  password: loginSchema.shape.password,
  confirm: z.string(),
  terms: z.boolean().refine((v) => v === true, "Accept the terms to continue."),
};

// Kept for the legacy generic signup form; role-specific forms use the schemas below.
export const signupSchema = z.object(credentials);

const sameAsPassword = (v: { password: string; confirm: string }) => v.password === v.confirm;
const mismatch = { path: ["confirm"], message: "Passwords do not match." };

export const playerSignupSchema = z
  .object({
    ...credentials,
    city: z.string().min(2, "Enter your city."),
    position: z.enum(positions, choose),
    level: z.enum(levels, choose),
    match: z.string().optional(),
    number: z.string().optional(),
    code: z.string().regex(/^([A-Za-z]{2,6}-\d{4})?$/, "Codes look like IRON-4821."),
  })
  .refine(sameAsPassword, mismatch);

export const organizerSignupSchema = z
  .object({
    ...credentials,
    org: z.string().min(2, "Enter your organization name."),
    orgType: z.enum(orgTypes, choose),
    title: z.string().min(2, "Enter your role."),
    volume: z.enum(volumes, choose),
    city: z.string().min(2, "Enter your city and country."),
    site: z.string().optional(),
  })
  .refine(sameAsPassword, mismatch);

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PlayerSignupInput = z.infer<typeof playerSignupSchema>;
export type OrganizerSignupInput = z.infer<typeof organizerSignupSchema>;
