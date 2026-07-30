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
  camp?: string; // campaign id (WS-1.2) — tags the referral to a campaign
  campSlug?: string;
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
 * Resolve a partner code (the affiliate's slug) typed into the "Referred by"
 * field, for a manual/fallback bind. Returns the affiliate id, or null when the
 * code matches no active partner.
 */
async function resolveManualCode(
  admin: ReturnType<typeof createAdminClient>,
  code: string,
): Promise<string | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const { data } = await admin
    .from("affiliate_accounts")
    .select("id")
    .ilike("slug", trimmed)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * The partner in the visitor's `vilo_ref` cookie, for prefilling the signup
 * "Referred by" field. null when there is no (valid) cookie. Read-only.
 */
export async function getReferredByPrefill(): Promise<{
  slug: string;
  name: string;
} | null> {
  try {
    const payload = readRefPayload();
    if (!payload?.aff) return null;
    const admin = createAdminClient();
    const { data } = await admin
      .from("affiliate_accounts")
      .select("slug, user:user_profiles!user_id ( full_name )")
      .eq("id", payload.aff)
      .maybeSingle();
    if (!data) return null;
    const u = Array.isArray(data.user) ? data.user[0] : data.user;
    const name =
      (u?.full_name as string | null)?.trim() || (data.slug as string);
    return { slug: data.slug as string, name };
  } catch {
    return null;
  }
}

/**
 * Bind a freshly-created user to the affiliate in their `vilo_ref` cookie, or —
 * when there is no cookie — to a partner code typed into the "Referred by" field
 * (SoT §3.2 rule 6). The cookie always wins (first-touch, and it carries the
 * competition rate); a manual code only applies when the cookie yielded nothing,
 * and binds on the DEFAULT programme (no competition — a typed code is not a
 * competition click). No-op when the partner is unknown/suspended, the cookie has
 * expired with no code, or it would be a self-referral. Always clears the cookie
 * when consumed.
 */
export async function bindAffiliateReferral(
  referredUserId: string,
  referredHostId?: string | null,
  manualCode?: string | null,
): Promise<void> {
  try {
    const payload = readRefPayload();
    const admin = createAdminClient();

    const { data: settings } = await admin
      .from("affiliate_settings")
      .select("cookie_days, self_referral_blocked")
      .eq("id", true)
      .maybeSingle();
    const cookieDays = settings?.cookie_days ?? 30;
    const selfBlocked = settings?.self_referral_blocked ?? true;

    // A cookie past its window no longer attributes — but a typed code still can.
    const cookieExpired = Boolean(
      payload?.ts && Date.now() - payload.ts > cookieDays * 86_400_000,
    );
    const cookieAff = !cookieExpired ? (payload?.aff ?? null) : null;

    // Cookie wins (first-touch + carries the competition rate). Fall back to the
    // manually-entered partner code only when the cookie yielded no affiliate.
    const fromCookie = Boolean(cookieAff);
    const affiliateId =
      cookieAff ??
      (manualCode ? await resolveManualCode(admin, manualCode) : null);

    if (!affiliateId) {
      if (payload) clearRefCookie();
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

    // Competition rate resolution (SoT §3.2 rule 2, §10.4). The rate is taken at
    // CLICK, not signup: the /r/<slug> handler captured the competition's
    // commission_structure into the SERVER-SIDE affiliate_clicks row. We read it
    // back here via the cookie's click id — server-trusted, so it is fixed at
    // click and cannot be forged via the cookie — and stamp it onto the referral
    // as commission_snapshot. The accrual resolver reads that snapshot (not the
    // live campaign), so the rate survives the competition ending and any later
    // edit. There is deliberately NO "campaign still active at bind" gate: a host
    // who clicked during the Race but signs up after it closes still gets the
    // competition rate. Original binding always wins: UNIQUE(referred_user_id)
    // makes a repeat a no-op (rules 1 & 3, first-touch-wins).
    // Competition rate applies only via a real competition CLICK (the cookie
    // path). A manually-typed code is not a competition entry → default rate.
    let campaignId: string | null = null;
    let commissionSnapshot: unknown = null;
    if (fromCookie && payload?.click) {
      const { data: click } = await admin
        .from("affiliate_clicks")
        .select("campaign_id, commission_snapshot")
        .eq("id", payload.click)
        .maybeSingle();
      if (click?.campaign_id) {
        campaignId = click.campaign_id;
        commissionSnapshot = click.commission_snapshot ?? null;
      }
    }
    // Fallback when the click row is missing (e.g. click logging failed): the
    // cookie carried `camp` only because the competition was valid at click, so
    // re-resolve the structure from the campaign — still no status gate.
    if (fromCookie && !campaignId && payload?.camp) {
      const { data: camp } = await admin
        .from("affiliate_campaigns")
        .select("id, commission_structure")
        .eq("id", payload.camp)
        .maybeSingle();
      if (camp) {
        campaignId = camp.id;
        commissionSnapshot = camp.commission_structure ?? null;
      }
    }

    // Bind once. UNIQUE(referred_user_id) makes a repeat a no-op (error 23505);
    // we ignore the error rather than surface it.
    await admin.from("affiliate_referrals").insert({
      affiliate_id: aff.id,
      referred_user_id: referredUserId,
      referred_host_id: referredHostId ?? null,
      click_id: fromCookie ? (payload?.click ?? null) : null,
      campaign_id: campaignId,
      commission_snapshot: commissionSnapshot,
      source: fromCookie ? "signup" : "manual_code",
    });

    clearRefCookie();
  } catch {
    // Attribution is never allowed to break account creation.
  }
}
