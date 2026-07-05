"use server";

import type { CSSProperties } from "react";

import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireHost } from "@/lib/host/current";
import { hostHasFeature } from "@/lib/products/featureGate";
import type { SitePreset } from "@/lib/site/themes";
import {
  getThemeBundle,
  loadDefaultTheme,
  resolveThemeBase,
  type ThemeBundle,
  type ThemePageTemplate,
} from "@/lib/site/themes.server";
import { generatePalettes, resolvePaletteAccent } from "@/lib/site/palettes";
import {
  mergeStandardPages,
  standardPageTemplates,
} from "@/lib/website/standardPages";
import { missingRequiredFromRaw } from "@/lib/website/pageContract";
import {
  checkWebsiteReadiness,
  type ReadinessItem,
} from "@/lib/website/readiness";
import { getAmenityCatalog } from "@/lib/taxonomy/getAmenities";
import { slugify, uniqueSlug } from "@/lib/help/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";
import { normaliseDomain, validateDomain } from "@/lib/website/domain";
import { pollWebsiteDomain } from "@/lib/website/domain-poll";
import { buildWebsiteSnapshot } from "@/lib/website/publish";
import {
  captureRestorePoint,
  deleteRestorePoint,
  getRestorePoint,
  latestAutoForTheme,
  resolveDefaultThemeId,
  restoreSnapshotToSite,
} from "@/lib/website/restorePoints";
import { newSection } from "@/lib/website/sectionDefaults";
import { ensureDefaultMenu } from "@/lib/website/defaultMenu";
import { roomMediaOverridesSchema } from "@/lib/website/roomMedia";
import { hasRoomOverride } from "@/lib/website/roomDetailOverride";
import {
  getThemeRoomDetailSections,
  hasThemeRoomDetailTemplate,
} from "@/lib/website/themeSections";
import type {
  FormField,
  FormSettings,
  FormType,
} from "@/lib/website/forms.schema";
import {
  loadFormsEditor,
  loadWebsiteRoomNames,
} from "@/app/[locale]/dashboard/website/[websiteId]/(editor)/forms/loadFormsEditor";
import {
  DEFAULT_FORM_SEEDS,
  FORM_TEMPLATES,
} from "@/lib/website/formTemplates";
import { sanitiseSectionsHtml } from "@/lib/website/sanitiseSections";
import { validateSubdomain } from "@/lib/website/subdomain";
import {
  addDomainToProject,
  removeDomainFromProject,
  vercelConfigured,
} from "@/lib/website/vercel";

import {
  applyThemeSchema,
  BRAND_ASSET_KEYS,
  brandStudioSchema,
  connectDomainSchema,
  createWebsiteSchema,
  createWebsiteWizardSchema,
  resetToDefaultSchema,
  restorePointIdSchema,
  saveRestorePointSchema,
  saveBlogCategoriesSchema,
  saveBlogPostSchema,
  saveDraftSectionsSchema,
  saveBuilderDocSchema,
  publishBuilderDocSchema,
  saveBuilderBrandSchema,
  createPageSchema,
  PAGE_TEMPLATE_SECTIONS,
  saveBlogAuthorsSchema,
  savePageSeoSchema,
  savePagesSchema,
  saveNavigationSchema,
  navigationSchema,
  saveSavedSectionSchema,
  deleteSavedSectionSchema,
  savedSectionsSchema,
  saveWebsiteRoomsSchema,
  saveRoomDetailOverrideSchema,
  createWebsiteFormSchema,
  saveWebsiteFormSchema,
  deleteWebsiteFormSchema,
  duplicateWebsiteFormSchema,
  setSubmissionStatusSchema,
  seoSchema,
  websiteSettingsSchema,
  builderAnalyticsSchema,
  type BuilderAnalyticsInput,
  type ApplyThemeInput,
  type BrandAssetSlot,
  type BrandStudioInput,
  type ConnectDomainInput,
  type ResetToDefaultInput,
  type RestorePointIdInput,
  type SaveRestorePointInput,
  type CreatePageInput,
  type PageTemplate,
  type SaveNavigationInput,
  type SaveSavedSectionInput,
  type DeleteSavedSectionInput,
  type CreateWebsiteInput,
  type CreateWebsiteWizardInput,
  type SaveBlogAuthorsInput,
  type SaveBlogCategoriesInput,
  type SaveBlogPostInput,
  type SaveDraftSectionsInput,
  type SaveBuilderDocInput,
  type SaveBuilderBrandInput,
  type PublishBuilderDocInput,
  type SavePageSeoInput,
  type SavePagesInput,
  type SaveWebsiteRoomsInput,
  type SaveRoomDetailOverrideInput,
  type CreateWebsiteFormInput,
  type SaveWebsiteFormInput,
  type DeleteWebsiteFormInput,
  type DuplicateWebsiteFormInput,
  type SetSubmissionStatusInput,
  type SeoInput,
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
  | { ok: true; id: string; published?: boolean; missing?: ReadinessItem[] }
  | { ok: false; error: string };

const uuid = () => crypto.randomUUID();

/**
 * Apply a catalogue theme to a site: load the theme's design + pages. This
 * RESETS the site to the theme — `host_websites.theme` becomes the theme base
 * (the host then customises on top in Brand Studio) and `website_pages` is
 * replaced by the theme's page templates (built-in starters as a fallback). The
 * UI confirms first because it's destructive to existing pages.
 */
export async function applyThemeAction(
  input: ApplyThemeInput,
): Promise<ActionResult> {
  const parsed = applyThemeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, themeId, fresh } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: site } = await supabase
    .from("host_websites")
    .select(
      "brand, subdomain, navigation, business:businesses ( trading_name )",
    )
    .eq("id", websiteId)
    .maybeSingle();
  const brand = (site?.brand ?? {}) as { name?: string };
  const business = site?.business as unknown as {
    trading_name: string | null;
  } | null;
  const siteName =
    brand.name?.trim() ||
    business?.trading_name ||
    site?.subdomain ||
    "My site";

  // Resolve the theme → base + page templates (preset id or catalogue uuid).
  let slug: string;
  let base: SitePreset;
  let templates: ThemePageTemplate[];
  if (themeId.startsWith("preset:")) {
    slug = themeId.slice("preset:".length);
    base = await resolveThemeBase(slug);
    templates = standardPageTemplates(siteName);
  } else {
    const bundle = await getThemeBundle(themeId);
    if (!bundle) return { ok: false, error: "theme_not_found" };
    slug = bundle.slug;
    base = bundle.base;
    // Theme's own pages win by kind; any required standard page it omits
    // (e.g. Specials/Experiences/Gallery) is filled with a default spine.
    templates = mergeStandardPages(bundle.pageTemplates, siteName);
  }

  // A theme is only activatable if it ships a designed room-detail template —
  // every site has a room-detail page, and it must fit the theme. Fail BEFORE
  // any mutation (no restore-point churn, no page wipe).
  if (!hasThemeRoomDetailTemplate(slug)) {
    return { ok: false, error: "no_room_template" };
  }

  // Safety net: snapshot the current design BEFORE we replace anything, so the
  // switch is always reversible (Phase 2.5). After the gate so a blocked apply
  // leaves no stray restore point.
  await captureRestorePoint(websiteId, null, "auto_switch");

  // Returning to a previously-used theme restores the host's customised version
  // (not a blank reset) — unless a fresh seed is explicitly requested (reset).
  if (!fresh) {
    const prior = await latestAutoForTheme(websiteId, slug);
    if (prior) {
      const restored = await restoreSnapshotToSite(websiteId, prior);
      if (!restored) return { ok: false, error: "apply_failed" };
      revalidatePath(`/dashboard/website/${websiteId}`);
      revalidatePath(`/dashboard/website/${websiteId}/brand`);
      return { ok: true };
    }
  }

  // Owner-checked above; use the admin client for the replace (untyped: the new
  // theme_id/base columns aren't in the generated types in this lane).
  const admin = createAdminClient() as unknown as SupabaseClient;

  const { error: deleteErr } = await admin
    .from("website_pages")
    .delete()
    .eq("website_id", websiteId);
  if (deleteErr) return { ok: false, error: "delete_failed" };

  // Seed the theme's designed pages into BOTH draft and published so the stock
  // theme is LIVE the moment it's activated — the public site (which renders
  // `published_sections`, no draft fallback) would otherwise show blank pages
  // until every page was manually published. The host still edits the draft in
  // the builder and re-publishes their changes.
  const roomDetailSections = getThemeRoomDetailSections(slug);
  const pagesToInsert = [
    ...templates.map((tpl) => ({
      website_id: websiteId,
      kind: tpl.kind,
      slug: tpl.slug,
      title: tpl.title,
      nav_label: tpl.nav_label,
      nav_order: tpl.nav_order,
      show_in_nav: tpl.show_in_nav,
      draft_sections: tpl.sections,
      published_sections: tpl.sections,
    })),
    // Every theme seeds its room-detail page so the room layout fits the theme
    // (the page wipe above would otherwise drop a lazily-created one).
    {
      website_id: websiteId,
      kind: "room_detail",
      slug: "room-detail",
      title: "Room details",
      nav_label: null,
      nav_order: 900,
      show_in_nav: false,
      draft_sections: roomDetailSections,
      published_sections: roomDetailSections,
    },
  ];

  const { error: pagesErr } = await admin
    .from("website_pages")
    .insert(pagesToInsert);
  if (pagesErr) return { ok: false, error: "seed_failed" };

  const { error: themeErr } = await admin
    .from("host_websites")
    // Clear the frozen publish snapshot so the public site reads LIVE columns
    // (the freshly-seeded pages + the new theme's nav) instead of the previous
    // theme's chrome — otherwise the switched theme wouldn't fully mount live.
    .update({ theme: { preset: slug, base }, published_snapshot: null })
    .eq("id", websiteId);
  if (themeErr) return { ok: false, error: "apply_failed" };

  // Ship a working "Main menu" out of the box — seed the default named menu from
  // the freshly-seeded in-nav pages (idempotent: keeps an existing menu untouched,
  // only upgrades a legacy single menu into the named shape).
  await ensureDefaultMenu(
    admin,
    websiteId,
    navigationSchema.parse(site?.navigation ?? {}),
  );

  revalidatePath(`/dashboard/website/${websiteId}`);
  revalidatePath(`/dashboard/website/${websiteId}/brand`);
  return { ok: true };
}

