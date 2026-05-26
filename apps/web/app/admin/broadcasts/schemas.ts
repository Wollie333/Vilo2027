import { z } from "zod";

export const broadcastSchema = z
  .object({
    severity: z.enum(["info", "warning", "critical"]),
    audience: z.enum(["all", "hosts", "guests", "staff", "super_admins"]),
    title: z.string().min(3, "At least 3 characters").max(120),
    body: z.string().min(10, "At least 10 characters").max(2000),
    link_url: z
      .string()
      .url("Must be a valid URL")
      .or(z.literal(""))
      .optional()
      .nullable(),
    link_label: z.string().max(40).optional().nullable(),
    starts_at: z.string().optional().nullable(),
    ends_at: z.string().optional().nullable(),
    requires_ack: z.boolean(),
    // Reason fields requireReason on cancel; create doesn't require one.
    reason: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.starts_at && val.ends_at) {
      if (new Date(val.starts_at) >= new Date(val.ends_at)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ends_at"],
          message: "End must be after start",
        });
      }
    }
    if (val.link_url && !val.link_label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["link_label"],
        message: "Required when a link URL is set",
      });
    }
  });

export type BroadcastInput = z.infer<typeof broadcastSchema>;

export const cancelBroadcastSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5, "Tell us why you're cancelling (min 5 chars)"),
});

export type CancelBroadcastInput = z.infer<typeof cancelBroadcastSchema>;
