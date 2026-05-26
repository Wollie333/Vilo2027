import { z } from "zod";

export const userSearchSchema = z.object({
  query: z.string().max(120).default(""),
  role: z.enum(["any", "guest", "host", "staff", "super_admin"]).default("any"),
});

export type UserSearchInput = z.infer<typeof userSearchSchema>;

export type UserSearchResult = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
};

export const sendIndividualSchema = z.object({
  title: z.string().min(3, "At least 3 characters").max(120),
  body: z.string().min(5, "At least 5 characters").max(2000),
  link_url: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional()
    .nullable(),
  link_label: z.string().max(40).optional().nullable(),
  severity: z.enum(["info", "default", "high"]),
  channels: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.literal(true), // in-app is always on for individual sends
  }),
  recipient_ids: z
    .array(z.string().uuid())
    .min(1, "Pick at least one recipient")
    .max(500, "Up to 500 recipients per send"),
  reason: z.string().optional(),
});

export type SendIndividualInput = z.infer<typeof sendIndividualSchema>;