/** Save the current design as a named restore point ("Save this design"). */
export async function saveRestorePointAction(
  input: SaveRestorePointInput,
): Promise<ActionResult> {
  const parsed = saveRestorePointSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const own = await assertWebsiteOwnership(parsed.data.websiteId);
  if (!own.ok) return own;
  await captureRestorePoint(
    parsed.data.websiteId,
    parsed.data.label.trim() || "Saved design",
    "manual",
  );
  revalidatePath(`/dashboard/website/${parsed.data.websiteId}/theme`);
  return { ok: true };
}

/** Restore a saved design — replaces pages + resets theme/brand to the snapshot. */
export async function restoreRestorePointAction(
  input: RestorePointIdInput,
): Promise<ActionResult> {
  const parsed = restorePointIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const rp = await getRestorePoint(parsed.data.restorePointId);
  if (!rp) return { ok: false, error: "not_found" };
  const own = await assertWebsiteOwnership(rp.websiteId);
  if (!own.ok) return own;
  // Capture the current state first so the restore is itself reversible.
  await captureRestorePoint(rp.websiteId, null, "auto_switch");
  const ok = await restoreSnapshotToSite(rp.websiteId, rp.snapshot);
  if (!ok) return { ok: false, error: "restore_failed" };
  revalidatePath(`/dashboard/website/${rp.websiteId}`);
  revalidatePath(`/dashboard/website/${rp.websiteId}/brand`);
  revalidatePath(`/dashboard/website/${rp.websiteId}/theme`);
  return { ok: true };
}

/** Delete a restore point. */
export async function deleteRestorePointAction(
  input: RestorePointIdInput,
): Promise<ActionResult> {
  const parsed = restorePointIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const rp = await getRestorePoint(parsed.data.restorePointId);
  if (!rp) return { ok: true };
  const own = await assertWebsiteOwnership(rp.websiteId);
  if (!own.ok) return own;
  await deleteRestorePoint(parsed.data.restorePointId);
  revalidatePath(`/dashboard/website/${rp.websiteId}/theme`);
  return { ok: true };
}

/** Reset the site to the default theme — the guaranteed-working safety button.
 * Fresh-seeds the default theme after auto-capturing the current state. */
export async function resetToDefaultAction(
  input: ResetToDefaultInput,
): Promise<ActionResult> {
  const parsed = resetToDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const own = await assertWebsiteOwnership(parsed.data.websiteId);
  if (!own.ok) return own;
  const defaultId = await resolveDefaultThemeId();
  return applyThemeAction({
    websiteId: parsed.data.websiteId,
    themeId: defaultId,
    fresh: true,
  });
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

  // Load the default theme (warm) with its page templates.
  const defaultTheme = await loadDefaultTheme();
  const themePreset = defaultTheme?.slug ?? "warm";
  const themeBase = defaultTheme?.base ?? undefined;

  const { data: site, error: insErr } = await supabase
    .from("host_websites")
    .insert({
      business_id: businessId,
      host_id: host.hostId,
      subdomain,
      status: "draft",
      brand: { name: siteName },
      theme: themeBase
        ? { preset: themePreset, base: themeBase }
        : { preset: themePreset },
    })
    .select("id")
    .single();
  if (insErr || !site) return { ok: false, error: "create_failed" };

  await seedWebsiteContent(supabase, {
    siteId: site.id,
    siteName,
    businessId,
    theme: defaultTheme,
  });

  revalidatePath("/dashboard/website");
  return { ok: true, id: site.id };
}

/**
 * Seed a freshly-created website with its starter content — the 4 default forms,
 * the theme's page templates (or hardcoded starters), and the business's
 * properties + rooms as the visible channel set. Shared by the simple create
 * card (createWebsiteAction) and the setup wizard (createWebsiteWithWizardAction)
 * so both produce an identical working site.
 */
async function seedWebsiteContent(
  supabase: ReturnType<typeof createServerClient>,
  opts: {
    siteId: string;
    siteName: string;
    businessId: string;
    theme: ThemeBundle | null;
  },
): Promise<void> {
  const { siteId, siteName, businessId, theme } = opts;

  // Seed the 4 default forms (contact / quote / booking / subscribe) so the site
  // is a working site out of the box — the host can drag any into a page via the
  // builder's Form element, or edit them in the Forms manager. Each field gets a
  // fresh uuid (same as createWebsiteFormAction). is_default → never-delete.
  await supabase.from("website_forms").insert(
    DEFAULT_FORM_SEEDS.map(({ name, template }) => {
      const tpl = FORM_TEMPLATES[template];
      return {
        website_id: siteId,
        name,
        type: tpl.type,
        fields: tpl.fields.map((f) => ({ ...f, id: uuid() })),
        settings: tpl.settings,
        is_default: true,
      };
    }),
  );

  // Seed pages from the theme's page_templates, guaranteeing the required
  // standard page set (THEME_CONTRACT.md): the theme's own pages win by kind, and
  // any required page it omits (Specials/Experiences/Gallery/etc.) is filled with
  // a default spine that still renders in the theme's scoped CSS. An empty
  // blueprint yields the full standard set.
  const templates = mergeStandardPages(theme?.pageTemplates ?? [], siteName);
  await supabase.from("website_pages").insert(
    templates.map((tpl) => ({
      website_id: siteId,
      kind: tpl.kind,
      slug: tpl.slug,
      title: tpl.title === "Home" ? siteName : tpl.title,
      nav_label: tpl.nav_label,
      nav_order: tpl.nav_order,
      show_in_nav: tpl.show_in_nav,
      draft_sections: tpl.sections,
      published_sections: [],
    })),
  );

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
        website_id: siteId,
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
          website_id: siteId,
          room_id,
          is_visible: true,
          sort_order: i,
        })),
      );
    }
  }
}

/**
 * Setup-wizard create: one shot from "no website" to a LIVE, themed site.
 * Validates + applies the chosen theme (catalogue id, falling back to default) and
 * an accent palette (generated variation or custom), stores brand (name/logo/
 * contact), seeds the same starter content as the simple card, then AUTO-PUBLISHES
 * (per the wizard's design — host can unpublish later). Additive: the existing
 * createWebsiteAction + builder are untouched.
 */
