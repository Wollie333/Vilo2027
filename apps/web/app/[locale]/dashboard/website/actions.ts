"use server";

import { revalidatePath } from "next/cache";

import { requireHost } from "@/lib/host/current";
import { hostHasFeature } from "@/lib/products/featureGate";
import { slugify, uniqueSlug } from "@/lib/help/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";
import { normaliseDomain, validateDomain } from "@/lib/website/domain";
import { pollWebsiteDomain } from "@/lib/website/domain-poll";
import { buildWebsiteSnapshot } from "@/lib/website/publish";
import { validateSubdomain } from "@/lib/website/subdomain";
import {
  addDomainToProject,
  removeDomainFromProject,
  vercelConfigured,
} from "@/lib/website/vercel";

import {
  brandSchema,
  connectDomainSchema,
  createWebsiteSchema,
  saveBlogCategoriesSchema,
  saveBlogPostSchema,
  saveDraftSectionsSchema,
  saveWebsiteRoomsSchema,
  seoSchema,
  themeSchema,
  websiteSettingsSchema,
  type BrandInput,
  type ConnectDomainInput,
  type CreateWebsiteInput,
  type SaveBlogCategoriesInput,
  type SaveBlogPostInput,
  type SaveDraftSectionsInput,
  type SaveWebsiteRoomsInput,
  type SeoInput,
  type ThemeInput,
  type WebsiteSettingsInput,
} from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

// W15 — feature gating is LIVE. Website/CMS actions require the host's plan to
// grant the relevant capability via `check_feature_permission` (the pre-MVP
// open-on-free short-circuit was removed). `website_builder` is the master gate;
// blog actions check `website_blog` and the custom-domain action checks
// `website_custom_domain`. plan_features still seeds these on every plan, so any
// host on an active/trialing subscription keeps access; one with no active
// subscription is locked out (fail-closed via hostHasFeature).
async function assertWebsiteFeature(
  hostId: string,
  featureKey: string = "website_builder",
): Promise<boolean> {
  return hostHasFeature(hostId, featureKey);
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
  if (!(await assertWebsiteFeature(host.hostId)))
    return { ok: false, error: "locked" };

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

/** Patch a `brand`/`theme`/`seo` jsonb column on a website, merging over stored. */
async function patchSiteJson(
  websiteId: string,
  column: "brand" | "theme" | "seo",
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("brand, theme, seo")
    .eq("id", websiteId)
    .maybeSingle();
  const current = (row?.[column] ?? {}) as Record<string, unknown>;
  const merged = { ...current, ...patch };
  const { error } = await supabase
    .from("host_websites")
    .update({ [column]: merged })
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
  const {
    websiteId,
    name,
    tagline,
    logoStyle,
    contactEmail,
    contactPhone,
    socials,
  } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  // Drop empty social URLs so the footer only renders the ones that are set.
  const cleanSocials = Object.fromEntries(
    Object.entries(socials).filter(([, v]) => v && v.trim()),
  );

  const res = await patchSiteJson(websiteId, "brand", {
    name: name.trim(),
    tagline: tagline.trim(),
    logo_style: logoStyle,
    contact: {
      email: contactEmail.trim() || undefined,
      phone: contactPhone.trim() || undefined,
    },
    socials: cleanSocials,
  });
  if (!res.ok) return res;

  revalidatePath(`/dashboard/website/${websiteId}/brand`);
  return { ok: true };
}

// ── Favicon (browser-tab icon) — mirrors the logo upload flow ──
export async function createWebsiteFaviconUploadUrl(
  websiteId: string,
  ext: string,
): Promise<{ ok: true; data: UploadTicket } | { ok: false; error: string }> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const safeExt =
    (ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${websiteId}/favicon-${crypto.randomUUID()}.${safeExt}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("website-assets")
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "upload_start_failed" };
  return { ok: true, data: { path, token: data.token } };
}

