import { ShieldCheck } from "lucide-react";

import { hasVerifiedFactor } from "@/lib/auth/mfa";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { TwoFactorNudgeBar } from "./TwoFactorNudgeBar";

/**
 * The "turn on two-factor" suggestion — shown to HOSTS and STAFF only.
 *
 * 2FA is optional for everyone, so this is a recommendation and never a wall.
 * It is aimed where the consequences are worst: a host account holds booking
 * money, payout details and guest personal data. Guests can find the same
 * setting in their own settings without being nagged about it.
 *
 * Renders nothing once 2FA is on, or once dismissed — a suggestion that keeps
 * reappearing after you have answered it is just noise, and noise is what
 * teaches people to ignore security prompts.
 */
export async function TwoFactorNudge() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("mfa_prompt_dismissed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.mfa_prompt_dismissed_at) return null;

  if (await hasVerifiedFactor(user.id)) return null;

  return (
    <TwoFactorNudgeBar
      icon={<ShieldCheck className="h-4 w-4 shrink-0 text-brand-primary" />}
    />
  );
}