export async function createWebsiteWithWizardAction(
  input: CreateWebsiteWizardInput,
): Promise<CreateResult> {
  const parsed = createWebsiteWizardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const {
    businessId,
    subdomain,
    siteName,
    themeId,
    paletteIndex,
    customAccent,
    logoPath,
    contactEmail,
    contactPhone,
  } = parsed.data;

  const subErr = validateSubdomain(subdomain);
  if (subErr) return { ok: false, error: subErr };

  const host = await requireHost();
  if (!host.ok) return host;
  if (!(await assertWebsiteFeature(host.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();

  // Ownership + one-site-per-business + globally-unique subdomain (same invariants
  // as the simple create).
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

  const { data: taken } = await supabase
    .from("host_websites")
    .select("id")
    .eq("subdomain", subdomain)
    .maybeSingle();
  if (taken) return { ok: false, error: "subdomain_taken" };

  // Resolve the chosen theme (catalogue uuid → bundle; fall back to default) and
  // the accent (palette variation or custom) over the theme's base palette.
  const bundle =
    (await getThemeBundle(themeId)) ?? (await loadDefaultTheme()) ?? null;
  const slug = bundle?.slug ?? "warm";
  const base = bundle?.base ?? null;
  const baseAccent = base?.palette?.accent ?? "#0a7d4b";
  const accent = resolvePaletteAccent(baseAccent, paletteIndex, customAccent);
  // Persist the wizard's accent options as Brand Studio swatches so the host's
  // chosen palette is reflected (and quick-pickable) when they open Brand Studio.
  const paletteSwatches = Array.from(
    new Set([accent, ...generatePalettes(baseAccent).map((p) => p.accent)]),
  );

  const brand: Record<string, unknown> = { name: siteName.trim() };
  if (logoPath) brand.logo_path = logoPath;
  if (contactEmail || contactPhone) {
    brand.contact = {
      email: contactEmail?.trim() || undefined,
      phone: contactPhone?.trim() || undefined,
    };
  }

  const { data: site, error: insErr } = await supabase
    .from("host_websites")
    .insert({
      business_id: businessId,
      host_id: host.hostId,
      subdomain,
      status: "draft",
      brand,
      theme: {
        preset: slug,
        ...(base ? { base } : {}),
        colors: { accent },
        palette: paletteSwatches,
      },
    })
    .select("id")
    .single();
  if (insErr || !site) return { ok: false, error: "create_failed" };

  await seedWebsiteContent(supabase, {
    siteId: site.id,
    siteName: siteName.trim(),
    businessId,
    theme: bundle,
  });

  // Auto-publish — copy draft→published per page + freeze the snapshot + set
  // status=published. Best-effort: the site is already created, so this never
  // fails the wizard. It legitimately WON'T publish when the go-live readiness
  // gate isn't met yet (a brand-new host has no rooms/payment/policy) — that's
  // the intended "wall at the exciting moment": the site is created as a draft
  // and the wizard's final step tells the host exactly what's left to go live.
  const pub = await publishWebsiteAction(site.id);
  const published = pub.ok;
  const missing = published
    ? []
    : (await checkWebsiteReadiness(supabase, host.hostId, site.id)).missing;

  revalidatePath("/dashboard/website");
  return { ok: true, id: site.id, published, missing };
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

/**
 * One Brand Studio save — patches the brand (identity) + theme (design) jsonb
 * columns in a single call. Logo/favicon paths are persisted separately by the
 * asset actions on upload, so this never touches them.
 */
export async function saveBrandStudioAction(
  input: BrandStudioInput,
): Promise<ActionResult> {
  const parsed = brandStudioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const d = parsed.data;

  const own = await assertWebsiteOwnership(d.websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  // Drop empty social URLs so the footer only renders the ones that are set.
  const cleanSocials = Object.fromEntries(
    Object.entries(d.socials).filter(([, v]) => v && v.trim()),
  );

  // Colours: keep only the roles the host actually overrode (blank = inherit).
  const cleanColors = Object.fromEntries(
    Object.entries(d.colors).filter(([, v]) => v && v.trim()),
  );

  // Type sizes: keep only the pinned per-element overrides (drop nulls so an
  // un-pinned element keeps inheriting the modular base × scale).
  const cleanSizes = Object.fromEntries(
    Object.entries(d.type.sizes).filter(([, v]) => typeof v === "number"),
  );

  const brandRes = await patchSiteJson(d.websiteId, "brand", {
    name: d.name.trim(),
    tagline: d.tagline.trim(),
    monogram: d.monogram.trim() || undefined,
    logo_style: d.logoStyle,
    logo_max_height: d.logoMaxHeight,
    contact: {
      email: d.contactEmail.trim() || undefined,
      phone: d.contactPhone.trim() || undefined,
    },
    socials: cleanSocials,
  });
  if (!brandRes.ok) return brandRes;

  // Resolve the theme's base (palette/font/radius) from the catalogue by slug —
  // the authoritative source, copied in so the renderer's pure buildSiteVars
  // reads it without a DB lookup.
  const base = await resolveThemeBase(d.preset);

  const themeRes = await patchSiteJson(d.websiteId, "theme", {
    preset: d.preset,
    base,
    colors: cleanColors,
    palette: d.palette,
    type: {
      headingFont: d.type.headingFont || undefined,
      bodyFont: d.type.bodyFont || undefined,
      headingWeight: d.type.headingWeight,
      bodyWeight: d.type.bodyWeight,
      baseSize: d.type.baseSize,
      scale: d.type.scale,
      headingLeading: d.type.headingLeading,
      bodyLeading: d.type.bodyLeading,
      headingTracking: d.type.headingTracking,
      bodyTracking: d.type.bodyTracking,
      sizes: cleanSizes,
    },
    radius: d.radius || undefined,
    buttons: {
      primary: {
        style: d.buttons.primary.style,
        color: d.buttons.primary.color || undefined,
        borderWidth: d.buttons.primary.borderWidth,
        pill: d.buttons.primary.pill,
      },
      secondary: {
        style: d.buttons.secondary.style,
        color: d.buttons.secondary.color || undefined,
        borderWidth: d.buttons.secondary.borderWidth,
        pill: d.buttons.secondary.pill,
      },
    },
    image: {
      radius: d.image.radius,
      borderWidth: d.image.borderWidth,
      borderColor: d.image.borderColor || undefined,
      shadow: d.image.shadow,
    },
    card: {
      style: d.card.style,
      radius: d.card.radius,
      shadow: d.card.shadow,
      ratio: d.card.ratio,
    },
    heroLayout: d.heroLayout,
    social: { shape: d.social.shape, style: d.social.style },
    iconColor: d.iconColor || undefined,
    header: { desktop: d.header.desktop, mobile: d.header.mobile },
    footer: { desktop: d.footer.desktop, mobile: d.footer.mobile },
  });
  if (!themeRes.ok) return themeRes;

  revalidatePath(`/dashboard/website/${d.websiteId}/brand`);
  return { ok: true };
}

export type UploadTicket = { path: string; token: string };

// ── Brand assets (logo variants + favicon + apple icon) ──
// One generalised flow over all five slots. Each slot maps to a flat brand key
// (BRAND_ASSET_KEYS) and a `{websiteId}/{slot}-{uuid}.{ext}` storage path. The
// browser uploads straight to Storage (no body cap) then registers the path.

/** Issue a signed upload URL for a brand asset slot. */
export async function createWebsiteBrandAssetUploadUrl(
  websiteId: string,
  slot: BrandAssetSlot,
  ext: string,
): Promise<{ ok: true; data: UploadTicket } | { ok: false; error: string }> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };
  if (!BRAND_ASSET_KEYS[slot]) return { ok: false, error: "invalid" };

  const safeExt =
    (ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${websiteId}/${slot}-${crypto.randomUUID()}.${safeExt}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("website-assets")
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "upload_start_failed" };
  return { ok: true, data: { path, token: data.token } };
}

/** Record an uploaded brand-asset path on the brand (or pick from the library). */
export async function registerWebsiteBrandAssetAction(
  websiteId: string,
  slot: BrandAssetSlot,
  storagePath: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };
  const key = BRAND_ASSET_KEYS[slot];
  if (!key) return { ok: false, error: "invalid" };
  if (!storagePath.startsWith(`${websiteId}/`)) {
    return { ok: false, error: "invalid_path" };
  }

  const res = await patchSiteJson(websiteId, "brand", { [key]: storagePath });
  if (!res.ok) return res;

  revalidatePath(`/dashboard/website/${websiteId}/brand`);
  return { ok: true };
}

/** Remove a brand-asset slot from the brand + delete the object from Storage. */
export async function removeWebsiteBrandAssetAction(
  websiteId: string,
  slot: BrandAssetSlot,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  const key = BRAND_ASSET_KEYS[slot];
  if (!key) return { ok: false, error: "invalid" };

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("brand")
    .eq("id", websiteId)
    .maybeSingle();
  const brand = { ...((row?.brand ?? {}) as Record<string, unknown>) };
  const path = typeof brand[key] === "string" ? (brand[key] as string) : null;
  delete brand[key];

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

  // Defense-in-depth: strip any XSS from free-form rich_text HTML before it is
  // ever stored (the public loader sanitises again at render — see B1).
  const { error } = await supabase
    .from("website_pages")
    .update({ draft_sections: sanitiseSectionsHtml(sections) })
    .eq("id", pageId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/pages/${pageId}`);
  return { ok: true };
}

// ============================================================
// Builder V2 — persist the nested PageDoc (parallel build, Phase 3e-2)
// ============================================================

/**
 * Save a page's Builder V2 draft as a validated `PageDoc` into `draft_sections`
 * (the same JSONB column; distinguished by `v:2`). Re-validated server-side via
 * `saveBuilderDocSchema.doc = pageDocSchema` — never trust the client shape.
 * Owner-checked + feature-gated, mirroring `saveDraftSectionsAction`.
 */
export async function saveBuilderDocAction(
  input: SaveBuilderDocInput,
): Promise<ActionResult> {
  const parsed = saveBuilderDocSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, pageId, doc } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: page } = await supabase
    .from("website_pages")
    .select("id")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle();
  if (!page) return { ok: false, error: "not_found" };

  // NOTE: rich-text/HTML sanitisation of widget props happens at render (the
  // public v:2 path, Phase 3e-2b) as with the legacy loader.
  const { error } = await supabase
    .from("website_pages")
    .update({ draft_sections: doc })
    .eq("id", pageId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/builder`);
  return { ok: true };
}

/**
 * Publish a Builder V2 page: copy its `draft_sections` → `published_sections`
 * (page-level; the public loader reads `published_sections` directly, so this
 * surfaces the page live once the v:2 render path lands). Owner-checked.
 */
export async function publishBuilderDocAction(
  input: PublishBuilderDocInput,
): Promise<ActionResult> {
  const parsed = publishBuilderDocSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, pageId } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data: page } = await supabase
    .from("website_pages")
    .select("draft_sections, kind")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle<{ draft_sections: unknown; kind: string }>();
  if (!page) return { ok: false, error: "not_found" };

  // Required-blocks safety (page contract): a system template can't go live
  // missing a block it needs to function (e.g. a room page with no booking block).
  // Enforced on Builder V2 docs only; legacy flat pages are skipped. The builder
  // blocks this client-side too and names the missing blocks — this is the backstop.
  if (missingRequiredFromRaw(page.draft_sections, page.kind).length)
    return { ok: false, error: "missing_required_blocks" };

  const { error } = await supabase
    .from("website_pages")
    .update({ published_sections: page.draft_sections })
    .eq("id", pageId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "publish_failed" };

  revalidatePath(`/builder`);
  return { ok: true };
}

