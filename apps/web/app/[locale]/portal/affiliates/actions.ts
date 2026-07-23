"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  findFreeSlug,
  getAffiliateForUser,
  isValidSlug,
} from "@/lib/affiliate/account";
import { recordAcceptance } from "@/lib/affiliate/agreement";
import { agreementHash, normaliseIp } from "@/lib/affiliate/agreement.crypto";
import { checkSignupRateLimit } from "@/lib/auth/rateLimit";
import { sendVerificationEmail } from "@/lib/auth/verifyEmail";
import { getPublishedLegalDocument } from "@/lib/legalDocuments";
import { renderAgreementBody } from "@/lib/affiliate/agreement.shared";
import { getBrandName } from "@/lib/brand";
import { encryptAccountNumber } from "@/lib/crypto/banking";
import { clientIpFromHeaders } from "@/lib/security/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Re-send the confirmation email for the signed-in user — the last activation
 * gate for a partner who signed up through the public form.
 *
 * Rate limited on IP: this sends mail on demand to an address we already hold,
 * so an unthrottled button is a way to bomb someone's inbox. Always reports
 * success to the caller once past the limit — whether the send itself worked is
 * not the caller's business to probe.
 */
export async function resendVerificationEmailAction(): Promise<ActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const h = headers();
  const limit = await checkSignupRateLimit(clientIpFromHeaders(h));
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many attempts — please wait a few minutes and try again.",
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email, full_name, email_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  // Already confirmed → nothing to send; the portal will activate on next open.
  if (profile?.email_verified_at) return { ok: true };

  const email = profile?.email ?? user.email;
  if (!email) return { ok: false, error: "No email address on file." };

  await sendVerificationEmail({
    userId: user.id,
    email,
    origin: h.get("origin") ?? "",
    firstName: profile?.full_name?.split(" ")[0] ?? undefined,
  });
  return { ok: true };
}

const PAYOUT_ERROR_MESSAGES: Record<string, string> = {
  not_found: "Accept the affiliate terms first.",
  suspended: "Your affiliate account is suspended.",
  bad_method: "Choose a valid payout method.",
  no_method: "Add your payout details for this method first.",
  nothing_to_pay: "You have no cleared commission to pay out yet.",
  below_threshold: "Your cleared balance is below the payout threshold.",
};

// Accept the affiliate terms → create the user's affiliate account with a
// unique referral slug (self-serve, no host required) AND record the signed
// agreement (WS-6b): an immutable snapshot of the exact body agreed to, its
// sha256, and the signing IP. Also the re-signing path — an existing partner
// who has not signed the CURRENT terms version lands here from the gate, keeps
// their account and slug, and adds a second signature.
export async function acceptAffiliateTermsAction(): Promise<
  ActionResult<{ slug: string }>
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();

  const [{ data: settings }, { data: profile }, brand] = await Promise.all([
    admin
      .from("affiliate_settings")
      .select("terms_version, terms_content, currency")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle(),
    getBrandName(),
  ]);

  const version = settings?.terms_version ?? "v1";
  const bodyText = renderAgreementBody(settings?.terms_content ?? "", brand);

  let account = await getAffiliateForUser(admin, user.id);

  if (!account) {
    const base = profile?.full_name || user.email?.split("@")[0] || "wielo";
    const slug = await findFreeSlug(admin, base);

    const { error } = await admin.from("affiliate_accounts").insert({
      user_id: user.id,
      slug,
      status: "active",
      terms_version: version,
      currency: settings?.currency ?? "ZAR",
    });
    if (error) {
      // A concurrent accept may have created it — carry on with that one.
      account = await getAffiliateForUser(admin, user.id);
      if (!account) {
        return { ok: false, error: "Could not start your affiliate account." };
      }
    } else {
      account = await getAffiliateForUser(admin, user.id);
    }
  } else if (account.terms_version !== version) {
    // Re-signature: stamp the account with the version now on file. accepted_at
    // is deliberately left alone — it is "member since", not "last signed".
    await admin
      .from("affiliate_accounts")
      .update({ terms_version: version })
      .eq("id", account.id);
  }

  if (!account) {
    return { ok: false, error: "Could not start your affiliate account." };
  }

  const h = headers();
  const signed = await recordAcceptance(admin, {
    affiliateId: account.id,
    userId: user.id,
    signatoryEmail: profile?.email ?? user.email ?? null,
    signatoryName: profile?.full_name ?? null,
    version,
    bodyText,
    ip: normaliseIp(
      h.get("cf-connecting-ip") ??
        h.get("x-forwarded-for")?.split(",")[0] ??
        h.get("x-real-ip"),
    ),
    userAgent: h.get("user-agent") ?? undefined,
  });
  if (!signed) {
    return { ok: false, error: "Could not record your agreement. Try again." };
  }

  revalidatePath("/portal/affiliates");
  revalidatePath("/dashboard/affiliates");
  return { ok: true, data: { slug: account.slug } };
}

