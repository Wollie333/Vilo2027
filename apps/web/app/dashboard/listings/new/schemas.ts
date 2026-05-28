import { z } from "zod";

export const newListingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Listing name is too short.")
    .max(200, "Listing name is too long."),
  listing_type: z.enum(["accommodation", "experience"], {
    message: "Pick a type.",
  }),
  category_id: z.string().uuid({ message: "Pick a category." }),
  // Legacy text columns — mirrored from the chosen leaf slug.
  accommodation_type: z.string().optional(),
  experience_type: z.string().optional(),
});

export type NewListingInput = z.infer<typeof newListingSchema>;