export type BuilderRoom = {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  basePrice: number;
  maxGuests: number;
  isActive: boolean;
};
export type BuilderProperty = { id: string; name: string };

/**
 * Load the host's real rooms (+ their properties) for the builder's "Edit room
 * data" modal (Phase 4a/4b). RLS-scoped to the signed-in host, so it returns only
 * what they can manage — the modal edits/creates rooms through the EXISTING
 * `updateRoomAction`/`createRoomAction` (property_rooms is the SSOT; a Wielo block's
 * data comes from the property, never stored on the website). `properties` lets the
 * host attach a NEW room to one of their properties. Ordered like the room manager.
 */
export async function fetchBuilderRoomsAction(
  websiteId: string,
): Promise<
  | { ok: true; rooms: BuilderRoom[]; properties: BuilderProperty[] }
  | { ok: false; error: string }
> {
  // `properties` is PUBLICLY readable (it's the guest-facing listings), so RLS
  // won't scope it to the host — resolve the host from the website and filter by
  // host_id. (property_rooms IS host-RLS'd, so that query stays scoped.)
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return { ok: false, error: "not_owner" };

  const supabase = createServerClient();
  const [roomsRes, propsRes] = await Promise.all([
    supabase
      .from("property_rooms")
      .select(
        "id, property_id, name, description, base_price, max_guests, is_active",
      )
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("properties")
      .select("id, name")
      .eq("host_id", own.hostId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);
  if (roomsRes.error || propsRes.error)
    return { ok: false, error: "load_failed" };
  const rooms: BuilderRoom[] = (roomsRes.data ?? []).map((r) => ({
    id: r.id as string,
    propertyId: r.property_id as string,
    name: (r.name as string | null) ?? "",
    description: (r.description as string | null) ?? null,
    basePrice: Number(r.base_price) || 0,
    maxGuests: Number(r.max_guests) || 1,
    isActive: !!r.is_active,
  }));
  const properties: BuilderProperty[] = (propsRes.data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.name as string | null) ?? "Untitled property",
  }));
  return { ok: true, rooms, properties };
}

export type BuilderAmenityGroup = {
  label: string;
  items: { key: string; label: string }[];
};
// Amenities live in property_amenities keyed by (property_id, room_id, amenity_key):
// room_id null = property-wide, room_id = that room. The builder modal edits either
// scope via a data-source dropdown; each property carries its property-wide keys +
// its rooms' keys.
export type BuilderAmenityProperty = {
  id: string;
  name: string;
  propertyKeys: string[];
  rooms: { id: string; name: string; keys: string[] }[];
};

/**
 * Load the host's properties (+ their rooms) with the amenity keys selected at each
 * SCOPE (property-wide + per-room) + the published amenity catalog, for the builder's
 * "Edit amenities" modal. Host-scoped (properties are public-read → filter by host_id).
 */
export async function fetchBuilderAmenitiesAction(websiteId: string): Promise<
  | {
      ok: true;
      properties: BuilderAmenityProperty[];
      groups: BuilderAmenityGroup[];
    }
  | { ok: false; error: string }
> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return { ok: false, error: "not_owner" };

  const supabase = createServerClient();
  const [propsRes, catalog] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name")
      .eq("host_id", own.hostId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    getAmenityCatalog(),
  ]);
  if (propsRes.error) return { ok: false, error: "load_failed" };

  const propIds = (propsRes.data ?? []).map((p) => p.id as string);
  const fallback = ["00000000-0000-0000-0000-000000000000"];
  const [roomsRes, amRes] = await Promise.all([
    supabase
      .from("property_rooms")
      .select("id, property_id, name")
      .in("property_id", propIds.length ? propIds : fallback)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("property_amenities")
      .select("property_id, room_id, amenity_key")
      .in("property_id", propIds.length ? propIds : fallback),
  ]);

  // Bucket amenity keys: property-wide (room_id null) vs per room id.
  const propKeys = new Map<string, string[]>();
  const roomKeys = new Map<string, string[]>();
  for (const r of amRes.data ?? []) {
    const rid = (r.room_id as string | null) ?? null;
    const bucket = rid ? roomKeys : propKeys;
    const mapKey = rid ?? (r.property_id as string);
    const list = bucket.get(mapKey) ?? [];
    list.push(r.amenity_key as string);
    bucket.set(mapKey, list);
  }
  const roomsByProp = new Map<
    string,
    { id: string; name: string; keys: string[] }[]
  >();
  for (const rm of roomsRes.data ?? []) {
    const pid = rm.property_id as string;
    const list = roomsByProp.get(pid) ?? [];
    list.push({
      id: rm.id as string,
      name: (rm.name as string | null) ?? "Untitled room",
      keys: roomKeys.get(rm.id as string) ?? [],
    });
    roomsByProp.set(pid, list);
  }

  const properties: BuilderAmenityProperty[] = (propsRes.data ?? []).map(
    (p) => ({
      id: p.id as string,
      name: (p.name as string | null) ?? "Untitled property",
      propertyKeys: propKeys.get(p.id as string) ?? [],
      rooms: roomsByProp.get(p.id as string) ?? [],
    }),
  );
  const groups: BuilderAmenityGroup[] = catalog.map((g) => ({
    label: g.label,
    items: g.items.map((i) => ({ key: i.slug, label: i.label })),
  }));
  return { ok: true, properties, groups };
}

/**
 * Scope-safe amenity save for the builder modal: sets the keys for ONE scope — a
 * property (roomId null) or a specific room — by DIFFING against the current rows at
 * that exact scope, so it never disturbs the OTHER scope (unlike the whole-set
 * `replaceAmenitiesAction`). Ownership: the property must belong to the website's host.
 */
export async function setBuilderAmenitiesAction(
  websiteId: string,
  propertyId: string,
  roomId: string | null,
  keys: string[],
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return { ok: false, error: "not_owner" };

  const admin = createAdminClient();
  const { data: prop } = await admin
    .from("properties")
    .select("id, host_id")
    .eq("id", propertyId)
    .maybeSingle<{ id: string; host_id: string }>();
  if (!prop || prop.host_id !== own.hostId)
    return { ok: false, error: "not_owner" };

  const supabase = createServerClient();
  let cur = supabase
    .from("property_amenities")
    .select("amenity_key")
    .eq("property_id", propertyId);
  cur = roomId ? cur.eq("room_id", roomId) : cur.is("room_id", null);
  const { data: existing, error: readErr } = await cur;
  if (readErr) return { ok: false, error: "load_failed" };

  const have = new Set((existing ?? []).map((r) => r.amenity_key as string));
  const want = new Set(keys);
  const toAdd = [...want].filter((k) => !have.has(k));
  const toRemove = [...have].filter((k) => !want.has(k));

  if (toAdd.length) {
    const { error } = await supabase.from("property_amenities").insert(
      toAdd.map((k) => ({
        property_id: propertyId,
        room_id: roomId,
        amenity_key: k,
      })),
    );
    if (error) return { ok: false, error: "save_failed" };
  }
  if (toRemove.length) {
    let del = supabase
      .from("property_amenities")
      .delete()
      .eq("property_id", propertyId)
      .in("amenity_key", toRemove);
    del = roomId ? del.eq("room_id", roomId) : del.is("room_id", null);
    const { error } = await del;
    if (error) return { ok: false, error: "save_failed" };
  }
  return { ok: true };
}

export type BuilderPhoto = { id: string; url: string };
export type BuilderGalleryProperty = {
  id: string;
  name: string;
  photos: BuilderPhoto[];
};

/**
 * Load the host's properties with their property-WIDE gallery photos (room_id null)
 * for the builder's "Edit photos" modal (Phase 4b-5). Host-scoped. The modal
 * uploads/deletes via the existing `createListingPhotoUploadUrl` /
 * `registerListingPhotoAction` / `deleteListingPhotoAction` (property_photos SSOT).
 */
export async function fetchBuilderGalleryAction(
  websiteId: string,
): Promise<
  | { ok: true; properties: BuilderGalleryProperty[] }
  | { ok: false; error: string }
> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return { ok: false, error: "not_owner" };

  const supabase = createServerClient();
  const { data: props, error } = await supabase
    .from("properties")
    .select("id, name")
    .eq("host_id", own.hostId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: "load_failed" };

  const propIds = (props ?? []).map((p) => p.id as string);
  const { data: photos } = await supabase
    .from("property_photos")
    .select("id, property_id, url")
    .in(
      "property_id",
      propIds.length ? propIds : ["00000000-0000-0000-0000-000000000000"],
    )
    .is("room_id", null)
    .order("sort_order", { ascending: true });
  const byProp = new Map<string, BuilderPhoto[]>();
  for (const ph of photos ?? []) {
    const list = byProp.get(ph.property_id as string) ?? [];
    list.push({ id: ph.id as string, url: ph.url as string });
    byProp.set(ph.property_id as string, list);
  }
  const properties: BuilderGalleryProperty[] = (props ?? []).map((p) => ({
    id: p.id as string,
    name: (p.name as string | null) ?? "Untitled property",
    photos: byProp.get(p.id as string) ?? [],
  }));
  return { ok: true, properties };
}

