// Account-derived content fallbacks — the single source of truth for the values
// a host's website can pull from their existing account when a Content Profile
// slot is empty. Used in TWO places so the wizard-seeded site and the live
// render agree on what "the host's real content" is:
//
//   1. SEED (dashboard/website/actions.ts) — passed into `seedWebsiteContent`
//      so the hydrated PageDoc that GENERIC themes render is populated with real
//      data instead of the theme's demo copy.
//   2. RENDER (components/site/SitePageView.tsx) — BESPOKE themes read the
//      Content Profile directly and bypass the seeded PageDoc, so the same
//      fallbacks are merged into the effective profile at render time. Computing
//      (not storing) them keeps the fallback FRESH when the host later edits
//      their property description / photos, and avoids polluting the canonical
//      profile with derived data.
//
// Best-effort: any read failure yields a partial (or empty) DerivedContent — the
// caller simply keeps the theme's demo copy for the missing slots.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentProfile, DerivedContent } from "./contentProfile.schema";

/**
 * Compute the account-derived content fallbacks for a business's website.
 * Mirrors the account-derived fallback pattern the public loader applies for
 * live sections (`assembleSiteDataByType` in `lib/site/loadSitePage.ts`):
 *   • hostName / hostPhotoPath   ← the owning host profile (fallback: account)
 *   • propertyDescription        ← the business's primary property
 *   • heroPhotoPath              ← the primary property's first photo
 *   • policiesFaq                ← the property's cancellation / check-in / rules
 *
 * "Primary property" = the business's oldest (non-deleted) property, matching how
 * `seedWebsiteContent` picks the channel set (default order → sort_order 0).
 */
export async function buildDerivedContent(
  supabase: SupabaseClient,
  opts: { businessId: string },
): Promise<DerivedContent> {
  const derived: DerivedContent = {};
  try {
    // Owning host — `businesses.host_id` → `hosts.id`. display_name is NOT NULL
    // on `hosts`, so it's the primary source; fall back to the linked account
    // profile only if it's ever blank.
    const { data: biz } = await supabase
      .from("businesses")
      .select("host_id")
      .eq("id", opts.businessId)
      .maybeSingle<{ host_id: string | null }>();
    if (biz?.host_id) {
      const { data: hostRow } = await supabase
        .from("hosts")
        .select("user_id, display_name, avatar_url, bio")
        .eq("id", biz.host_id)
        .maybeSingle<{
          user_id: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
        }>();
      let hostName = hostRow?.display_name?.trim() || "";
      let hostPhoto = hostRow?.avatar_url?.trim() || "";
      const hostBio = hostRow?.bio?.trim();
      if (hostBio) derived.hostBio = hostBio;
      if ((!hostName || !hostPhoto) && hostRow?.user_id) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("full_name, avatar_url")
          .eq("id", hostRow.user_id)
          .maybeSingle<{
            full_name: string | null;
            avatar_url: string | null;
          }>();
        hostName = hostName || profile?.full_name?.trim() || "";
        hostPhoto = hostPhoto || profile?.avatar_url?.trim() || "";
      }
      if (hostName) derived.hostName = hostName;
      if (hostPhoto) derived.hostPhotoPath = hostPhoto;
    }

    // Primary property — first of the business's live properties (default order).
    const { data: prop } = await supabase
      .from("properties")
      .select(
        "id, description, check_in_time, check_out_time, house_rules, cancellation_policy_label",
      )
      .eq("business_id", opts.businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{
        id: string;
        description: string | null;
        check_in_time: string | null;
        check_out_time: string | null;
        house_rules: string | null;
        cancellation_policy_label: string | null;
      }>();
    if (prop) {
      const desc = prop.description?.trim();
      if (desc) derived.propertyDescription = desc;

      // Hero photo — the property's first photo by sort order. `property_photos.url`
      // is an absolute URL, which `websiteAssetUrl` passes through unchanged.
      const { data: photo } = await supabase
        .from("property_photos")
        .select("url")
        .eq("property_id", prop.id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle<{ url: string | null }>();
      const heroUrl = photo?.url?.trim();
      if (heroUrl) derived.heroPhotoPath = heroUrl;

      // Policies FAQ — a small, real Q&A the Contact page's FAQ section binds to
      // (contact.faq → derive: d.policiesFaq). Each line is only included when
      // the host has actually set that policy.
      const faq: { q: string; a: string }[] = [];
      const cancel = prop.cancellation_policy_label?.trim();
      if (cancel)
        faq.push({ q: "What is your cancellation policy?", a: cancel });
      const checkIn = fmtTime(prop.check_in_time);
      const checkOut = fmtTime(prop.check_out_time);
      if (checkIn || checkOut) {
        const parts: string[] = [];
        if (checkIn) parts.push(`Check-in is from ${checkIn}.`);
        if (checkOut) parts.push(`Check-out is by ${checkOut}.`);
        faq.push({
          q: "What are your check-in and check-out times?",
          a: parts.join(" "),
        });
      }
      const rules = prop.house_rules?.trim();
      if (rules) faq.push({ q: "Are there any house rules?", a: rules });
      if (faq.length > 0) derived.policiesFaq = faq;
    }
  } catch {
    // Derived fallbacks are additive polish — never block on them.
  }
  return derived;
}

/** Format a `HH:MM(:SS)` time to `HH:MM` (or null when absent). */
function fmtTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return h && m ? `${h.padStart(2, "0")}:${m}` : t.trim();
}

