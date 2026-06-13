import { z } from "zod";

// Host → guest reputation. One required overall star + summary, five optional
// dimension scores each with an optional short note. Co-located per convention.
// The five dimensions are the single source of truth for both the form and the
// data layer — keep this list and guest_ratings columns in lockstep.
export const RATING_DIMENSIONS = [
  "payments",
  "communication",
  "cleanliness",
  "house_rules",
  "integrity",
] as const;

export type RatingDimension = (typeof RATING_DIMENSIONS)[number];

const dimensionScore = z.number().int().min(1).max(5).nullable().optional();

const dimensionNote = z.string().trim().max(300).nullable().optional();

export const guestRatingSchema = z.object({
  rating: z.number().int().min(1, "Pick an overall rating.").max(5),
  summary: z.string().trim().max(1500).nullable().optional(),

  rating_payments: dimensionScore,
  rating_communication: dimensionScore,
  rating_cleanliness: dimensionScore,
  rating_house_rules: dimensionScore,
  rating_integrity: dimensionScore,

  note_payments: dimensionNote,
  note_communication: dimensionNote,
  note_cleanliness: dimensionNote,
  note_house_rules: dimensionNote,
  note_integrity: dimensionNote,
});

export type GuestRatingInput = z.infer<typeof guestRatingSchema>;