/**
 * Save the Builder V2 Brand Studio: the working theme (authoritative — replaces
 * `host_websites.theme`) + a brand-identity subset (merged into `brand` so logo/
 * contact/other socials are preserved). Owner-checked + feature-gated. Theme
 * surfaces live because pages read `theme` directly.
 */
export async function saveBuilderBrandAction(
  input: SaveBuilderBrandInput,
): Promise<ActionResult> {
  const parsed = saveBuilderBrandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, theme, brand } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("brand")
    .eq("id", websiteId)
    .maybeSingle<{ brand: Record<string, unknown> | null }>();

  // Merge the brand subset into the existing brand (preserve logo/contact/etc.).
  const curBrand = (row?.brand ?? {}) as Record<string, unknown>;
  const curSocials = (curBrand.socials ?? {}) as Record<string, string>;
  const socials = { ...curSocials };
  for (const [k, v] of Object.entries(brand.socials ?? {})) {
    if (v && v.trim()) socials[k] = v.trim();
    else delete socials[k];
  }
  const mergedBrand: Record<string, unknown> = { ...curBrand, socials };
  if (brand.name !== undefined) mergedBrand.name = brand.name;
  if (brand.tagline !== undefined) mergedBrand.tagline = brand.tagline;
  if (brand.monogram !== undefined) mergedBrand.monogram = brand.monogram;

  const { error } = await supabase
    .from("host_websites")
    .update({ brand: mergedBrand, theme })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/builder`);
  return { ok: true };
}

/**
 * Save the SITE-WIDE analytics/pixel IDs from the builder's Page Settings
 * Tracking tab. Merges into `settings.analytics` (preserving other settings), so
 * the same record drives every page. Owner-checked + feature-gated. Empty strings
 * clear an id. Pixels only inject on the public site (consent-gated in SiteMarketing).
 */
export async function saveBuilderAnalyticsAction(
  input: BuilderAnalyticsInput,
): Promise<ActionResult> {
  const parsed = builderAnalyticsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const {
    websiteId,
    ga4,
    metaPixel,
    gtm,
    tiktok,
    googleAds,
    cookieConsentEnabled,
    cookieConsentMessage,
    privacyHref,
  } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const cleanHref = (raw: string) => {
    const h = raw.trim();
    return /^(https?:\/\/|\/)/i.test(h) ? h : "";
  };

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("settings")
    .eq("id", websiteId)
    .maybeSingle<{ settings: Record<string, unknown> | null }>();

  const prevSettings = (row?.settings ?? {}) as Record<string, unknown>;
  const prevAnalytics = (prevSettings.analytics ?? {}) as Record<
    string,
    unknown
  >;
  const settings = {
    ...prevSettings,
    analytics: {
      ...prevAnalytics,
      ga4: ga4.trim().toUpperCase(),
      metaPixel: metaPixel.trim(),
      gtm: gtm.trim().toUpperCase(),
      tiktok: tiktok.trim().toUpperCase(),
      googleAds: googleAds.trim().toUpperCase(),
      cookieConsent: {
        enabled: cookieConsentEnabled,
        message: cookieConsentMessage.trim(),
        privacyHref: cleanHref(privacyHref),
      },
    },
  };

  const { error } = await supabase
    .from("host_websites")
    .update({ settings })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/builder`);
  return { ok: true };
}

/** Save the site navigation config (top bar, header CTA/behaviour, footer). */
export async function saveNavigationAction(
  input: SaveNavigationInput,
): Promise<ActionResult> {
  const parsed = saveNavigationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, navigation } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_websites")
    .update({ navigation })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}`);
  return { ok: true };
}

// Saved sections ("my blocks"), stored on host_websites.saved_sections (jsonb).
// An untyped client is used for that column so the SavedSection union (with its
// optional props) doesn't have to be forced through the generated `Json` type —
// the same pattern as the other jsonb writers in this file.
export async function saveSavedSectionAction(
  input: SaveSavedSectionInput,
): Promise<ActionResult> {
  const parsed = saveSavedSectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, name, section } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const sb = createServerClient() as unknown as SupabaseClient;
  const { data: row } = await sb
    .from("host_websites")
    .select("saved_sections")
    .eq("id", websiteId)
    .maybeSingle();
  const current = savedSectionsSchema
    .catch([])
    .parse((row as { saved_sections?: unknown } | null)?.saved_sections ?? []);
  const next = [{ id: uuid(), name, section }, ...current].slice(0, 50);

  const { error } = await sb
    .from("host_websites")
    .update({ saved_sections: next })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}`);
  return { ok: true };
}

export async function deleteSavedSectionAction(
  input: DeleteSavedSectionInput,
): Promise<ActionResult> {
  const parsed = deleteSavedSectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, id } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const sb = createServerClient() as unknown as SupabaseClient;
  const { data: row } = await sb
    .from("host_websites")
    .select("saved_sections")
    .eq("id", websiteId)
    .maybeSingle();
  const current = savedSectionsSchema
    .catch([])
    .parse((row as { saved_sections?: unknown } | null)?.saved_sections ?? []);
  const next = current.filter((s) => s.id !== id);

  const { error } = await sb
    .from("host_websites")
    .update({ saved_sections: next })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}`);
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

// ============================================================
// Phase 6 — Multi-page management (custom pages + nav)
// ============================================================

/** Starter sections for a new page, by template — so it never starts empty. */
/** Build a new page's starter sections from a template blueprint. newSection
 *  gives each a complete, valid props object (incl. tone). */
function templatePageSections(template: string) {
  const key = (
    template in PAGE_TEMPLATE_SECTIONS ? template : "blank"
  ) as PageTemplate;
  return PAGE_TEMPLATE_SECTIONS[key].map((type) => newSection(type));
}

/** Create a new custom page (optionally from a starter template) + open it. */
export async function createPageAction(
  input: CreatePageInput,
): Promise<CreateResult> {
  const parsed = createPageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, title, template } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: rows } = await supabase
    .from("website_pages")
    .select("slug, nav_order")
    .eq("website_id", websiteId);
  const taken = new Set((rows ?? []).map((r) => r.slug));
  const slug = uniqueSlug(title || "page", taken);
  const nextOrder =
    Math.max(0, ...(rows ?? []).map((r) => r.nav_order ?? 0)) + 1;

  const { data: page, error } = await supabase
    .from("website_pages")
    .insert({
      website_id: websiteId,
      kind: "custom",
      slug,
      title,
      nav_label: title,
      nav_order: nextOrder,
      show_in_nav: true,
      draft_sections: templatePageSections(template),
      published_sections: [],
    })
    .select("id")
    .single();
  if (error || !page) return { ok: false, error: "create_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/pages`);
  return { ok: true, id: page.id };
}

/** Delete a custom page. The Home page is protected (it anchors the site). */
export async function deletePageAction(
  websiteId: string,
  pageId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: page } = await supabase
    .from("website_pages")
    .select("kind")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle();
  if (!page) return { ok: false, error: "not_found" };
  if (page.kind === "home") return { ok: false, error: "cannot_delete_home" };

  const { error } = await supabase
    .from("website_pages")
    .delete()
    .eq("id", pageId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "delete_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/pages`);
  return { ok: true };
}

/**
 * Persist nav state for all pages — label, show-in-nav, and order (nav_order is
 * the array index, so the host's reorder sticks). Each update is scoped to the
 * owner's website. Changes appear on the public nav after Publish.
 */
export async function savePagesAction(
  input: SavePagesInput,
): Promise<ActionResult> {
  const parsed = savePagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, pages } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();

  // The home page is always pinned to nav_order 0 regardless of the submitted
  // order, so it can never be reordered out of first position.
  const { data: homeRow } = await supabase
    .from("website_pages")
    .select("id")
    .eq("website_id", websiteId)
    .eq("kind", "home")
    .maybeSingle();
  const ordered = [...pages];
  if (homeRow?.id) {
    const hi = ordered.findIndex((p) => p.id === homeRow.id);
    if (hi > 0) ordered.unshift(ordered.splice(hi, 1)[0]);
  }

  for (let i = 0; i < ordered.length; i += 1) {
    const p = ordered[i];
    const { error } = await supabase
      .from("website_pages")
      .update({
        nav_label: p.navLabel.trim() || null,
        show_in_nav: p.showInNav,
        nav_order: i,
      })
      .eq("id", p.id)
      .eq("website_id", websiteId);
    if (error) return { ok: false, error: "save_failed" };
  }

  revalidatePath(`/dashboard/website/${websiteId}/pages`);
  return { ok: true };
}

