import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// The pipeline capture funnels an affiliate can share as "resources" — ready-made
// lead-magnet landing pages (/go/<slug>) designed to capture a host's info. See
// lib/affiliate/links.funnelResourceLink for the attributed link that wraps each.

export type ShareableFunnel = {
  slug: string;
  name: string;
  headline: string | null;
  subcopy: string | null;
};

/**
 * HOST-audience funnels only, active only. A host-referral programme/competition
 * scores when a referred HOST goes live, so only host capture pages are shareable
 * resources — the affiliate-RECRUITMENT funnel (/go/affiliate) is a different
 * motion and is deliberately excluded. Ordered by name for a stable list.
 */
export async function listShareableFunnels(): Promise<ShareableFunnel[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("funnels")
    .select("slug, name, headline, subcopy, audience, is_active")
    .eq("audience", "host")
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((f) => ({
    slug: f.slug as string,
    name: f.name as string,
    headline: (f.headline as string | null) ?? null,
    subcopy: (f.subcopy as string | null) ?? null,
  }));
}
