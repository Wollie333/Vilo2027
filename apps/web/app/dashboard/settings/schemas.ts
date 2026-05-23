import { z } from "zod";

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(120, "Name is too long."),
  phone: z
    .string()
    .trim()
    .max(40, "Phone number is too long.")
    .optional()
    .or(z.literal("")),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const hostSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Display name is too short.")
    .max(120, "Display name is too long."),
  bio: z
    .string()
    .trim()
    .max(2000, "Bio is too long.")
    .optional()
    .or(z.literal("")),
  website_url: z
    .string()
    .trim()
    .max(300, "URL is too long.")
    .optional()
    .or(z.literal("")),
});
export type HostInput = z.infer<typeof hostSchema>;