/** Save a page's SEO title/description overrides into website_pages.seo_overrides. */
export async function savePageSeoAction(
  input: SavePageSeoInput,
): Promise<ActionResult> {
  const parsed = savePageSeoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const {
    websiteId,
    pageId,
    title,
    description,
    focusKeyword,
    image,
    pixelEvent,
    headCode,
    noindex,
  } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: page } = await supabase
    .from("website_pages")
    .select("id, seo_overrides")
    .eq("id", pageId)
    .eq("website_id", websiteId)
    .maybeSingle();
  if (!page) return { ok: false, error: "not_found" };

  const seo = {
    ...((page.seo_overrides ?? {}) as Record<string, unknown>),
    title: title.trim() || undefined,
    description: description.trim() || undefined,
    focusKeyword: focusKeyword.trim() || undefined,
    image: image.trim() || undefined,
    pixelEvent: pixelEvent !== "none" ? pixelEvent : undefined,
    headCode: headCode.trim() || undefined,
    noindex: noindex || undefined,
  };

  const { error } = await supabase
    .from("website_pages")
    .update({ seo_overrides: seo })
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

// ============================================================
// Channel membership (rooms/properties auto-pull)
// ============================================================

/**
 * Reconcile the site's `website_properties` + `website_rooms` with the business's
 * current properties/rooms — pulls in anything added since and prunes membership
 * for rooms/properties that no longer exist; newly synced rows default to visible.
 *
 * There's no Rooms tab anymore: rooms are managed entirely under Properties and
 * pulled into the website automatically. This runs on publish (below) so the
 * frozen snapshot always reflects the host's current rooms.
 */