const isBlank = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim().length === 0) ||
  (Array.isArray(v) && v.length === 0);

/**
 * Merge account-derived fallbacks into a Content Profile's EMPTY canonical slots,
 * returning a new effective profile (the input is never mutated). This lets
 * bespoke themes — which read the profile directly — show the host's real data
 * instead of demo copy.
 *
 * IMPORTANT — only the "safe" slots are derived here: hero image, host photo, and
 * contact FAQ. The long-form `propertyDescription` is deliberately NOT merged into
 * `about.story` / `home.intro.body`, because several bespoke themes render the
 * `story` slot as a large DISPLAY HEADING (a short one-line editorial statement,
 * e.g. Safari's "Wake to the wild…"). Dropping a full multi-sentence property
 * description into that slot blows up into a giant heading that breaks the layout.
 * Those slots keep the theme's short curated fallback here; the SEED path still
 * derives them for GENERIC themes, which render them as body copy where length is
 * fine (see SLOT_BINDINGS + hydrateProfile). A filled slot always wins.
 */
export function mergeDerivedProfile(
  profile: ContentProfile,
  derived: DerivedContent,
): ContentProfile {
  const p: ContentProfile = structuredClone(profile);

  if (isBlank(p.home?.hero?.imagePath) && derived.heroPhotoPath) {
    p.home = {
      ...p.home,
      hero: { ...p.home?.hero, imagePath: derived.heroPhotoPath },
    };
  }
  if (isBlank(p.about?.hostBio?.photoPath) && derived.hostPhotoPath) {
    p.about = {
      ...p.about,
      hostBio: { ...p.about?.hostBio, photoPath: derived.hostPhotoPath },
    };
  }
  if (isBlank(p.about?.hostBio?.body) && derived.hostBio) {
    p.about = {
      ...p.about,
      hostBio: { ...p.about?.hostBio, body: derived.hostBio },
    };
  }
  if (isBlank(p.contact?.faq) && derived.policiesFaq?.length) {
    p.contact = { ...p.contact, faq: derived.policiesFaq };
  }
  return p;
}

/** True when every profile slot that the render-path merge can fill is already
 *  set — so the render path can skip the derive DB reads entirely. Mirrors the
 *  slots `mergeDerivedProfile` actually touches (NOT story/intro — see there). */
function allDerivableSlotsFilled(p: ContentProfile): boolean {
  return (
    !isBlank(p.home?.hero?.imagePath) &&
    !isBlank(p.about?.hostBio?.photoPath) &&
    !isBlank(p.about?.hostBio?.body) &&
    !isBlank(p.contact?.faq)
  );
}

/**
 * Resolve the EFFECTIVE Content Profile for a live/preview render: parse the
 * stored profile and merge account-derived fallbacks into its empty slots, so
 * bespoke themes never fall through to demo copy when the host's real data is
 * available. Short-circuits the derive DB reads when nothing is missing.
 */
export async function resolveEffectiveProfile(
  supabase: SupabaseClient,
  businessId: string,
  profile: ContentProfile,
): Promise<ContentProfile> {
  if (allDerivableSlotsFilled(profile)) return profile;
  const derived = await buildDerivedContent(supabase, { businessId });
  return mergeDerivedProfile(profile, derived);
}