/** Record an uploaded favicon path on the site brand (or pick one from library). */
export async function registerWebsiteFaviconAction(
  websiteId: string,
  storagePath: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!storagePath.startsWith(`${websiteId}/`)) {
    return { ok: false, error: "invalid_path" };
  }
  const res = await patchSiteJson(websiteId, "brand", {
    favicon_path: storagePath,
  });
  if (!res.ok) return res;
  revalidatePath(`/dashboard/website/${websiteId}/brand`);
  return { ok: true };
}

/** Remove the favicon from the brand (object stays in the media library). */
export async function removeWebsiteFaviconAction(
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
  delete brand.favicon_path;

  const { error } = await supabase
    .from("host_websites")
    .update({ brand })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

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
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

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

// ============================================================
// W8 — Section builder (Home + About pages)
// ============================================================

/**
 * Save a page's draft sections (the builder's working copy). Validated through
 * the shared `sectionsSchema` SSOT so the renderer + publish action can trust the
 * stored shape. Public visitors still see `published_sections` until Publish (W10).
 */
export async function saveDraftSectionsAction(
  input: SaveDraftSectionsInput,
): Promise<ActionResult> {
  const parsed = saveDraftSectionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, pageId, sections } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  // Page must belong to this (owner-verified) website.
  const { data: page } = await supabase
    .from("website_pages")
    .select("id")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle();
  if (!page) return { ok: false, error: "not_found" };

  const { error } = await supabase
    .from("website_pages")
    .update({ draft_sections: sections })
    .eq("id", pageId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/pages/${pageId}`);
  return { ok: true };
}

/**
 * Duplicate a page into a new custom page — copies its draft sections (with fresh
 * section ids so ids never collide), derives a unique slug, and starts it hidden
 * from the nav. Returns the new page id so the caller can open it.
 */
export async function duplicatePageAction(
  websiteId: string,
  pageId: string,
): Promise<CreateResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: src } = await supabase
    .from("website_pages")
    .select("title, slug, nav_label, draft_sections")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle();
  if (!src) return { ok: false, error: "not_found" };

  // Unique slug + next nav order within this site.
  const { data: pageRows } = await supabase
    .from("website_pages")
    .select("slug, nav_order")
    .eq("website_id", websiteId);
  const taken = new Set((pageRows ?? []).map((r) => r.slug));
  const newSlug = uniqueSlug(`${src.slug}-copy`, taken);
  const nextOrder =
    Math.max(0, ...(pageRows ?? []).map((r) => r.nav_order ?? 0)) + 1;

  // Clone sections with fresh ids (unique per page).
  const sections = Array.isArray(src.draft_sections) ? src.draft_sections : [];
  const cloned = sections.map((s) =>
    s && typeof s === "object"
      ? { ...(s as Record<string, unknown>), id: uuid() }
      : s,
  );

  const { data: page, error } = await supabase
    .from("website_pages")
    .insert({
      website_id: websiteId,
      kind: "custom",
      slug: newSlug,
      title: `${src.title ?? src.slug} (copy)`,
      nav_label: src.nav_label,
      nav_order: nextOrder,
      show_in_nav: false,
      draft_sections: cloned,
      published_sections: [],
    })
    .select("id")
    .single();
  if (error || !page) return { ok: false, error: "create_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/pages`);
  return { ok: true, id: page.id };
}

/**
 * Issue a signed upload URL for a section image (hero / host photo). Same direct
 * browser→Storage pattern as the logo; the returned path is stored into the
 * section's props and persisted on the next Save. Path is `{websiteId}/...` to
 * satisfy the bucket RLS.
 */
export async function createWebsiteAssetUploadUrl(
  websiteId: string,
  ext: string,
): Promise<{ ok: true; data: UploadTicket } | { ok: false; error: string }> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const safeExt =
    (ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${websiteId}/section-${crypto.randomUUID()}.${safeExt}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("website-assets")
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "upload_start_failed" };
  return { ok: true, data: { path, token: data.token } };
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

// ============================================================
// W9 — Rooms tab (channel membership + display overrides)
// ============================================================

/**
 * Reconcile the site's `website_properties` + `website_rooms` with the business's
 * current properties/rooms — pulls in anything added since the site was created and
 * prunes membership for rooms/properties that no longer exist. Newly synced rows
 * default to visible. Cosmetic overrides on still-present rooms are preserved.
 */