async function reconcileWebsiteRooms(
  supabase: ReturnType<typeof createServerClient>,
  websiteId: string,
): Promise<void> {
  const { data: site } = await supabase
    .from("host_websites")
    .select("business_id")
    .eq("id", websiteId)
    .maybeSingle();
  if (!site) return;

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

  // Go-live readiness gate (Builder × Theme plan, Phase 6). Publishing is the one
  // action the hard-required set blocks — a host can build/preview freely, but the
  // site can't go live (and start accepting bookings) until it has a name, a
  // bookable priced room, a payment method, a subdomain and a cancellation policy.
  // The UI surfaces the missing items; this is the server backstop.
  const readiness = await checkWebsiteReadiness(
    supabase,
    own.hostId,
    websiteId,
  );
  if (!readiness.ready) return { ok: false, error: "not_ready" };

  // Pull the business's current rooms/properties into channel membership before
  // snapshotting, so the live site always reflects what's managed under Properties.
  await reconcileWebsiteRooms(supabase, websiteId);

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

export type ReadinessActionResult =
  | { ok: true; ready: boolean; missing: ReadinessItem[] }
  | { ok: false; error: string };

/**
 * Go-live readiness for a site — the same SSOT the publish gate enforces, exposed
 * to the UI so the editor Publish button and the dashboard readiness card can show
 * exactly what's missing (with fix links) before the host hits the wall.
 */
export async function checkWebsiteReadinessAction(
  websiteId: string,
): Promise<ReadinessActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return { ok: false, error: own.error };
  const supabase = createServerClient();
  const report = await checkWebsiteReadiness(supabase, own.hostId, websiteId);
  return { ok: true, ready: report.ready, missing: report.missing };
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
 * Soft-delete a website. Sets `deleted_at` (the public resolver + dashboard list
 * both filter `deleted_at IS NULL`, so the site immediately stops resolving and
 * disappears from the host's list) and unpublishes it. The row + its pages/forms
 * are retained for recovery; we never hard-delete `host_websites` (AGENT_RULES).
 */
export async function deleteWebsiteAction(
  websiteId: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("host_websites")
    .update({
      deleted_at: new Date().toISOString(),
      status: "unpublished",
    })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website`);
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
  const { websiteId, rooms, properties } = parsed.data;

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
    featured: r.featured,
    badge: r.badge.trim() || null,
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

  // Per-property display overrides (group heading/intro/hero). Validate every
  // property belongs to this website's business before writing (anti-tamper).
  if (properties.length > 0) {
    const propIds = properties.map((p) => p.propertyId);
    const { data: ownedProps } = await supabase
      .from("properties")
      .select("id")
      .in("id", propIds)
      .eq("business_id", site.business_id)
      .is("deleted_at", null);
    const ownedSet = new Set((ownedProps ?? []).map((p) => p.id));
    if (propIds.some((id) => !ownedSet.has(id))) {
      return { ok: false, error: "invalid" };
    }
    for (const p of properties) {
      const overrides = {
        heading: p.heading.trim() || undefined,
        intro: p.intro.trim() || undefined,
        hero_path: p.heroPath.trim() || undefined,
      };
      const { error } = await supabase
        .from("website_properties")
        .update({ display_overrides: overrides })
        .eq("website_id", websiteId)
        .eq("property_id", p.propertyId);
      if (error) return { ok: false, error: "save_failed" };
    }
  }

  revalidatePath(`/dashboard/website/${websiteId}/rooms`);
  return { ok: true };
}

// ============================================================
// Media manager — alt edit + per-room media overrides
// ============================================================

/** Update (or set) the alt text of a media asset (owner-scoped). */
export async function updateWebsiteMediaAltAction(
  websiteId: string,
  storagePath: string,
  alt: string,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!storagePath.startsWith(`${websiteId}/`)) {
    return { ok: false, error: "invalid_path" };
  }
  const supabase = createServerClient();
  // Upsert: the row may not exist yet (legacy uploads only in storage).
  const { error } = await supabase
    .from("website_media")
    .upsert(
      { website_id: websiteId, path: storagePath, alt: alt.trim() || null },
      { onConflict: "website_id,path" },
    );
  if (error) return { ok: false, error: "save_failed" };
  revalidatePath(`/dashboard/website/${websiteId}/media`);
  return { ok: true };
}

/**
 * Save a room's media overrides for the room-detail page (hidden photo ids +
 * extra images). Verifies the room belongs to the website's business, and that
 * extra image paths live under this website's asset prefix (anti-tamper).
 */
export async function saveRoomMediaOverridesAction(
  websiteId: string,
  roomId: string,
  overrides: { hidden: string[]; extra: { path: string; alt?: string }[] },
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const parsed = roomMediaOverridesSchema.safeParse(overrides);
  if (!parsed.success) return { ok: false, error: "invalid" };
  // Extra images must be this website's own assets.
  if (parsed.data.extra.some((e) => !e.path.startsWith(`${websiteId}/`))) {
    return { ok: false, error: "invalid_path" };
  }

  const supabase = createServerClient();
  const { data: site } = await supabase
    .from("host_websites")
    .select("business_id")
    .eq("id", websiteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "not_found" };

  // The room must belong to this business AND already be a channel member.
  const { data: owned } = await supabase
    .from("property_rooms")
    .select("id, property:properties!inner ( business_id )")
    .eq("id", roomId)
    .is("deleted_at", null)
    .maybeSingle();
  const ownerBiz = (
    owned?.property as unknown as { business_id: string } | null
  )?.business_id;
  if (!owned || ownerBiz !== site.business_id) {
    return { ok: false, error: "invalid" };
  }

  const { error } = await supabase
    .from("website_rooms")
    .update({ media_overrides: parsed.data })
    .eq("website_id", websiteId)
    .eq("room_id", roomId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/media`);
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
/**
 * The default blog author for a site: the host themselves. Returns the id of the
 * site's first author (lowest sort_order) if any exist; otherwise seeds one from
 * the host's public profile (display name + avatar + bio) so every new post is
 * bylined to the host by default. Returns null only when the host has no usable
 * profile name yet (so we leave the post author-less rather than create a blank
 * author). The host can add/rename/replace authors in the blog manager afterwards.
 */
async function ensureHostAuthor(
  supabase: ReturnType<typeof createServerClient>,
  websiteId: string,
  hostId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("website_blog_authors")
    .select("id")
    .eq("website_id", websiteId)
    .order("sort_order", { ascending: true })
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id;

  const { data: host } = await supabase
    .from("hosts")
    .select("display_name, avatar_url, bio")
    .eq("id", hostId)
    .maybeSingle();
  const name = host?.display_name?.trim();
  if (!name) return null;

  const { data: created } = await supabase
    .from("website_blog_authors")
    .insert({
      website_id: websiteId,
      name,
      // hosts.avatar_url is an absolute URL; websiteAssetUrl passes it through.
      avatar_path: host?.avatar_url?.trim() || null,
      bio: host?.bio?.trim() || null,
      sort_order: 0,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function createBlogPostAction(
  websiteId: string,
): Promise<CreateResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId, "website_blog")))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const slug = await uniquePostSlug(supabase, websiteId, "untitled-post");
  // Default the byline to the host (seeding a host author on the first post).
  const authorId = await ensureHostAuthor(supabase, websiteId, own.hostId);

  const { data: post, error } = await supabase
    .from("website_blog_posts")
    .insert({
      website_id: websiteId,
      title: "Untitled post",
      slug,
      status: "draft",
      author_id: authorId,
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
    featured,
    publishAt: publishAtInput,
    coverPath,
    excerpt,
    bodyHtml,
    authorId,
    tags,
    seoTitle,
    seoDescription,
    seoFocusKeyword,
    headCode,
    pixelEvent,
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

  // An author, if set, must belong to this website (anti-tamper).
  if (authorId) {
    const { data: author } = await supabase
      .from("website_blog_authors")
      .select("id")
      .eq("id", authorId)
      .eq("website_id", websiteId)
      .maybeSingle();
    if (!author) return { ok: false, error: "invalid" };
  }

  // A published/scheduled post must carry an author. Default to the host — seed
  // the host author from their profile if none is set — and only block when the
  // host has no profile name to seed from.
  let finalAuthorId = authorId || null;
  if ((status === "published" || status === "scheduled") && !finalAuthorId) {
    finalAuthorId = await ensureHostAuthor(supabase, websiteId, own.hostId);
    if (!finalAuthorId) return { ok: false, error: "author_required" };
  }

  const desiredSlug = slugify(slug || title);
  const finalSlug = await uniquePostSlug(
    supabase,
    websiteId,
    desiredSlug,
    postId,
  );

  // publish_at resolution:
  //   • scheduled → the chosen future time (validated); the cron worker flips it
  //     to 'published' once it's due.
  //   • published → stamp now() on first publish, else keep the existing time.
  //   • draft     → keep whatever was there.
  let publishAt: string | null = post.publish_at;
  if (status === "scheduled") {
    const when = new Date(publishAtInput);
    if (!publishAtInput || Number.isNaN(when.getTime())) {
      return { ok: false, error: "invalid_schedule" };
    }
    publishAt = when.toISOString();
  } else if (status === "published" && !post.publish_at) {
    publishAt = new Date().toISOString();
  }

  // Auto-excerpt: if the host left it blank, derive one from the body so blog
  // previews + search snippets aren't empty.
  const finalExcerpt = excerpt.trim() || deriveExcerpt(bodyHtml);

  const { error } = await supabase
    .from("website_blog_posts")
    .update({
      title,
      slug: finalSlug,
      category_id: categoryId || null,
      status,
      featured,
      publish_at: publishAt,
      cover_path: coverPath || null,
      excerpt: finalExcerpt || null,
      body_html: bodyHtml || null,
      author_id: finalAuthorId,
      seo: {
        title: seoTitle || undefined,
        description: seoDescription || undefined,
        focusKeyword: seoFocusKeyword || undefined,
        headCode: headCode || undefined,
        pixelEvent: pixelEvent !== "none" ? pixelEvent : undefined,
      },
    })
    .eq("id", postId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  // Tags — find-or-create by slug per website, then replace the post↔tag join.
  // Dedupe by slug so "Surf" and "surf" collapse to one tag.
  const bySlug = new Map<string, string>();
  for (const raw of tags) {
    const name = raw.trim();
    if (!name) continue;
    const tagSlug = slugify(name);
    if (tagSlug && !bySlug.has(tagSlug)) bySlug.set(tagSlug, name);
  }
  let tagIds: string[] = [];
  if (bySlug.size > 0) {
    const { data: tagRows } = await supabase
      .from("website_blog_tags")
      .upsert(
        [...bySlug].map(([tagSlug, name]) => ({
          website_id: websiteId,
          name,
          slug: tagSlug,
        })),
        { onConflict: "website_id,slug" },
      )
      .select("id");
    tagIds = (tagRows ?? []).map((r) => r.id);
  }
  // Replace the join rows for this post (delete-all then insert the current set).
  await supabase.from("website_blog_post_tags").delete().eq("post_id", postId);
  if (tagIds.length > 0) {
    await supabase
      .from("website_blog_post_tags")
      .insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
  }

  revalidatePath(`/dashboard/website/${websiteId}/blog`);
  revalidatePath(`/dashboard/website/${websiteId}/blog/${postId}`);
  return { ok: true };
}

/** Strip HTML + collapse whitespace into a ~160-char plain-text excerpt. */
function deriveExcerpt(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 160) return text;
  return text.slice(0, 157).trimEnd() + "…";
}

/** Pin/unpin a post as the blog hero (quick toggle from the list). */
export async function setBlogFeaturedAction(
  websiteId: string,
  postId: string,
  featured: boolean,
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId, "website_blog")))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("website_blog_posts")
    .update({ featured })
    .eq("id", postId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/blog`);
  return { ok: true };
}

/**
 * Reconcile a site's reusable blog authors: upsert the submitted set (existing
 * rows by id, new rows inserted) and delete any author the host removed. Posts
 * referencing a deleted author are set author-less by the FK's ON DELETE SET NULL.
 */
export async function saveBlogAuthorsAction(
  input: SaveBlogAuthorsInput,
): Promise<ActionResult> {
  const parsed = saveBlogAuthorsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, authors } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId, "website_blog")))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("website_blog_authors")
    .select("id")
    .eq("website_id", websiteId);
  const existingIds = new Set((existing ?? []).map((a) => a.id));

  const keptIds = new Set(
    authors.map((a) => a.id).filter((id): id is string => Boolean(id)),
  );
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    await supabase.from("website_blog_authors").delete().in("id", toDelete);
  }

  let order = 0;
  for (const a of authors) {
    const row = {
      name: a.name,
      avatar_path: a.avatarPath.trim() || null,
      bio: a.bio.trim() || null,
      sort_order: order,
    };
    if (a.id && existingIds.has(a.id)) {
      const { error } = await supabase
        .from("website_blog_authors")
        .update(row)
        .eq("id", a.id)
        .eq("website_id", websiteId);
      if (error) return { ok: false, error: "save_failed" };
    } else {
      const { error } = await supabase
        .from("website_blog_authors")
        .insert({ website_id: websiteId, ...row });
      if (error) return { ok: false, error: "save_failed" };
    }
    order += 1;
  }

  revalidatePath(`/dashboard/website/${websiteId}/blog`);
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
// Dedicated, isolated setter for the site-width layout. Kept SEPARATE from
// saveWebsiteSettingsAction so the builder can flip it without sending the whole
// settings payload (and so the big settings save never clobbers it). Merges only
// `settings.layout` into the jsonb. Editing it marks the site dirty for republish
// (buildWebsiteSnapshot freezes settings.layout).
export async function setWebsiteLayoutAction(
  websiteId: string,
  layout: "full" | "boxed",
): Promise<ActionResult> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const mode = layout === "boxed" ? "boxed" : "full";
  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("settings")
    .eq("id", websiteId)
    .maybeSingle();
  const settings = {
    ...((row?.settings ?? {}) as Record<string, unknown>),
    layout: mode,
  };
  const { error } = await supabase
    .from("host_websites")
    .update({ settings })
    .eq("id", websiteId);
  if (error) return { ok: false, error: "save_failed" };
  revalidatePath(`/dashboard/website/${websiteId}/settings`);
  return { ok: true };
}

/**
 * Persist one room's per-room detail overrides (the host's customization layered
 * over the shared room_detail template). Owner + feature gated; the room must
 * belong to this website (anti-tamper). An empty override is stored as NULL so a
 * room that's been reset to the template carries no stale blob.
 */
export async function saveRoomDetailOverrideAction(
  input: SaveRoomDetailOverrideInput,
): Promise<ActionResult> {
  const parsed = saveRoomDetailOverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, roomId, override } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  // The room must already be a member of this website (website_rooms row).
  const { data: row } = await supabase
    .from("website_rooms")
    .select("id")
    .eq("website_id", websiteId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };

  const { error } = await supabase
    .from("website_rooms")
    .update({ detail_overrides: hasRoomOverride(override) ? override : null })
    .eq("id", row.id);
  if (error) return { ok: false, error: "save_failed" };
  return { ok: true };
}

export async function saveWebsiteSettingsAction(
  input: WebsiteSettingsInput,
): Promise<ActionResult> {
  const parsed = websiteSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const {
    websiteId,
    brandName,
    brandTagline,
    enquiryEmailEnabled,
    enquiryEmailTo,
    payPaystackEnabled,
    payEftEnabled,
    whatsappEnabled,
    whatsappNumber,
    whatsappMessage,
    announcementEnabled,
    announcementText,
    announcementLinkLabel,
    announcementLinkHref,
    popupEnabled,
    popupHeading,
    popupBody,
    popupTrigger,
    popupDelaySeconds,
    popupScrollPercent,
    popupFrequency,
    popupCtaLabel,
    popupCtaHref,
    popupFormId,
    ga4MeasurementId,
    metaPixelId,
    gtmId,
    tiktokId,
    googleAdsId,
    cookieConsentEnabled,
    cookieConsentMessage,
    privacyPolicyHref,
    blogHeading,
    blogIntro,
  } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  // Only keep an http(s) or site-internal href — never a `javascript:`/`data:`
  // scheme (announcement CTA + pop-up CTA share this guard).
  const cleanHref = (raw: string) => {
    const h = raw.trim();
    return /^(https?:\/\/|\/)/i.test(h) ? h : "";
  };
  const safeHref = cleanHref(announcementLinkHref);

  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("host_websites")
    .select("settings, brand")
    .eq("id", websiteId)
    .maybeSingle();
  // Site identity lives in the `brand` jsonb (Brand Studio's home). Merge in the
  // quick-edited name/tagline without disturbing the rest of brand. A blank name
  // is ignored so the host can't accidentally wipe their site name.
  const prevBrand = (row?.brand ?? {}) as Record<string, unknown>;
  const brand = {
    ...prevBrand,
    name: brandName.trim() || (prevBrand.name as string | undefined),
    tagline: brandTagline.trim() || undefined,
  };
  const settings = {
    ...((row?.settings ?? {}) as Record<string, unknown>),
    enquiry: {
      emailEnabled: enquiryEmailEnabled,
      emailTo: enquiryEmailTo.trim().toLowerCase(),
    },
    payments: {
      paystack: payPaystackEnabled,
      eft: payEftEnabled,
    },
    conversion: {
      whatsapp: {
        enabled: whatsappEnabled,
        number: whatsappNumber.trim(),
        message: whatsappMessage.trim(),
      },
      announcement: {
        enabled: announcementEnabled,
        text: announcementText.trim(),
        linkLabel: announcementLinkLabel.trim(),
        linkHref: safeHref,
      },
      popup: {
        enabled: popupEnabled,
        heading: popupHeading.trim(),
        body: popupBody.trim(),
        trigger: popupTrigger,
        delaySeconds: popupDelaySeconds,
        scrollPercent: popupScrollPercent,
        frequency: popupFrequency,
        ctaLabel: popupCtaLabel.trim(),
        ctaHref: cleanHref(popupCtaHref),
        formId: popupFormId,
      },
    },
    analytics: {
      ...(((row?.settings as { analytics?: Record<string, unknown> } | null)
        ?.analytics ?? {}) as Record<string, unknown>),
      ga4: ga4MeasurementId.trim().toUpperCase(),
      metaPixel: metaPixelId.trim(),
      gtm: gtmId.trim().toUpperCase(),
      tiktok: tiktokId.trim().toUpperCase(),
      googleAds: googleAdsId.trim().toUpperCase(),
      cookieConsent: {
        enabled: cookieConsentEnabled,
        message: cookieConsentMessage.trim(),
        privacyHref: cleanHref(privacyPolicyHref),
      },
    },
    blog: {
      heading: blogHeading.trim(),
      intro: blogIntro.trim(),
    },
  };

  const { error } = await supabase
    .from("host_websites")
    .update({ settings, brand })
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

// ── Forms (Phase 4 — form builder) ────────────────────────────
// Owner + feature gated like every other CMS write. A form is created empty
// (name + type); the builder edits fields/settings via saveWebsiteFormAction.
// Soft-delete (deleted_at) so existing submissions keep a parent row.

export async function createWebsiteFormAction(
  input: CreateWebsiteFormInput,
): Promise<CreateResult> {
  const parsed = createWebsiteFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, name, type, template } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  // Seed from a starter template when one is named — fields get a fresh uuid
  // each, and the form's type comes from the template. Otherwise an empty form.
  const tpl = template ? FORM_TEMPLATES[template] : undefined;
  const formType: FormType = tpl?.type ?? type;
  const fields: FormField[] = (tpl?.fields ?? []).map((f) => ({
    ...f,
    id: uuid(),
  }));
  const settings = tpl?.settings ?? {};

  const supabase = createServerClient();
  const { data: form, error } = await supabase
    .from("website_forms")
    .insert({ website_id: websiteId, name, type: formType, fields, settings })
    .select("id")
    .single();
  if (error || !form) return { ok: false, error: "create_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/forms`);
  return { ok: true, id: form.id };
}

