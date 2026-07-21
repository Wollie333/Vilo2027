import { z } from "zod";

import { passwordSchema } from "@/lib/auth/password";
import { nameFields } from "@/lib/profile/name";

// Partner (affiliate) signup. Mirrors the guest account schema — passwordless by
// default, optional password fallback — plus the TWO consents an affiliate must
// give before they can be activated:
//   • `terms`     — the platform terms every Wielo account agrees to,
//   • `agreement` — the affiliate agreement itself (snapshotted + hashed on
//     submit, per WS-6b), which is what actually makes them a partner.
// They are deliberately separate booleans: one checkbox covering both would make
// the signed agreement snapshot unprovable as a distinct act of consent.
export const partnerSignupSchema = z.object({
  ...nameFields,
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z
    .string()
    .optional()
    .superRefine((v, ctx) => {
      if (!v) return; // passwordless — nothing to validate
      const r = passwordSchema.safeParse(v);
      if (!r.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: r.error.issues[0]?.message ?? "That password is too weak.",
        });
      }
    }),
  // Optional community context — the leaderboard renders these, and asking here
  // saves the partner a second trip to their profile.
  community_name: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  terms: z.boolean().refine((v) => v === true, {
    message: "Please accept the platform terms to continue.",
  }),
  agreement: z.boolean().refine((v) => v === true, {
    message: "Please accept the affiliate agreement to continue.",
  }),
  // Campaign rules — required only when the campaign publishes some. The action
  // re-checks server-side; a forged `false` cannot skip a real rules doc.
  campaign_rules: z.boolean().optional(),
  campaign_slug: z.string().trim().max(120).optional(),
});
export type PartnerSignupInput = z.infer<typeof partnerSignupSchema>;
