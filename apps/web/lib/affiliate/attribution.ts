import "server-only";

import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Affiliate attribution.
 *
 * The /r/<slug> route handler drops a first-party `vilo_ref` cookie holding the
 * affiliate id + click id. When the visitor later creates ANY account (guest
 * signup, host signup, or a minted lead via an enquiry) we bind them — exactly
 * once, forever — to that affiliate via affiliate_referrals.
 *
 * The binding is keyed on the USER (user_profiles.id), not the host, because
 * commission accrual matches platform_ledger.user_id. This survives the
 * guest→host transition: a referred guest who later becomes a host and pays for
 * a Wielo product still earns their referrer commission.
 *
 * Binding is best-effort: it MUST NEVER throw into a signup flow. UNIQUE
 * (referred_user_id) makes it idempotent — a second attempt is a silent no-op.
 */

export const REF_COOKIE = "vilo_ref";

type RefPayload = {
  aff?: string;
  slug?: string;
  ts?: number;
  click?: string | null;
};

function readRefPayload(): RefPayload | null {
  try {
    const raw = cookies().get(REF_COOKIE)?.value;
    if (!raw) return null;
    return JSON.parse(raw) as RefPayload;
  } catch {
    return null;
  }
}

function clearRefCookie(): void {
  try {
    cookies().delete(REF_COOKIE);
  } catch {
    // Read-only context (e.g. a Server Component) — ignore.
  }
}

/**
 * Bind a freshly-created user to the affiliate in their `vilo_ref` cookie.
 * No-op when there is no cookie, the affiliate is unknown/suspended, the cookie
 * has expired, or it would be a self-referral. Always clears the cookie when it
 * has been consumed (or found invalid).
 */
export async function bindAffiliateReferral(
  referredUserId: string,
  referredHostId?: string | null,
): Promise<void> {
  try {
    const payload = readRefPayload();
    const affiliateId = payload?.aff;
    if (!affiliateId) {
      if (payload) clearRefCookie();
      return;
    }

    const admin = createAdminClient();

    const { data: settings } = await admin
      .from("affiliate_settings")
      .select("cookie_days, self_referral_blocked")
      .eq("id", true)
      .maybeSingle();
    const cookieDays = settings?.cookie_days ?? 30;
    const selfBlocked = settings?.self_referral_blocked ?? true;

    // Expired cookie → drop it.
    if (payload?.ts && Date.now() - payload.ts > cookieDays * 86_400_000) {
      clearRefCookie();
      return;
    }

    const { data: aff } = await admin
      .from("affiliate_accounts")
      .select("id, user_id, status")
      .eq("id", affiliateId)
      .maybeSingle();
    if (!aff || aff.status !== "active") {
      clearRefCookie();
      return;
    }

    // Self-referral guard.
    if (selfBlocked && aff.user_id === referredUserId) {
      clearRefCookie();
      return;
    }

    // Bind once. UNIQUE(referred_user_id) makes a repeat a no-op (error 23505);
    // we ignore the error rather than surface it.
    await admin.from("affiliate_referrals").insert({
      affiliate_id: aff.id,
      referred_user_id: referredUserId,
      referred_host_id: referredHostId ?? null,
      click_id: payload?.click ?? null,
      source: "signup",
    });

    clearRefCookie();
  } catch {
    // Attribution is never allowed to break account creation.
  }
}