export async function saveWebsiteFormAction(
  input: SaveWebsiteFormInput,
): Promise<ActionResult> {
  const parsed = saveWebsiteFormSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid",
    };
  const { websiteId, formId, name, type, fields, settings } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  // Normalise: the host-edited choice fields (select/radio/checkboxes) keep their
  // options minus empties; `rooms` is auto-filled and every other type carries no
  // choices, so drop the list there.
  const cleanFields = fields.map((f) => ({
    ...f,
    options:
      f.type === "select" || f.type === "radio" || f.type === "checkboxes"
        ? (f.options ?? []).filter((o) => o.trim().length > 0)
        : undefined,
  }));

  const supabase = createServerClient();
  const { error } = await supabase
    .from("website_forms")
    .update({ name, type, fields: cleanFields, settings })
    .eq("id", formId)
    .eq("website_id", websiteId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/forms`);
  return { ok: true };
}

/**
 * Clone a form (fields + settings, same type) under a "(copy)" name. The copy
 * starts with no embeds and no submissions — it's a fresh form the host can
 * tweak. Owner + feature gated like every other CMS write.
 */
export async function duplicateWebsiteFormAction(
  input: DuplicateWebsiteFormInput,
): Promise<CreateResult> {
  const parsed = duplicateWebsiteFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, formId } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();
  const { data: src } = await supabase
    .from("website_forms")
    .select("name, type, fields, settings")
    .eq("id", formId)
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!src) return { ok: false, error: "not_found" };

  const copyName = `${src.name} (copy)`.slice(0, 120);
  const { data: form, error } = await supabase
    .from("website_forms")
    .insert({
      website_id: websiteId,
      name: copyName,
      type: src.type,
      fields: src.fields ?? [],
      settings: src.settings ?? {},
    })
    .select("id")
    .single();
  if (error || !form) return { ok: false, error: "create_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/forms`);
  return { ok: true, id: form.id };
}

/** A form option for the page-builder form picker (id + name + type). */
export type WebsiteFormOption = { id: string; name: string; type: FormType };

export type WebsitePropertyOption = { id: string; name: string };

/**
 * List the site's visible properties for the booking-funnel section pickers
 * (booking_search / availability_calendar). Owner-scoped; mirrors the channel
 * membership the public funnel quotes against.
 */
export async function listWebsiteBookablePropertiesAction(
  websiteId: string,
): Promise<
  | { ok: true; properties: WebsitePropertyOption[] }
  | { ok: false; error: string }
> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data } = await supabase
    .from("website_properties")
    .select("property_id, properties ( name )")
    .eq("website_id", websiteId)
    .eq("is_visible", true);
  const properties: WebsitePropertyOption[] = (data ?? []).map((r) => {
    const row = r as {
      property_id: string;
      properties: { name: string | null } | { name: string | null }[] | null;
    };
    const prop = Array.isArray(row.properties)
      ? row.properties[0]
      : row.properties;
    return { id: row.property_id, name: prop?.name?.trim() || "Property" };
  });
  return { ok: true, properties };
}

/** List the site's forms for the `form` section picker (owner-scoped). */
export async function listWebsiteFormsAction(
  websiteId: string,
): Promise<
  { ok: true; forms: WebsiteFormOption[] } | { ok: false; error: string }
> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { data } = await supabase
    .from("website_forms")
    .select("id, name, type")
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return {
    ok: true,
    forms: (data ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type as FormType,
    })),
  };
}

/**
 * Load one form's full editor payload (type + name + fields + settings, plus the
 * subdomain and live room names) for editing INLINE in the page builder — the
 * same data the full-screen form editor page loads, but callable from the client
 * so a `form` section can open the editor in a modal without navigating away.
 */
export async function getWebsiteFormForEditorAction(
  websiteId: string,
  formId: string,
): Promise<
  | {
      ok: true;
      form: {
        type: FormType;
        name: string;
        fields: FormField[];
        settings: FormSettings;
      };
      subdomain: string;
      roomNames: string[];
      themeVars: CSSProperties;
    }
  | { ok: false; error: string }
> {
  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const data = await loadFormsEditor(websiteId);
  if (!data) return { ok: false, error: "not_found" };
  const form = data.forms.find((f) => f.id === formId);
  if (!form) return { ok: false, error: "not_found" };

  const roomNames = await loadWebsiteRoomNames(websiteId);
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";
  return {
    ok: true,
    form: {
      type: form.type,
      name: form.name,
      fields: form.fields,
      settings: form.settings,
    },
    subdomain: `${data.subdomain}.${root}`,
    roomNames,
    themeVars: data.themeVars,
  };
}

/** Update a submission's status (read / archived / restored-to-new / spam). */
export async function setSubmissionStatusAction(
  input: SetSubmissionStatusInput,
): Promise<ActionResult> {
  const parsed = setSubmissionStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, submissionId, status } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;

  const supabase = createServerClient();
  const { error } = await supabase
    .from("website_form_submissions")
    .update({ status })
    .eq("id", submissionId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "save_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/forms/responses`);
  return { ok: true };
}

export async function deleteWebsiteFormAction(
  input: DeleteWebsiteFormInput,
): Promise<ActionResult> {
  const parsed = deleteWebsiteFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { websiteId, formId } = parsed.data;

  const own = await assertWebsiteOwnership(websiteId);
  if (!own.ok) return own;
  if (!(await assertWebsiteFeature(own.hostId)))
    return { ok: false, error: "locked" };

  const supabase = createServerClient();

  // Default forms are never-delete — the host can edit them, but they back the
  // auto-placed sections, so removing one would break the site. (The UI hides
  // delete for these; this is the server-side guard.)
  const { data: existing } = await supabase
    .from("website_forms")
    .select("is_default")
    .eq("id", formId)
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing?.is_default) return { ok: false, error: "default_form" };

  const { error } = await supabase
    .from("website_forms")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", formId)
    .eq("website_id", websiteId);
  if (error) return { ok: false, error: "delete_failed" };

  revalidatePath(`/dashboard/website/${websiteId}/forms`);
  return { ok: true };
}