// Customise the referral slug. 3–32 chars, lowercase alnum + dashes, unique.
export async function updateAffiliateSlugAction(
  rawSlug: string,
): Promise<ActionResult<{ slug: string }>> {
  const slug = rawSlug.trim().toLowerCase();
  if (!isValidSlug(slug)) {
    return {
      ok: false,
      error:
        "Use 3–32 characters: lowercase letters, numbers and dashes (not at the ends).",
    };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const acct = await getAffiliateForUser(admin, user.id);
  if (!acct) return { ok: false, error: "Accept the affiliate terms first." };
  if (acct.slug === slug) return { ok: true, data: { slug } };

  // Taken by someone else?
  const { data: clash } = await admin
    .from("affiliate_accounts")
    .select("id")
    .ilike("slug", slug)
    .neq("id", acct.id)
    .limit(1);
  if (clash && clash.length > 0) {
    return { ok: false, error: "That link is already taken — try another." };
  }

  const { error } = await admin
    .from("affiliate_accounts")
    .update({ slug, updated_at: new Date().toISOString() })
    .eq("id", acct.id);
  if (error) return { ok: false, error: "Could not update your link." };

  revalidatePath("/portal/affiliates");
  return { ok: true, data: { slug } };
}

// ─── Partner profile (co-branded /partners/[slug] presentation) ────────────────

const partnerProfileSchema = z.object({
  display_headline: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(400).optional().or(z.literal("")),
  photo_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  // Published on a public page, so it is validated rather than trusted: digits,
  // spaces and the usual separators only. Empty clears it, and the page then
  // shows no phone at all rather than falling back to someone else's number.
  public_phone: z
    .string()
    .trim()
    .max(24)
    .regex(/^[0-9+()\-.\s]*$/, "Use digits, spaces and + ( ) - only.")
    .optional()
    .or(z.literal("")),
});

// Save the affiliate's public presentation fields for their co-branded
// /partners/<slug> landing page. No money — presentation only. Empty strings
// clear the field (stored as NULL).
export async function updatePartnerProfileAction(
  raw: z.infer<typeof partnerProfileSchema>,
): Promise<ActionResult> {
  const parsed = partnerProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check your profile details.",
    };
  }
  const d = parsed.data;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const acct = await getAffiliateForUser(admin, user.id);
  if (!acct) return { ok: false, error: "Accept the affiliate terms first." };

  const { error } = await admin
    .from("affiliate_accounts")
    .update({
      display_headline: d.display_headline?.trim() || null,
      bio: d.bio?.trim() || null,
      photo_url: d.photo_url?.trim() || null,
      public_phone: d.public_phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", acct.id);
  if (error) return { ok: false, error: "Could not save your profile." };

  revalidatePath("/portal/affiliates");
  revalidatePath("/dashboard/affiliates");
  return { ok: true };
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

// Request a payout: hands off to the atomic create_affiliate_payout RPC, which
// claims cleared commission, applies the threshold + per-method fee, and stamps
// the rows. The RPC is the single source of truth for the money maths.
export async function requestAffiliatePayoutAction(
  method: string,
): Promise<ActionResult<{ payoutId: string; net: number }>> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const acct = await getAffiliateForUser(admin, user.id);
  if (!acct) return { ok: false, error: "Accept the affiliate terms first." };

  const { data, error } = await admin.rpc("create_affiliate_payout", {
    p_affiliate_id: acct.id,
    p_method: method,
  });
  if (error) return { ok: false, error: "Could not request the payout." };

  const res = data as {
    ok: boolean;
    error?: string;
    payout_id?: string;
    net?: number;
  };
  if (!res?.ok) {
    return {
      ok: false,
      error:
        PAYOUT_ERROR_MESSAGES[res?.error ?? ""] ??
        "Could not request the payout.",
    };
  }

  revalidatePath("/portal/affiliates/payouts");
  return { ok: true, data: { payoutId: res.payout_id!, net: res.net ?? 0 } };
}

const payoutMethodSchema = z
  .object({
    method: z.enum(["eft", "paystack", "paypal"]),
    is_default: z.boolean().optional(),
    bank_name: z.string().trim().max(120).optional(),
    account_name: z.string().trim().max(120).optional(),
    account_number: z.string().trim().max(40).optional(),
    branch_code: z.string().trim().max(20).optional(),
    paystack_recipient_code: z.string().trim().max(120).optional(),
    paypal_email: z
      .string()
      .trim()
      .email()
      .max(160)
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (d) =>
      d.method !== "eft" ||
      (!!d.bank_name && !!d.account_name && !!d.account_number),
    { message: "Bank name, account name and number are required for EFT." },
  )
  .refine((d) => d.method !== "paypal" || !!d.paypal_email, {
    message: "A PayPal email is required.",
  })
  .refine((d) => d.method !== "paystack" || !!d.paystack_recipient_code, {
    message: "A Paystack recipient code is required.",
  });

// Add or update the affiliate's payout destination for a method (one row per
// method). Marks it default if requested, clearing any previous default.
export async function savePayoutMethodAction(
  raw: z.infer<typeof payoutMethodSchema>,
): Promise<ActionResult> {
  const parsed = payoutMethodSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the payout details.",
    };
  }
  const d = parsed.data;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const acct = await getAffiliateForUser(admin, user.id);
  if (!acct) return { ok: false, error: "Accept the affiliate terms first." };

  const { data: existing } = await admin
    .from("affiliate_payout_methods")
    .select("id")
    .eq("affiliate_id", acct.id)
    .eq("method", d.method)
    .maybeSingle();

  const makeDefault = d.is_default ?? false;
  if (makeDefault) {
    await admin
      .from("affiliate_payout_methods")
      .update({ is_default: false })
      .eq("affiliate_id", acct.id);
  }

  const row = {
    affiliate_id: acct.id,
    method: d.method,
    is_default: makeDefault,
    bank_name: d.bank_name || null,
    account_name: d.account_name || null,
    // Encrypt at rest, mirroring the host banking path. encryptAccountNumber
    // returns v1.… when BANKING_CIPHER_KEY is set, plaintext otherwise; both
    // round-trip through decryptAccountNumber on read.
    account_number: d.account_number
      ? encryptAccountNumber(d.account_number)
      : null,
    branch_code: d.branch_code || null,
    paystack_recipient_code: d.paystack_recipient_code || null,
    paypal_email: d.paypal_email || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await admin
        .from("affiliate_payout_methods")
        .update(row)
        .eq("id", existing.id)
    : await admin.from("affiliate_payout_methods").insert(row);
  if (error) return { ok: false, error: "Could not save your payout details." };

  // If no default exists yet, make this one default.
  if (!makeDefault) {
    const { count } = await admin
      .from("affiliate_payout_methods")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", acct.id)
      .eq("is_default", true);
    if ((count ?? 0) === 0) {
      await admin
        .from("affiliate_payout_methods")
        .update({ is_default: true })
        .eq("affiliate_id", acct.id)
        .eq("method", d.method);
      await admin
        .from("affiliate_accounts")
        .update({ default_payout_method: d.method })
        .eq("id", acct.id);
    }
  } else {
    await admin
      .from("affiliate_accounts")
      .update({ default_payout_method: d.method })
      .eq("id", acct.id);
  }

  revalidatePath("/portal/affiliates/payouts");
  return { ok: true };
}

export async function deletePayoutMethodAction(
  methodId: string,
): Promise<ActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const acct = await getAffiliateForUser(admin, user.id);
  if (!acct) return { ok: false, error: "Accept the affiliate terms first." };

  const { error } = await admin
    .from("affiliate_payout_methods")
    .delete()
    .eq("id", methodId)
    .eq("affiliate_id", acct.id);
  if (error) return { ok: false, error: "Could not remove that method." };

  revalidatePath("/portal/affiliates/payouts");
  return { ok: true };
}

