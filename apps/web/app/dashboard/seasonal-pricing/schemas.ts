import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

export const seasonalRuleInputSchema = z
  .object({
    listing_id: z.string().uuid(),
    room_id: z.string().uuid().nullable(),
    label: z.string().trim().min(1, "Add a label.").max(80),
    start_date: isoDate,
    end_date: isoDate,
    price: z.number().positive("Price must be greater than 0.").max(1_000_000),
    currency: z.string().trim().length(3).default("ZAR"),
    min_nights: z
      .number()
      .int()
      .min(1, "Min nights must be 1 or more.")
      .max(365)
      .nullable(),
    priority: z.number().int().min(0).max(1000).default(0),
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "End date must be on or after start date.",
  });

export type SeasonalRuleInput = z.infer<typeof seasonalRuleInputSchema>;

export function nightsBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  // end_date is inclusive in the seasonal rule, so a 1-day range = 1 night.
  return Math.round((e - s) / 86_400_000) + 1;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
