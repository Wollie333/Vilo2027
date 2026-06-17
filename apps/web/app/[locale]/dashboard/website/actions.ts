"use server";

import { revalidatePath } from "next/cache";

import { requireHost } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { validateSubdomain } from "@/lib/website/subdomain";

import {
  brandSchema,
  createWebsiteSchema,
  themeSchema,
  type BrandInput,
  type CreateWebsiteInput,
  type ThemeInput,
} from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Pre-MVP: every website/CMS feature is open on every plan so the founder can
// smoke-test (AGENT_RULES.md §3.4). Restore check_feature_permission before
// Phase 3 — the plan_features rows + product wiring are already in place.
async function assertWebsiteFeature(): Promise<boolean> {
  return true;
}

/**
 * Resolve a website owned by the signed-in host. Returns the admin client (for
 * Storage signing) alongside the owner-checked server client + the host id.
 */
async function assertWebsiteOwnership(
  websiteId: string,
): Promise<
  { ok: true; hostId: string; subdomain: string } | { ok: false; error: string }
> {
  const host = await requireHost();
  if (!host.ok) return { ok: false, error: "not_authorized" };
  const supabase = createServerClient();
  const { data: site } = await supabase
    .from("host_websites")
    .select("id, subdomain")
    .eq("id", websiteId)
    .eq("host_id", host.hostId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!site) return { ok: false, error: "not_found" };
  return { ok: true, hostId: host.hostId, subdomain: site.subdomain };
}
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

// ============================================================
// W7 — Brand & Theme
// ============================================================

/** Patch the `brand`/`theme` jsonb on a website, merging over what's stored. */
async function patchSiteJson(
  websiteId: string,
  column: "brand" | "theme",
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("brand, theme")
    .eq("id", websiteId)
    .maybeSingle();
  const current = (row?.[column] ?? {}) as Record<string, unknown>;
  const merged = { ...current, ...patch };
  const { error } = await supabase
    .from("host_websites")
    .update(column === "brand" ? { brand: merged } : { theme: merged })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };
  return { ok: true };
}

/** Save the site name + tagline (logo is handled by the upload actions). */
export async function saveBrandAction(
  input: BrandInput,
): Promise<ActionResult> {
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, name, tagline } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

  const res = await patchSiteJson(websiteId, "brand", {
    name: name.trim(),
    tagline: tagline.trim(),
  });
  if (!res.ok) return res;

  revalidatePath(`/dashboard/website/${websiteId}/brand`);
  return { ok: true };
}

/** Save the theme preset + accent/font/radius overrides. */
export async function saveThemeAction(
  input: ThemeInput,
): Promise<ActionResult> {
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, preset, accent, font, radius } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

  const res = await patchSiteJson(websiteId, "theme", {
    preset,
    accent: accent || undefined,
    font: font || undefined,
    radius: radius || undefined,
  });
  if (!res.ok) return res;

  revalidatePath(`/dashboard/website/${websiteId}/theme`);
  return { ok: true };
}

export type UploadTicket = { path: string; token: string };

/**
 * Issue a signed upload URL for the site logo. The browser uploads straight to
 * Storage (no body cap), then calls `registerWebsiteLogoAction` with the path.
 * Path is scoped to `{websiteId}/...` so it satisfies the bucket RLS.
 */
export async function createWebsiteLogoUploadUrl(
  websiteId: string,
  ext: string,
): Promise<{ ok: true; data: UploadTicket } | { ok: false; error: string }> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

  const safeExt =
    (ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${websiteId}/logo-${crypto.randomUUID()}.${safeExt}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("website-assets")
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "upload_start_failed" };
  return { ok: true, data: { path, token: data.token } };
}

/** Record an already-uploaded logo path on the site brand. */
export async function registerWebsiteLogoAction(
  websiteId: string,
  storagePath: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

  if (!storagePath.startsWith(`${websiteId}/`)) {
    return { ok: false, error: "invalid_path" };
  }

  const res = await patchSiteJson(websiteId, "brand", {
    logo_path: storagePath,
  });
  if (!res.ok) return res;

  revalidatePath(`/dashboard/website/${websiteId}/brand`);
  return { ok: true };
}

/** Remove the logo from the brand + delete the object from Storage. */
export async function removeWebsiteLogoAction(
  websiteId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("brand")
    .eq("id", websiteId)
    .maybeSingle();
  const brand = { ...((row?.brand ?? {}) as Record<string, unknown>) };
  const path = typeof brand.logo_path === "string" ? brand.logo_path : null;
  delete brand.logo_path;

  const { error } = await supabase
    .from("host_websites")
    .update({ brand })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  if (path && path.startsWith(`${websiteId}/`)) {
    await createAdminClient().storage.from("website-assets").remove([path]);
  }

  revalidatePath(`/dashboard/website/${websiteId}/brand`);
  return { ok: true };
}