// ─── Campaigns ─────────────────────────────────────────────────────────────

// Join a campaign (opt-in). No money — records an enrollment so the campaign
// appears as "joined" and (for 'tagged'/'invite' campaigns) unlocks the campaign
// link. Idempotent: a repeat is a no-op. Only ACTIVE campaigns are joinable, and
// only if the campaign's eligibility allows self-enrollment ('all' or 'tagged';
// 'invite'-only campaigns are admin-added).
export async function enrollInCampaignAction(
  campaignId: string,
  acceptedRules?: boolean,
): Promise<ActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const acct = await getAffiliateForUser(admin, user.id);
  if (!acct) return { ok: false, error: "Accept the affiliate terms first." };
  if (acct.status !== "active") {
    return { ok: false, error: "Your affiliate account is suspended." };
  }

  const { data: campaign } = await admin
    .from("affiliate_campaigns")
    .select("id, status, eligible_partners, rules_doc_slug, max_participants")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.status !== "active") {
    return { ok: false, error: "That competition isn't open to join." };
  }
  if (campaign.eligible_partners === "invite") {
    return { ok: false, error: "This competition is invite-only." };
  }

  // Friendly capacity check. The DATABASE is the real gate (trg_campaign_capacity
  // locks the campaign row, so two simultaneous joins can't share the last
  // place) — this exists so a full competition reads as "full" instead of a
  // constraint error, and is deliberately not trusted on its own.
  if (campaign.max_participants != null) {
    const { count: taken } = await admin
      .from("affiliate_campaign_enrollments")
      .select("affiliate_id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "active")
      .neq("affiliate_id", acct.id);
    if ((taken ?? 0) >= campaign.max_participants) {
      return {
        ok: false,
        error: "This competition is full — all places have been taken.",
      };
    }
  }

  // Rules acceptance is a CONDITION OF ENTRY, enforced here and not only in the
  // UI: a campaign with a published rules document cannot be entered without a
  // signature against the version live right now (WS-1i follow-up).
  const rules = campaign.rules_doc_slug
    ? await getPublishedLegalDocument(campaign.rules_doc_slug)
    : null;
  if (rules) {
    if (!acceptedRules) {
      return {
        ok: false,
        error: "Read and accept the competition rules to enter.",
      };
    }
    const { data: profile } = await admin
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const h = headers();
    const body = rules.bodyHtml ?? "";
    const { error: signError } = await admin
      .from("affiliate_campaign_rule_acceptances")
      .insert({
        campaign_id: campaign.id,
        affiliate_id: acct.id,
        user_id: user.id,
        signatory_email: profile?.email ?? user.email ?? null,
        signatory_name: profile?.full_name ?? null,
        doc_slug: rules.slug,
        doc_version: rules.version,
        body_snapshot: body,
        body_sha256: agreementHash(body),
        ip:
          normaliseIp(
            h.get("cf-connecting-ip") ??
              h.get("x-forwarded-for")?.split(",")[0] ??
              h.get("x-real-ip"),
          ) ?? null,
        user_agent: h.get("user-agent")?.slice(0, 500) ?? null,
      });
    // 23505 = already signed this version — that IS the success state.
    if (signError && signError.code !== "23505") {
      return { ok: false, error: "Could not record your acceptance." };
    }
  }

  // Idempotent: unique (affiliate_id, campaign_id) makes a repeat a no-op.
  const { error } = await admin
    .from("affiliate_campaign_enrollments")
    .upsert(
      { affiliate_id: acct.id, campaign_id: campaign.id, status: "active" },
      { onConflict: "affiliate_id,campaign_id", ignoreDuplicates: true },
    );
  if (error) {
    // The capacity trigger raises check_violation when the last place went to
    // someone else between the check above and this insert.
    if (/campaign_full/.test(error.message)) {
      return {
        ok: false,
        error: "This competition just filled up — the last place has gone.",
      };
    }
    return { ok: false, error: "Could not join the competition." };
  }

  revalidatePath("/portal/affiliates/competitions");
  revalidatePath("/dashboard/affiliates/competitions");
  return { ok: true };
}

// Set the affiliate's personal payout threshold (must be >= the platform floor).
export async function setPayoutThresholdAction(
  amount: number,
): Promise<ActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const acct = await getAffiliateForUser(admin, user.id);
  if (!acct) return { ok: false, error: "Accept the affiliate terms first." };

  const { data: settings } = await admin
    .from("affiliate_settings")
    .select("min_payout_threshold")
    .eq("id", true)
    .maybeSingle();
  const floor = Number(settings?.min_payout_threshold ?? 0);
  const value = Math.max(floor, Math.round(Number(amount) || 0));

  const { error } = await admin
    .from("affiliate_accounts")
    .update({ payout_threshold: value, updated_at: new Date().toISOString() })
    .eq("id", acct.id);
  if (error) return { ok: false, error: "Could not update your threshold." };

  revalidatePath("/portal/affiliates/payouts");
  return { ok: true, data: undefined };
}