export async function syncWebsiteRoomsAction(
  websiteId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: site } = await supabase
    .from("host_websites")
    .select("business_id")
    .eq("id", websiteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "not_found" };

  const { data: props } = await supabase
    .from("properties")
    .select("id")
    .eq("business_id", site.business_id)
    .is("deleted_at", null);
  const propertyIds = (props ?? []).map((p) => p.id);

  // Reconcile property channel membership (keeps room book-links resolvable).
  const { data: memberRows } = await supabase
    .from("website_properties")
    .select("id, property_id")
    .eq("website_id", websiteId);
  const memberSet = new Set((memberRows ?? []).map((m) => m.property_id));
  const newProps = propertyIds.filter((id) => !memberSet.has(id));
  if (newProps.length > 0) {
    await supabase.from("website_properties").insert(
      newProps.map((property_id, i) => ({
        website_id: websiteId,
        property_id,
        is_visible: true,
        sort_order: memberSet.size + i,
      })),
    );
  }
  const orphanProps = (memberRows ?? [])
    .filter((m) => !propertyIds.includes(m.property_id))
    .map((m) => m.id);
  if (orphanProps.length > 0) {
    await supabase.from("website_properties").delete().in("id", orphanProps);
  }

  // Reconcile rooms.
  const roomIds: string[] = [];
  if (propertyIds.length > 0) {
    const { data: rooms } = await supabase
      .from("property_rooms")
      .select("id")
      .in("property_id", propertyIds)
      .is("deleted_at", null);
    roomIds.push(...(rooms ?? []).map((r) => r.id));
  }

  const { data: roomMembers } = await supabase
    .from("website_rooms")
    .select("id, room_id")
    .eq("website_id", websiteId);
  const roomMemberSet = new Set((roomMembers ?? []).map((m) => m.room_id));
  const newRooms = roomIds.filter((id) => !roomMemberSet.has(id));
  if (newRooms.length > 0) {
    await supabase.from("website_rooms").insert(
      newRooms.map((room_id, i) => ({
        website_id: websiteId,
        room_id,
        is_visible: true,
        sort_order: roomMemberSet.size + i,
      })),
    );
  }
  const orphanRooms = (roomMembers ?? [])
    .filter((m) => !roomIds.includes(m.room_id))
    .map((m) => m.id);
  if (orphanRooms.length > 0) {
    await supabase.from("website_rooms").delete().in("id", orphanRooms);
  }

  revalidatePath(`/dashboard/website/${websiteId}/rooms`);
  return { ok: true };
}

// ============================================================
// W10 — Publish workflow
// ============================================================

/**
 * Publish the site: copy every page's draft sections to its published sections,
 * freeze the public-render config (chrome + channel membership + room overrides)
 * into `published_snapshot`, and mark the site `published`. The public renderer
 * reads ONLY this frozen state, so unpublished edits never leak.
 */
