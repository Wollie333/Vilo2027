"use server";

import { z } from "zod";

import { markEmailVerified } from "@/lib/auth/verifyEmail";
import { createServerClient } from "@/lib/supabase/server";

const schema = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
});

export type ClaimResult = { ok: true } | { ok: false; error: string };

// Sets a password on the currently signed-in lead (they arrived via the magic
// link in their enquiry email, so email ownership is proven) and flips
// user_profiles.is_lead → false, turning the lead into a full account.
export async function claimGuestAccountAction(input: {
  password: string;
}): Promise<ClaimResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the password.",
    };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your sign-in link expired — request a new one from your email.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: "Could not set your password. Try again." };
  }

  await supabase
    .from("user_profiles")
    .update({ is_lead: false })
    .eq("id", user.id);

  // Setting a password from the emailed sign-in link proves inbox ownership —
  // confirm their email too (best-effort). See resetPasswordAction.
  await markEmailVerified(user.id);

  return { ok: true };
}
