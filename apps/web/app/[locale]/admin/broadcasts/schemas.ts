import { z } from "zod";

export const BANNER_SURFACES = ["dashboard", "public"] as const;
export const BANNER_DISMISS_MODES = [
  "dismissible",
  "acknowledge",
  "persistent",
] as const;

// Fields shared by create + edit. Severity/audience live here too but the edit
// path locks them (see editBroadcastSchema) — the blast already went out.
const baseBroadcastFields = {
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
  // Banner display controls — decoupled from severity.
  show_banner: z.boolean(),
  banner_surfaces: z.array(z.enum(BANNER_SURFACES)),
  banner_dismiss_mode: z.enum(BANNER_DISMISS_MODES),
  // Reason fields requireReason on cancel; create doesn't require one.
  reason: z.string().optional(),
};

// Shared cross-field rules for both create + edit.
function refineBroadcast(
  val: {
    starts_at?: string | null;
    ends_at?: string | null;
    link_url?: string | null;
    link_label?: string | null;
    show_banner: boolean;
    banner_surfaces: string[];
  },
  ctx: z.RefinementCtx,
) {
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
  if (val.show_banner && val.banner_surfaces.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["banner_surfaces"],
      message: "Pick at least one surface for the banner",
    });
  }
}

export const broadcastSchema = z
  .object(baseBroadcastFields)
  .superRefine(refineBroadcast);

export type BroadcastInput = z.infer<typeof broadcastSchema>;

// Edit: audience + severity are LOCKED after send (the fan-out already ran for
// that specific audience/severity — changing them would misrepresent who got
// what). Everything else — content, link, banner display, schedule — is editable.
export const editBroadcastSchema = z
  .object({
    id: z.string().uuid(),
    title: baseBroadcastFields.title,
    body: baseBroadcastFields.body,
    link_url: baseBroadcastFields.link_url,
    link_label: baseBroadcastFields.link_label,
    starts_at: baseBroadcastFields.starts_at,
    ends_at: baseBroadcastFields.ends_at,
    requires_ack: baseBroadcastFields.requires_ack,
    show_banner: baseBroadcastFields.show_banner,
    banner_surfaces: baseBroadcastFields.banner_surfaces,
    banner_dismiss_mode: baseBroadcastFields.banner_dismiss_mode,
    // Unused on edit, but withAdminAudit constrains TArgs to { reason?: string }.
    reason: z.string().optional(),
  })
  .superRefine(refineBroadcast);

export type EditBroadcastInput = z.infer<typeof editBroadcastSchema>;

export const cancelBroadcastSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(5, "Tell us why you're cancelling (min 5 chars)"),
});

export type CancelBroadcastInput = z.infer<typeof cancelBroadcastSchema>;