export async function publishWebsiteAction(
  websiteId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();

  // Copy draft → published for every page. There's no SQL column-to-column copy
  // via the JS client, so read the drafts and write them back (pages are few).
  const { data: pages } = await supabase
    .from("website_pages")
    .select("id, draft_sections")
    .eq("website_id", websiteId);
  for (const page of pages ?? []) {
    const { error: pageErr } = await supabase
      .from("website_pages")
      .update({ published_sections: page.draft_sections })
      .eq("id", page.id)
      .eq("website_id", websiteId);
    if (pageErr) return { ok: false, error: "publish_failed" };
  }

  const snapshot = await buildWebsiteSnapshot(supabase, websiteId);

  const { error } = await supabase
    .from("host_websites")
    .update({
      published_snapshot: snapshot,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "publish_failed" };

  revalidatePath(`/dashboard/website/${websiteId}`);
  return { ok: true };
}

/**
 * Take the site offline. The public renderer 404s anything that isn't
 * `published`, so this hides the site without discarding the draft or the last
 * published snapshot — republishing brings it straight back.
 */
export async function unpublishWebsiteAction(
  websiteId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_websites")
    .update({ status: "unpublished" })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}`);
  return { ok: true };
}

/**
 * Save per-room visibility + cosmetic display overrides + order. Upserts one
 * `website_rooms` row per submitted room (sort_order = array index, so the host's
 * reorder sticks). Every room_id is verified to belong to the website's business
 * before any write, so a tampered payload can't touch another host's rooms.
 */
export async function saveWebsiteRoomsAction(
  input: SaveWebsiteRoomsInput,
): Promise<ActionResult> {
  const parsed = saveWebsiteRoomsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, rooms } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: site } = await supabase
    .from("host_websites")
    .select("business_id")
    .eq("id", websiteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "not_found" };

  // Validate every room belongs to this business (anti-tamper).
  const roomIds = rooms.map((r) => r.roomId);
  if (roomIds.length > 0) {
    const { data: owned } = await supabase
      .from("property_rooms")
      .select("id, property:properties!inner ( business_id )")
      .in("id", roomIds)
      .is("deleted_at", null);
    const ownedSet = new Set(
      (owned ?? [])
        .filter(
          (r) =>
            (r.property as unknown as { business_id: string } | null)
              ?.business_id === site.business_id,
        )
        .map((r) => r.id),
    );
    if (roomIds.some((id) => !ownedSet.has(id))) {
      return { ok: false, error: "invalid" };
    }
  }

  const payload = rooms.map((r, i) => ({
    website_id: websiteId,
    room_id: r.roomId,
    is_visible: r.isVisible,
    display_name: r.displayName.trim() || null,
    display_price: r.displayPrice ? Number(r.displayPrice) : null,
    display_currency: r.displayCurrency.trim().toUpperCase() || null,
    display_desc: r.displayDesc.trim() || null,
    sort_order: i,
  }));

  if (payload.length > 0) {
    const { error } = await supabase
      .from("website_rooms")
      .upsert(payload, { onConflict: "website_id,room_id" });
    if (error) return { ok: false, error: "save_failed" };
  }

  revalidatePath(`/dashboard/website/${websiteId}/rooms`);
  return { ok: true };
}

// ============================================================
// W11 — Blog (categories + posts)
// ============================================================

/**
 * Reconcile a site's blog categories: upsert the submitted set (existing rows by
 * id, new rows inserted with a derived unique slug) and delete any category the
 * host removed. Posts in a deleted category are set category-less by the FK's
 * ON DELETE SET NULL, so nothing is orphaned.
 */
export async function saveBlogCategoriesAction(
  input: SaveBlogCategoriesInput,
): Promise<ActionResult> {
  const parsed = saveBlogCategoriesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, categories } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId, "website_blog")))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("website_blog_categories")
    .select("id")
    .eq("website_id", websiteId);
  const existingIds = new Set((existing ?? []).map((c) => c.id));

  // Delete the categories the host removed.
  const keptIds = new Set(
    categories.map((c) => c.id).filter((id): id is string => Boolean(id)),
  );
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    await supabase.from("website_blog_categories").delete().in("id", toDelete);
  }

  // Upsert kept + new, deriving a unique slug per category.
  const usedSlugs = new Set<string>();
  let order = 0;
  for (const cat of categories) {
    const slug = uniqueSlug(cat.name, usedSlugs);
    usedSlugs.add(slug);
    if (cat.id && existingIds.has(cat.id)) {
      const { error } = await supabase
        .from("website_blog_categories")
        .update({ name: cat.name, slug, sort_order: order })
        .eq("id", cat.id)
        .eq("website_id", websiteId);
      if (error) return { ok: false, error: "save_failed" };
    } else {
      const { error } = await supabase.from("website_blog_categories").insert({
        website_id: websiteId,
        name: cat.name,
        slug,
        sort_order: order,
      });
      if (error) return { ok: false, error: "save_failed" };
    }
    order += 1;
  }

  revalidatePath(`/dashboard/website/${websiteId}/blog`);
  return { ok: true };
}

/** Compute a per-website-unique post slug, optionally excluding one post. */
async function uniquePostSlug(
  supabase: ReturnType<typeof createServerClient>,
  websiteId: string,
  desired: string,
  excludePostId?: string,
): Promise<string> {
  let query = supabase
    .from("website_blog_posts")
    .select("slug")
    .eq("website_id", websiteId);
  if (excludePostId) query = query.neq("id", excludePostId);
  const { data: rows } = await query;
  const taken = new Set((rows ?? []).map((r) => r.slug));
  return uniqueSlug(desired || "post", taken);
}

/**
 * Create a blank draft post and return its id so the caller can open the editor.
 * Seeds a unique placeholder slug; the host renames it (and the slug) on save.
 */
export async function createBlogPostAction(
  websiteId: string,
): Promise<CreateResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId, "website_blog")))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const slug = await uniquePostSlug(supabase, websiteId, "untitled-post");

  const { data: post, error } = await supabase
    .from("website_blog_posts")
    .insert({
      website_id: websiteId,
      title: "Untitled post",
      slug,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !post) return { ok: false, error: "create_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/blog`);
  return { ok: true, id: post.id };
}

