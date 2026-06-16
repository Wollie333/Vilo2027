"use server";

import { revalidatePath } from "next/cache";

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

  const base = profile?.full_name || user.email?.split("@")[0] || "vilo";
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
