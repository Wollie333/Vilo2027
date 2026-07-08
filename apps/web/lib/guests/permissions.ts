import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase/admin";

// Guest-side permission catalog — the guest equivalent of the host
// CANONICAL_PRODUCT_FEATURES. Guests have no subscription/product, so these are
// GLOBAL: one on/off set applies to every guest, stored in platform_settings
// under the `guest_permissions` key ({ [key]: boolean }). The admin toggles them
// in Feature permissions → Guests. Missing/unset defaults to ALLOW, so guest
// actions stay open unless an admin deliberately turns one off (fail-open — a
// guest capability is low-risk vs a paid host feature).

export type GuestPermission = {
  key: string;
  label: string;
  description: string;
};

export const CANONICAL_GUEST_PERMISSIONS: GuestPermission[] = [
  {
    key: "looking_for_post",
    label: "Post Looking-For requests",
    description: "Guests can post accommodation requests for hosts to quote.",
  },
  {
    key: "request_quotes",
    label: "Request quotes",
    description: "Guests can request a quote from a host on a listing or deal.",
  },
  {
    key: "save_bookmarks",
    label: "Save searches & bookmarks",
    description: "Guests can save listings, deals and Looking-For requests.",
  },
  {
    key: "message_hosts",
    label: "Message hosts",
    description: "Guests can start conversations with hosts.",
  },
  {
    key: "write_reviews",
    label: "Write reviews",
    description: "Guests can leave a review after a completed stay.",
  },
  {
    key: "guest_referrals",
    label: "Refer friends (affiliate)",
    description: "Guests can join the referral programme and share their link.",
  },
];

export const GUEST_PERMISSION_SETTING_KEY = "guest_permissions";

// The stored global guest permission map, merged over the catalog defaults (all
// ON). Cached per request. Reads platform_settings via the admin client.
export const getGuestPermissions = cache(
  async (): Promise<Record<string, boolean>> => {
    const out: Record<string, boolean> = {};
    for (const p of CANONICAL_GUEST_PERMISSIONS) out[p.key] = true;
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", GUEST_PERMISSION_SETTING_KEY)
        .maybeSingle();
      const stored = (data?.value ?? {}) as Record<string, unknown>;
      for (const p of CANONICAL_GUEST_PERMISSIONS) {
        const v = stored[p.key];
        if (typeof v === "boolean") out[p.key] = v;
      }
    } catch {
      /* fall back to defaults (all on) */
    }
    return out;
  },
);

/**
 * SSOT gate for a single guest capability. Global (applies to every guest).
 * Defaults to allow when unset. Server-only; call at both the action + UI layer.
 */
export async function guestCan(key: string): Promise<boolean> {
  const perms = await getGuestPermissions();
  return perms[key] ?? true;
}