/**
 * Save a post's content + publication state. Validates the post belongs to the
 * owner's website, derives a unique slug (from the host's slug or the title), and
 * stamps `publish_at` the first time a post is published. Body HTML is stored raw
 * and sanitised at render time (loadSiteBlogPost → sanitiseListingHtml).
 */
export async function saveBlogPostAction(
  input: SaveBlogPostInput,
): Promise<ActionResult> {
  const parsed = saveBlogPostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const {
    websiteId,
    postId,
    title,
    slug,
    categoryId,
    status,
    coverPath,
    excerpt,
    bodyHtml,
    authorName,
    seoTitle,
    seoDescription,
  } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId, "website_blog")))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: post } = await supabase
    .from("website_blog_posts")
    .select("id, publish_at")
    .eq("id", postId)
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!post) return { ok: false, error: "not_found" };

  // A category, if set, must belong to this website (anti-tamper).
  if (categoryId) {
    const { data: cat } = await supabase
      .from("website_blog_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("website_id", websiteId)
      .maybeSingle();
    if (!cat) return { ok: false, error: "invalid" };
  }

  const desiredSlug = slugify(slug || title);
  const finalSlug = await uniquePostSlug(
    supabase,
    websiteId,
    desiredSlug,
    postId,
  );

  // Stamp publish_at the first time the post is published.
  const publishAt =
    status === "published" && !post.publish_at
      ? new Date().toISOString()
      : post.publish_at;

  const { error } = await supabase
    .from("website_blog_posts")
    .update({
      title,
      slug: finalSlug,
      category_id: categoryId || null,
      status,
      publish_at: publishAt,
      cover_path: coverPath || null,
      excerpt: excerpt || null,
      body_html: bodyHtml || null,
      author_name: authorName || null,
      seo: {
        title: seoTitle || undefined,
        description: seoDescription || undefined,
      },
    })
    .eq("id", postId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/blog`);
  revalidatePath(`/dashboard/website/${websiteId}/blog/${postId}`);
  return { ok: true };
}

/** Soft-delete a blog post (keeps it out of the list + the public site). */
export async function deleteBlogPostAction(
  websiteId: string,
  postId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId, "website_blog")))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("website_blog_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/blog`);
  return { ok: true };
}

// ============================================================
// W13 — Custom domain + SSL
// ============================================================
// Domain writes (host_websites cols + the INSERT-only website_domain_events) go
// through the ADMIN client: events have no authenticated INSERT policy (only the
// service role appends them). Each action is owner-checked FIRST, so the admin
// write is gated by the same ownership guard as every other website mutation.

const domainSelect =
  "id, custom_domain, domain_status, ssl_status, settings" as const;

/**
 * Connect a custom domain: validate + ensure global uniqueness, add it to the
 * Vercel project, persist the pending state + ownership challenges, then poll
 * once so the host immediately sees accurate status + DNS records.
 *
 * Inert until the Vercel secrets are set (`vercelConfigured()` → false): returns
 * `domain_not_configured` so the UI explains the one-time ops step. See
 * WEBSITE_HOSTING.md.
 */
