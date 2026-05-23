import { z } from "zod";

const propertyShape = {
  listing_type: z.enum(["accommodation", "experience"], {
    message: "Pick a type.",
  }),
  accommodation_type: z
    .enum(["hotel", "guesthouse", "bb", "self_catering", "lodge", "other"])
    .optional(),
  experience_type: z
    .enum(["tour", "activity", "workshop", "transfer", "other"])
    .optional(),
};

export const newListingSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Listing name is too short.")
      .max(200, "Listing name is too long."),
    ...propertyShape,
  })
  .refine((d) => d.listing_type !== "accommodation" || !!d.accommodation_type, {
    path: ["accommodation_type"],
    message: "Pick an accommodation type.",
  })
  .refine((d) => d.listing_type !== "experience" || !!d.experience_type, {
    path: ["experience_type"],
    message: "Pick an experience type.",
  });

export type NewListingInput = z.infer<typeof newListingSchema>;
