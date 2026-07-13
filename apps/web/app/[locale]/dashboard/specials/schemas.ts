import { z } from "zod";

import { SPECIAL_CATEGORY_KEYS } from "@/lib/specials/categories";

// Validated shape for the Specials create/edit wizard (S1). Mirrors the DB
// CHECK constraints from migration 20260618002000 so the action can trust the
// row it writes. business_id + currency are NOT here — they are derived
// server-side from the chosen property (its business owns currency/banking).
// Savings fields (was_price/…) are computed in S2; left null in S1.

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const isoDateOrNull = isoDate.nullable();

export const SPECIAL_DATE_MODES = ["fixed", "flexible"] as const;
export const SPECIAL_PRICE_MODES = ["flat", "per_night"] as const;
// Statuses the editor itself can set. Lifecycle-only states (paused, expired,
// archived) are reached through setSpecialStatusAction / the cron, never here.
export const SPECIAL_EDITOR_STATUSES = ["draft", "active"] as const;
export type SpecialEditorStatus = (typeof SPECIAL_EDITOR_STATUSES)[number];

export const specialAddonSchema = z.object({
  addon_id: z.string().uuid(),
  is_required: z.boolean().default(false),
  unit_price_override: z.number().min(0).max(10_000_000).nullable(),
  quantity: z.number().int().min(1).max(100).default(1),
});
export type SpecialAddonInput = z.infer<typeof specialAddonSchema>;

export const specialInputSchema = z
  .object({
    // target
    property_id: z.string().uuid("Pick a property."),
    room_id: z.string().uuid().nullable(),

    // presentation
    title: z.string().trim().min(2, "At least 2 characters.").max(120),
    description: z.string().trim().max(2000).nullable(),
    hero_image_path: z.string().trim().max(400).nullable(),
    badge: z.string().trim().max(40).nullable(),

    // date model
    date_mode: z.enum(SPECIAL_DATE_MODES),
    fixed_check_in: isoDateOrNull,
    fixed_check_out: isoDateOrNull,
    window_start: isoDateOrNull,
    window_end: isoDateOrNull,
    min_nights: z.number().int().min(1).max(365).nullable(),
    max_nights: z.number().int().min(1).max(365).nullable(),
    // "run continuously" — always-on flexible deal, no window end / book-by.
    is_evergreen: z.boolean().default(false),

    // pricing model (seasonal never applies — enforced in S2 pricing)
    price_mode: z.enum(SPECIAL_PRICE_MODES),
    flat_total: z.number().min(0).max(10_000_000).nullable(),
    per_night_price: z.number().min(0).max(10_000_000).nullable(),
    max_guests: z.number().int().min(1).max(100).nullable(),

    // inventory
    quantity: z.number().int().min(1, "At least 1.").max(100_000),

    // scheduling
    go_live_at: isoDateOrNull,
    book_by: isoDateOrNull,

    // merchandising
    categories: z
      .array(z.enum(SPECIAL_CATEGORY_KEYS as [string, ...string[]]))
      .max(8),
    custom_tags: z.array(z.string().trim().min(1).max(30)).max(12),
    is_featured: z.boolean().default(false),

    // policy override
    cancellation_policy_id: z.string().uuid().nullable(),

    // visibility (both false + active = link-only)
    show_in_directory: z.boolean().default(true),
    show_on_website: z.boolean().default(true),

    // lifecycle (editor may only choose draft|active)
    status: z.enum(SPECIAL_EDITOR_STATUSES).default("draft"),

    // bundled add-ons (compulsory vs optional)
    addons: z.array(specialAddonSchema).max(20).default([]),
  })
  // ── coherent date columns per mode ───────────────────────────────
  .refine(
    (v) =>
      v.date_mode !== "fixed" ||
      (!!v.fixed_check_in &&
        !!v.fixed_check_out &&
        v.fixed_check_out > v.fixed_check_in),
    {
      path: ["fixed_check_out"],
      message: "Set a check-in and a later check-out.",
    },
  )
  .refine(
    (v) =>
      v.date_mode !== "flexible" ||
      (!!v.window_start &&
        // Evergreen deals run continuously — no window end required.
        (v.is_evergreen || (!!v.window_end && v.window_end > v.window_start)) &&
        v.min_nights != null &&
        v.min_nights >= 1 &&
        (v.max_nights == null || v.max_nights >= v.min_nights)),
    {
      path: ["window_end"],
      message: "Set a window and a valid min/max night range.",
    },
  )
  // ── coherent price column per mode ───────────────────────────────
  .refine(
    (v) =>
      v.price_mode !== "flat" || (v.flat_total != null && v.flat_total >= 0),
    { path: ["flat_total"], message: "Enter the package total." },
  )
  .refine(
    (v) =>
      v.price_mode !== "per_night" ||
      (v.per_night_price != null && v.per_night_price >= 0),
    { path: ["per_night_price"], message: "Enter the per-night price." },
  )
  // ── booking deadline must precede the stay it sells ──────────────
  .refine(
    (v) =>
      !v.book_by ||
      v.date_mode !== "fixed" ||
      !v.fixed_check_in ||
      v.book_by <= v.fixed_check_in,
    { path: ["book_by"], message: "Book-by must be on or before check-in." },
  )
  // ── no required add-on listed twice ──────────────────────────────
  .refine(
    (v) => new Set(v.addons.map((a) => a.addon_id)).size === v.addons.length,
    { path: ["addons"], message: "An add-on is listed twice." },
  )
  // ── fixed-date specials can only have quantity = 1 ───────────────
  // (only one booking possible for those exact dates on that room/property)
  .refine((v) => v.date_mode !== "fixed" || v.quantity === 1, {
    path: ["quantity"],
    message:
      "Fixed-date deals can only sell 1 (the room is booked for those exact dates).",
  });

export type SpecialInput = z.infer<typeof specialInputSchema>;