export async function connectCustomDomainAction(
  input: ConnectDomainInput,
): Promise<ActionResult> {
  const parsed = connectDomainSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId, "website_custom_domain")))
    return { ok: false, error: "locked" };

  const domain = normaliseDomain(parsed.data.domain);
  const domainErr = validateDomain(domain);
  if (domainErr) return { ok: false, error: domainErr };

  const admin = createAdminClient();

  // Globally unique across all sites.
  const { data: clash } = await admin
    .from("host_websites")
    .select("id")
    .eq("custom_domain", domain)
    .neq("id", websiteId)
    .maybeSingle();
  if (clash) return { ok: false, error: "domain_taken" };

  if (!vercelConfigured()) return { ok: false, error: "domain_not_configured" };

  const add = await addDomainToProject(domain);
  if (!add.ok) return { ok: false, error: "vercel_failed" };

  await admin
    .from("host_websites")
    .update({
      custom_domain: domain,
      domain_status: "pending",
      ssl_status: "pending",
    })
    .eq("id", websiteId);
  await admin.from("website_domain_events").insert({
    website_id: websiteId,
    event: "domain_added",
    detail: { domain },
  });

  // Refine status + capture challenge records straight away.
  const { data: site } = await admin
    .from("host_websites")
    .select(domainSelect)
    .eq("id", websiteId)
    .maybeSingle();
  if (site) await pollWebsiteDomain(admin, site);

  revalidatePath(`/dashboard/website/${websiteId}/domain`);
  return { ok: true };
}

/** Re-check a connected domain's verification/SSL status against Vercel now. */
export async function refreshCustomDomainAction(
  websiteId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const admin = createAdminClient();
  const { data: site } = await admin
    .from("host_websites")
    .select(domainSelect)
    .eq("id", websiteId)
    .maybeSingle();
  if (!site || !site.custom_domain) return { ok: false, error: "no_domain" };

  const res = await pollWebsiteDomain(admin, site);
  if (res.notConfigured) return { ok: false, error: "domain_not_configured" };

  revalidatePath(`/dashboard/website/${websiteId}/domain`);
  return { ok: true };
}

/** Disconnect the custom domain (detach from Vercel + clear the stored state). */
export async function removeCustomDomainAction(
  websiteId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const admin = createAdminClient();
  const { data: site } = await admin
    .from("host_websites")
    .select("id, custom_domain, settings")
    .eq("id", websiteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "not_found" };
  if (!site.custom_domain) return { ok: true };

  if (vercelConfigured()) {
    // Best-effort detach; clearing our side proceeds regardless.
    await removeDomainFromProject(site.custom_domain);
  }

  const settings = { ...((site.settings ?? {}) as Record<string, unknown>) };
  delete settings.domainChallenges;

  const { error } = await admin
    .from("host_websites")
    .update({
      custom_domain: null,
      domain_status: "none",
      ssl_status: "none",
      verification_token: null,
      settings,
    })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  await admin.from("website_domain_events").insert({
    website_id: websiteId,
    event: "removed",
    detail: { domain: site.custom_domain },
  });

  revalidatePath(`/dashboard/website/${websiteId}/domain`);
  return { ok: true };
}

// ============================================================
// W14 — SEO
// ============================================================

/**
 * Save the site-level SEO config (title/description/OG image/robots/sitemap/GSC)
 * into `host_websites.seo`. The public renderer reads this (frozen into the
 * publish snapshot at publish time) for page metadata, robots.txt + sitemap.xml.
 */
