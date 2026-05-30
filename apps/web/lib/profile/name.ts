import { z } from "zod";

// Single source of truth for how a user's name is captured across the WHOLE
// app — host signup, guest signup, host settings, guest portal settings, etc.
// Every profile form captures two fields (Name + Surname) and stores the
// combined value in the single `user_profiles.full_name` column.

/** Zod fragment — spread into any account/profile schema: `{ ...nameFields, ... }`. */
export const nameFields = {
  first_name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(60, "Name is too long."),
  surname: z
    .string()
    .trim()
    .min(1, "Enter your surname.")
    .max(60, "Surname is too long."),
};

/** Standalone schema for the two name fields. */
export const nameFieldsSchema = z.object(nameFields);
export type NameFields = z.infer<typeof nameFieldsSchema>;

/** Combine Name + Surname into the stored full_name (collapsing whitespace). */
export function combineName(firstName: string, surname: string): string {
  return `${firstName ?? ""} ${surname ?? ""}`.replace(/\s+/g, " ").trim();
}

/** Split a stored full_name back into Name + Surname for editing. */
export function splitName(full: string | null | undefined): {
  first_name: string;
  surname: string;
} {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", surname: "" };
  return { first_name: parts[0], surname: parts.slice(1).join(" ") };
}
