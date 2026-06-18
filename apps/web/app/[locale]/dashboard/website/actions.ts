"use server";

import { revalidatePath } from "next/cache";

import { requireHost } from "@/lib/host/current";
import { slugify, uniqueSlug } from "@/lib/help/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { buildWebsiteSnapshot } from "@/lib/website/publish";
import { validateSubdomain } from "@/lib/website/subdomain";

import {
  brandSchema,
  createWebsiteSchema,
  saveBlogCategoriesSchema,
  saveBlogPostSchema,
  saveDraftSectionsSchema,
  saveWebsiteRoomsSchema,
  themeSchema,
  type BrandInput,
  type CreateWebsiteInput,
  type SaveBlogCategoriesInput,
  type SaveBlogPostInput,
  type SaveDraftSectionsInput,
  type SaveWebsiteRoomsInput,
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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
      const { error } = await supabase
        .from("website_blog_categories")
        .insert({
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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
  if (!(await assertWebsiteFeature())) return { ok: false, error: "locked" };

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