export async function saveSeoAction(input: SeoInput): Promise<ActionResult> {
  const parsed = seoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const {
    websiteId,
    title,
    description,
    ogImagePath,
    gscToken,
    robotsIndex,
    sitemapEnabled,
  } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  if (ogImagePath && !ogImagePath.startsWith(`${websiteId}/`)) {
    return { ok: false, error: "invalid_path" };
  }

  const res = await patchSiteJson(websiteId, "seo", {
    title: title.trim() || undefined,
    description: description.trim() || undefined,
    og_image_path: ogImagePath || undefined,
    gsc_token: gscToken.trim() || undefined,
    robots_index: robotsIndex,
    sitemap_enabled: sitemapEnabled,
  });
  if (!res.ok) return res;

  revalidatePath(`/dashboard/website/${websiteId}/seo`);
  return { ok: true };
}

// ============================================================
// Phase 5 — Settings tab (site-wide settings in `settings` jsonb)
// ============================================================

/**
 * Save site-wide settings. First occupant: the contact-form enquiry email — when
 * enabled with an address, a website contact-form submission is also emailed
 * there (it always lands in the inbox regardless). Merged into the existing
 * `settings` jsonb so domain/canonical-host keys are preserved.
 */
export async function saveWebsiteSettingsAction(
  input: WebsiteSettingsInput,
): Promise<ActionResult> {
  const parsed = websiteSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, enquiryEmailEnabled, enquiryEmailTo } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("settings")
    .eq("id", websiteId)
    .maybeSingle();
  const settings = {
    ...((row?.settings ?? {}) as Record<string, unknown>),
    enquiry: {
      emailEnabled: enquiryEmailEnabled,
      emailTo: enquiryEmailTo.trim().toLowerCase(),
    },
  };

  const { error } = await supabase
    .from("host_websites")
    .update({ settings })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/settings`);
  return { ok: true };
}

// ============================================================
// Phase 0B — Reusable Media Library
// ============================================================
// The library browses the public `website-assets/{websiteId}/` folder (the SSOT
// for what exists, however it was uploaded) and LEFT-merges optional metadata
// (alt text) from `website_media`. Every image picker can open it to reuse an
// already-uploaded asset instead of re-uploading.

export type MediaItem = {
  path: string;
  url: string;
  name: string;
  size: number | null;
  createdAt: string | null;
  alt: string | null;
};

/** List every asset under this site's folder, newest first, with alt text. */
export async function listWebsiteMediaAction(
  websiteId: string,
): Promise<{ ok: true; items: MediaItem[] } | { ok: false; error: string }> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const admin = createAdminClient();
  const { data: objects, error } = await admin.storage
    .from("website-assets")
    .list(websiteId, {
      limit: 500,
      sortBy: { column: "created_at", order: "desc" },
    });
  if (error) return { ok: false, error: "list_failed" };

  // Alt text keyed by path (owner-scoped via the server client / RLS).
  const supabase = createServerClient();
  const { data: metaRows } = await supabase
    .from("website_media")
    .select("path, alt")
    .eq("website_id", websiteId);
  const altByPath = new Map<string, string | null>(
    (metaRows ?? []).map((r) => [r.path, r.alt]),
  );

  const items: MediaItem[] = (objects ?? [])
    // Storage `list` can include a placeholder folder row with no id; skip it.
    .filter((o) => o.id != null && !o.name.endsWith("/"))
    .map((o) => {
      const path = `${websiteId}/${o.name}`;
      const size = (o.metadata as { size?: number } | null)?.size ?? null;
      return {
        path,
        url: websiteAssetUrl(path) ?? "",
        name: o.name,
        size,
        createdAt: o.created_at ?? null,
        alt: altByPath.get(path) ?? null,
      };
    });

  return { ok: true, items };
}

/** Signed URL for a library upload (mirrors the section-asset flow). */
export async function createWebsiteMediaUploadUrl(
  websiteId: string,
  ext: string,
): Promise<{ ok: true; data: UploadTicket } | { ok: false; error: string }> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const safeExt =
    (ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${websiteId}/media-${crypto.randomUUID()}.${safeExt}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("website-assets")
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "upload_start_failed" };
  return { ok: true, data: { path, token: data.token } };
}

/** Upsert per-asset metadata (alt + dimensions) after an upload, or alt edits. */
export async function registerWebsiteMediaAction(
  websiteId: string,
  storagePath: string,
  meta: {
    alt?: string;
    width?: number;
    height?: number;
    size?: number;
    mime?: string;
  } = {},
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!storagePath.startsWith(`${websiteId}/`)) {
    return { ok: false, error: "invalid_path" };
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("website_media").upsert(
    {
      website_id: websiteId,
      path: storagePath,
      alt: meta.alt?.trim() || null,
      width: meta.width ?? null,
      height: meta.height ?? null,
      size_bytes: meta.size ?? null,
      mime: meta.mime ?? null,
    },
    { onConflict: "website_id,path" },
  );
  if (error) return { ok: false, error: "save_failed" };
  return { ok: true };
}

/** Delete an asset from Storage and drop its metadata row. */
export async function deleteWebsiteMediaAction(
  websiteId: string,
  storagePath: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!storagePath.startsWith(`${websiteId}/`)) {
    return { ok: false, error: "invalid_path" };
  }

  await createAdminClient()
    .storage.from("website-assets")
    .remove([storagePath]);
  const supabase = createServerClient();
  await supabase
    .from("website_media")
    .delete()
    .eq("website_id", websiteId)
    .eq("path", storagePath);
  return { ok: true };
}

// ============================================================
// Phase 4 — Domain tab: editable subdomain + canonical host
// ============================================================

/** Rename the site's free subdomain (validated + globally unique). */
export async function saveSubdomainAction(
  websiteId: string,
  subdomain: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const next = subdomain.trim().toLowerCase();
  const err = validateSubdomain(next);
  if (err) return { ok: false, error: err };

  if (next !== own.subdomain) {
    // Uniqueness is global: check via the admin client so a clash owned by a
    // DIFFERENT host (invisible to this host's RLS) is still caught with a
    // friendly message. The DB UNIQUE constraint is the real guard regardless.
    const { data: taken } = await createAdminClient()
      .from("host_websites")
      .select("id")
      .eq("subdomain", next)
      .neq("id", websiteId)
      .maybeSingle();
    if (taken) return { ok: false, error: "subdomain_taken" };
  }

  const { error } = await createServerClient()
    .from("host_websites")
    .update({ subdomain: next })
    .eq("id", websiteId);
  if (error) {
    // 23505 = unique violation (lost a race / RLS-hidden clash).
    if (error.code === "23505") return { ok: false, error: "subdomain_taken" };
    return { ok: false, error: "save_failed" };
  }

  revalidatePath(`/dashboard/website/${websiteId}/domain`);
  revalidatePath(`/dashboard/website/${websiteId}`);
  return { ok: true };
}

/**
 * Live availability check for the subdomain edit field (debounced from the UI).
 * Owner-checked; admin client so cross-host clashes are seen. Returns a reason
 * code (i18n key suffix) when unavailable.
 */
export async function checkSubdomainAvailabilityAction(
  websiteId: string,
  subdomain: string,
): Promise<
  | { ok: true; available: boolean; reason?: string }
  | { ok: false; error: string }
> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return { ok: false, error: own.error };

  const next = subdomain.trim().toLowerCase();
  const err = validateSubdomain(next);
  if (err) return { ok: true, available: false, reason: err };
  if (next === own.subdomain) return { ok: true, available: true };

  const { data: taken } = await createAdminClient()
    .from("host_websites")
    .select("id")
    .eq("subdomain", next)
    .neq("id", websiteId)
    .maybeSingle();
  return taken
    ? { ok: true, available: false, reason: "subdomain_taken" }
    : { ok: true, available: true };
}

/** Set the preferred canonical host for a custom domain ("apex" | "www"). */
export async function setCanonicalHostAction(
  websiteId: string,
  canonical: "apex" | "www",
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (canonical !== "apex" && canonical !== "www") {
    return { ok: false, error: "invalid" };
  }

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("settings")
    .eq("id", websiteId)
    .maybeSingle();
  const settings = {
    ...((row?.settings ?? {}) as Record<string, unknown>),
    canonicalHost: canonical,
  };
  const { error } = await supabase
    .from("host_websites")
    .update({ settings })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/domain`);
  return { ok: true };
}
