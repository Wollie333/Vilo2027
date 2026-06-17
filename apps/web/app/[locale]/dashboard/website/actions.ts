"use server";

import { revalidatePath } from "next/cache";

import { requireHost } from "@/lib/host/current";
import { createServerClient } from "@/lib/supabase/server";
import { validateSubdomain } from "@/lib/website/subdomain";

import { createWebsiteSchema, type CreateWebsiteInput } from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const uuid = () => crypto.randomUUID();

// Starter content for a freshly created site — a sensible home + about so the
// owner sees a real page immediately. Auto-populate sections (rooms/reviews/
// location) carry config only and fill from the linked properties at render.
function starterHomeSections(siteName: string) {
  return [
    {
      id: uuid(),
      type: "hero",
      enabled: true,
      props: {
        headline: siteName,
        subheadline: "Book your stay with us directly.",
        align: "center",
      },
    },
    {
      id: uuid(),
      type: "intro",
      enabled: true,
      props: {
        heading: "Welcome",
        body: "Tell guests what makes your place special — the setting, the welcome, the little touches they’ll remember.",
      },
    },
    {
      id: uuid(),
      type: "rooms_preview",
      enabled: true,
      props: { heading: "Rooms & rates", max: 6 },
    },
    {
      id: uuid(),
      type: "reviews",
      enabled: true,
      props: { heading: "What guests say", max: 6 },
    },
    {
      id: uuid(),
      type: "location",
      enabled: true,
      props: { heading: "Where you’ll be", show_map: true },
    },
    {
      id: uuid(),
      type: "cta",
      enabled: true,
      props: {
        heading: "Ready to book?",
        body: "Reserve your dates directly — no booking fees.",
        button_label: "Check availability",
        button_href: "#rooms",
      },
    },
  ];
}

function starterAboutSections(siteName: string) {
  return [
    {
      id: uuid(),
      type: "intro",
      enabled: true,
      props: {
        heading: `About ${siteName}`,
        body: "Share your story — who you are, why you host, and what guests can expect.",
      },
    },
    {
      id: uuid(),
      type: "host_bio",
      enabled: true,
      props: {
        heading: "Your host",
        body: "A few warm lines about you and your team.",
      },
    },
  ];
}

/**
 * Create a website for one of the host's businesses + seed a home/about page and
 * sync the business's properties + rooms as the initial channel membership.
 */
export async function createWebsiteAction(
  input: CreateWebsiteInput,
): Promise<CreateResult> {
  const parsed = createWebsiteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { businessId, subdomain } = parsed.data;

  const subErr = validateSubdomain(subdomain);
  if (subErr) return { ok: false, error: subErr };

  const host = await requireHost();
  if (!host.ok) return host;

  const supabase = createServerClient();

  // Ownership + one-site-per-business invariant.
  const { data: business } = await supabase
    .from("businesses")
    .select("id, trading_name")
    .eq("id", businessId)
    .eq("host_id", host.hostId)
    .maybeSingle();
  if (!business) return { ok: false, error: "business_not_found" };

  const { data: existing } = await supabase
    .from("host_websites")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existing) return { ok: false, error: "already_exists" };

  // Subdomain must be globally unique.
  const { data: taken } = await supabase
    .from("host_websites")
    .select("id")
    .eq("subdomain", subdomain)
    .maybeSingle();
  if (taken) return { ok: false, error: "subdomain_taken" };

  const siteName = business.trading_name?.trim() || subdomain;

  const { data: site, error: insErr } = await supabase
    .from("host_websites")
    .insert({
      business_id: businessId,
      host_id: host.hostId,
      subdomain,
      status: "draft",
      brand: { name: siteName },
      theme: { preset: "classic" },
    })
    .select("id")
    .single();
  if (insErr || !site) return { ok: false, error: "create_failed" };

  // Seed pages (home + about).
  await supabase.from("website_pages").insert([
    {
      website_id: site.id,
      kind: "home",
      slug: "home",
      title: siteName,
      nav_label: "Home",
      nav_order: 0,
      show_in_nav: true,
      draft_sections: starterHomeSections(siteName),
      published_sections: [],
    },
    {
      website_id: site.id,
      kind: "about",
      slug: "about",
      title: "About",
      nav_label: "About",
      nav_order: 1,
      show_in_nav: true,
      draft_sections: starterAboutSections(siteName),
      published_sections: [],
    },
  ]);

  // Sync the business's properties + rooms as the initial (visible) channel set.
  const { data: props } = await supabase
    .from("properties")
    .select("id")
    .eq("business_id", businessId)
    .is("deleted_at", null);
  const propertyIds = (props ?? []).map((p) => p.id);
  if (propertyIds.length > 0) {
    await supabase.from("website_properties").insert(
      propertyIds.map((property_id, i) => ({
        website_id: site.id,
        property_id,
        is_visible: true,
        sort_order: i,
      })),
    );
    const { data: rooms } = await supabase
      .from("property_rooms")
      .select("id")
      .in("property_id", propertyIds)
      .is("deleted_at", null);
    const roomIds = (rooms ?? []).map((r) => r.id);
    if (roomIds.length > 0) {
      await supabase.from("website_rooms").insert(
        roomIds.map((room_id, i) => ({
          website_id: site.id,
          room_id,
          is_visible: true,
          sort_order: i,
        })),
      );
    }
  }

  revalidatePath("/dashboard/website");
  return { ok: true, id: site.id };
}
