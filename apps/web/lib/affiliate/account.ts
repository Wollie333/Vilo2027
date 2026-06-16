import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// Affiliate account resolution + slug helpers. The affiliate identity is the
// USER (user_profiles.id) — a guest account is the only prerequisite.

type Db = ReturnType<typeof createAdminClient>;

export type AffiliateAccount = {
  id: string;
  user_id: string;
  slug: string;
  status: "active" | "suspended";
  terms_version: string;
  accepted_at: string;
  payout_threshold: number | null;
  currency: string;
  default_payout_method: "eft" | "paystack" | "paypal" | null;
};

const ACCOUNT_COLS =
  "id, user_id, slug, status, terms_version, accepted_at, payout_threshold, currency, default_payout_method";

export async function getAffiliateForUser(
  admin: Db,
  userId: string,
): Promise<AffiliateAccount | null> {
  const { data } = await admin
    .from("affiliate_accounts")
    .select(ACCOUNT_COLS)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as AffiliateAccount | null) ?? null;
}

/** Slugify a display name into a referral-code base (a-z0-9 + dashes). */
export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "vilo";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

/** Validate a user-chosen slug: 3–32 chars, lowercase alnum + single dashes. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(slug);
}

/**
 * Find a slug not already taken (case-insensitive). Tries the base, then the
 * base with random suffixes. `excludeId` lets an affiliate keep their own slug
 * when editing.
 */
export async function findFreeSlug(
  admin: Db,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugifyName(base);
  const candidates = [
    root,
    `${root}-${randomSuffix()}`,
    `${root}-${randomSuffix()}`,
  ];
  for (const cand of candidates) {
    let q = admin
      .from("affiliate_accounts")
      .select("id")
      .ilike("slug", cand)
      .limit(1);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q;
    if (!data || data.length === 0) return cand;
  }
  // Extremely unlikely fall-through: timestamp-tail guarantees uniqueness.
  return `${root}-${Date.now().toString(36).slice(-5)}`;
}
