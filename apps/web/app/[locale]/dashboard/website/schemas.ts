import { z } from "zod";

export const createWebsiteSchema = z.object({
  businessId: z.string().uuid(),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "too_short")
    .max(63, "too_long"),
});

export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;
