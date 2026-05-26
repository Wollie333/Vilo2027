import { z } from "zod";

// Unified profile form — covers user_profiles + hosts in one save.
// host_* fields are optional because a user without a hosts row (yet)
// should still be able to save name/phone/avatar.
export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(120, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254, "Email is too long."),
  phone: z
    .string()
    .trim()
    .max(40, "Phone number is too long.")
    .optional()
    .or(z.literal("")),
  avatar_url: z
    .string()
    .trim()
    .max(2000, "Avatar URL is too long.")
    .optional()
    .or(z.literal("")),
  // Host-page fields (apply only if the user has a hosts row).
  display_name: z
    .string()
    .trim()
    .max(120, "Display name is too long.")
    .optional()
    .or(z.literal("")),
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
export type ProfileInput = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password is too long."),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords don't match.",
  });
export type PasswordInput = z.infer<typeof passwordSchema>;
