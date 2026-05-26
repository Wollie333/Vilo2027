import { z } from "zod";

export const categoryPrefSchema = z.object({
  category_id: z.string(),
  email_enabled: z.boolean(),
  push_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
  digest_mode: z.enum(["off", "daily", "weekly"]),
});

export const preferencesSchema = z.object({
  categories: z.array(categoryPrefSchema),
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM")
    .nullable(),
  quiet_hours_end: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM")
    .nullable(),
  quiet_hours_timezone: z.string().min(1),
  dedupe_enabled: z.boolean(),
  digest_send_hour: z.number().int().min(0).max(23),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type CategoryPrefInput = z.infer<typeof categoryPrefSchema>;
