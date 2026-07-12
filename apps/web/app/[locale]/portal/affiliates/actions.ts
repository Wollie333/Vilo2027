"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  findFreeSlug,
  getAffiliateForUser,
  isValidSlug,
} from "@/lib/affiliate/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const PAYOUT_ERROR_MESSAGES: Record<string, string> = {
  not_found: "Accept the affiliate terms first.",
  suspended: "Your affiliate account is suspended.",
  bad_method: "Choose a valid payout method.",
  no_method: "Add your payout details for this method first.",
  nothing_to_pay: "You have no cleared commission to pay out yet.",
  below_threshold: "Your cleared balance is below the payout threshold.",
};

// Accept the affiliate terms → create (or no-op return) the user's affiliate
// account with a unique referral slug. Self-serve, no host required.
export async function acceptAffiliateTermsAction(): Promise<
  ActionResult<{ slug: string }>
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();

  const existing = await getAffiliateForUser(admin, user.id);
  if (existing) return { ok: true, data: { slug: existing.slug } };

  const [{ data: settings }, { data: profile }] = await Promise.all([
    admin
      .from("affiliate_settings")
      .select("terms_version, currency")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const base = profile?.full_name || user.email?.split("@")[0] || "wielo";
  const slug = await findFreeSlug(admin, base);

  const { error } = await admin.from("affiliate_accounts").insert({
    user_id: user.id,
    slug,
    status: "active",
    terms_version: settings?.terms_version ?? "v1",
    currency: settings?.currency ?? "ZAR",
  });
  if (error) {
    // A concurrent accept may have created it — return that one.
    const created = await getAffiliateForUser(admin, user.id);
    if (created) return { ok: true, data: { slug: created.slug } };
    return { ok: false, error: "Could not start your affiliate account." };
  }

  revalidatePath("/portal/affiliates");
  return { ok: true, data: { slug } };
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
    account_number: d.account_number || null,
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
