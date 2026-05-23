import { z } from "zod";

export const ACCOMMODATION_TYPES = [
  { value: "self_catering", label: "Self-catering cottage" },
  { value: "bb", label: "B&B" },
  { value: "guesthouse", label: "Guesthouse" },
  { value: "lodge", label: "Lodge" },
  { value: "hotel", label: "Hotel" },
  { value: "other", label: "Other" },
] as const;

export const EXPERIENCE_TYPES = [
  { value: "tour", label: "Tour" },
  { value: "activity", label: "Activity" },
  { value: "workshop", label: "Workshop" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
] as const;

export const PLANS = [
  {
    value: "free",
    name: "Free",
    tagline: "Get started — list 1 property in the Vilo Directory.",
    price: "R 0",
    cadence: "/month",
    available: true,
  },
  {
    value: "pro",
    name: "Pro",
    tagline: "Up to 5 listings, full direct booking, iCal sync.",
    price: "R 499",
    cadence: "/month",
    available: false,
  },
  {
    value: "business",
    name: "Business",
    tagline: "Unlimited listings, staff seats, priority support.",
    price: "R 1 199",
    cadence: "/month",
    available: false,
  },
] as const;

export const personalDetailsSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(120, "Name is too long."),
  phone: z
    .string()
    .trim()
    .max(40, "Phone number is too long.")
    .optional()
    .or(z.literal("")),
});
export type PersonalDetailsInput = z.infer<typeof personalDetailsSchema>;

const propertyTypeShape = {
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

export const propertyTypeSchema = z
  .object(propertyTypeShape)
  .refine((d) => d.listing_type !== "accommodation" || !!d.accommodation_type, {
    path: ["accommodation_type"],
    message: "Pick an accommodation type.",
  })
  .refine((d) => d.listing_type !== "experience" || !!d.experience_type, {
    path: ["experience_type"],
    message: "Pick an experience type.",
  });
export type PropertyTypeInput = z.infer<typeof propertyTypeSchema>;

export const firstListingSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Enter the name guests will see.")
    .max(120, "Display name is too long."),
  name: z
    .string()
    .trim()
    .min(3, "Listing name is too short.")
    .max(200, "Listing name is too long."),
  description: z
    .string()
    .trim()
    .max(2000, "Description is too long.")
    .optional()
    .or(z.literal("")),
});
export type FirstListingInput = z.infer<typeof firstListingSchema>;

export const planSchema = z.object({
  plan: z.enum(["free", "basic", "pro", "business"]),
});
export type PlanInput = z.infer<typeof planSchema>;

// What the Server Action receives once the wizard is complete.
// Combines all step shapes and re-applies the listing-type cross-field rules.
export const onboardingSchema = z
  .object({
    ...personalDetailsSchema.shape,
    ...propertyTypeShape,
    ...firstListingSchema.shape,
    ...planSchema.shape,
  })
  .refine((d) => d.listing_type !== "accommodation" || !!d.accommodation_type, {
    path: ["accommodation_type"],
    message: "Pick an accommodation type.",
  })
  .refine((d) => d.listing_type !== "experience" || !!d.experience_type, {
    path: ["experience_type"],
    message: "Pick an experience type.",
  });
export type OnboardingInput = z.infer<typeof onboardingSchema>;
