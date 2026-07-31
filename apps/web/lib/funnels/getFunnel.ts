import { createAdminClient } from "@/lib/supabase/admin";

// Server-side funnel loader for the public /go/<slug> pages. Reads via the
// service-role client (funnel tables are super-admin-only under RLS), so these
// pages must stay server components. Returns null when the slug is unknown or
// the funnel is inactive.

export type PublicFunnel = {
  id: string;
  audience: "host" | "affiliate";
  slug: string;
  name: string;
  headline: string | null;
  subcopy: string | null;
  brochure_path: string | null;
  brochure_name: string | null;
  video_url: string | null;
};

export async function getFunnelBySlug(
  slug: string,
): Promise<PublicFunnel | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("funnels")
    .select(
      "id, audience, slug, name, headline, subcopy, brochure_path, brochure_name, video_url, is_active",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return data as PublicFunnel;
}

/** Public URL for a brochure object in the public funnel-assets bucket. */
export function funnelBrochureUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/funnel-assets/${path}`;
}
