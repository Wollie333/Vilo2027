import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_ACTIVE_LOOKING_FOR_POSTS } from "@/lib/looking-for/limits";
import { notifyMatchingAlerts } from "@/lib/looking-for/matchAlerts";
import { replacePostRequirements } from "@/lib/looking-for/writeRequirements";
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";

// The ONE writer for a new Looking-For post. Shared by the authenticated portal
// action (createRequestAction) and the public post-first funnel endpoint
// (createRequestPublic) so both mint an identical row + activity log +
// requirements + real-time host alerting. Takes an admin/service-role client and
// an explicit guestId — the caller is responsible for having established WHO the
// guest is (a verified session, or a find-or-create lead identity). The DB cap
// trigger (trg_looking_for_post_cap) is the authoritative 3-active guard; a
// friendly pre-check lives in each caller.

export type LookingForPostInput = {
  title: string;
  description?: string;
  category: string;
  check_in_date?: string;
  check_out_date?: string;
  date_flexibility_days?: number;
  adults: number;
  children: number;
  infants: number;
  child_ages?: number[];
  pets?: number;
  location_text?: string;
  location_region?: string;
  location_lat?: number;
  location_lng?: number;
  search_radius_km?: number;
  destination_flexible?: boolean;
  budget_min?: number;
  budget_max?: number;
  budget_per?: string;
  is_urgent: boolean;
  is_public: boolean;
  quote_deadline?: string;
  min_host_rating?: number;
  image_url?: string | null;
  requirement_keys?: string[];
};

export const CAP_REACHED_MESSAGE = `You can have up to ${MAX_ACTIVE_LOOKING_FOR_POSTS} active requests at a time. Close or fulfil one to post another.`;

export type InsertPostResult = { id: string } | { id: null; error: string };

/**
 * Insert a Looking-For post, log the guest activity, save the requirement
 * selections, and fire real-time host alerts. Best-effort on alerting (never
 * throws into the caller). Returns the new id, or a friendly error string.
 */
export async function insertLookingForPost(
  admin: SupabaseClient,
  guestId: string,
  input: LookingForPostInput,
): Promise<InsertPostResult> {
  // 30-day expiry (mirrored by the DB trigger).
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data: post, error } = await admin
    .from("looking_for_posts")
    .insert({
      guest_id: guestId,
      title: input.title,
      description: input.description
        ? sanitiseListingHtml(input.description)
        : null,
      category: input.category,
      check_in_date: input.check_in_date || null,
      check_out_date: input.check_out_date || null,
      date_flexibility_days: input.date_flexibility_days ?? 0,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      child_ages:
        input.child_ages && input.child_ages.length > 0
          ? input.child_ages
          : null,
      pets: input.pets ?? null,
      location_text: input.location_text || null,
      location_region: input.location_region || null,
      location_lat: input.location_lat ?? null,
      location_lng: input.location_lng ?? null,
      search_radius_km: input.search_radius_km ?? null,
      destination_flexible: input.destination_flexible ?? false,
      budget_min: input.budget_min || null,
      budget_max: input.budget_max || null,
      budget_currency: "ZAR",
      budget_per: input.budget_per || null,
      is_urgent: input.is_urgent,
      is_public: input.is_public,
      status: "active",
      expires_at: expiresAt.toISOString(),
      quote_deadline: input.quote_deadline || null,
      min_host_rating: input.min_host_rating || null,
      image_url: input.image_url || null,
    })
    .select("id")
    .single();

  if (error) {
    // The DB cap trigger raises this on a race past the caller's count check.
    if (error.message?.includes("looking_for_post_cap_reached")) {
      return { id: null, error: CAP_REACHED_MESSAGE };
    }
    console.error("[looking-for] insert failed", error);
    return { id: null, error: error.message };
  }

  // Record the guest activity log. A failure here is a real bug (it silently
  // left looking_for_usage empty for a day once) — surface it and roll back the
  // orphaned post rather than let the platform lie about what it recorded.
  const { error: recErr } = await admin.rpc("record_guest_post", {
    p_user_id: guestId,
    p_post_id: post.id,
  });
  if (recErr) {
    await admin.from("looking_for_posts").delete().eq("id", post.id);
    return {
      id: null,
      error: "Could not post your request. Please try again.",
    };
  }

  // Save the admin-managed requirement selections (Property type, Facilities…).
  await replacePostRequirements(post.id, input.requirement_keys ?? []);

  // Real-time: notify hosts whose saved-search matches AND every host with a
  // published property in range (matchAlerts pass 2). Best-effort, never throws.
  await notifyMatchingAlerts({
    id: post.id,
    title: input.title,
    category: input.category,
    location_region: input.location_region ?? null,
    location_text: input.location_text ?? null,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    budget_min: input.budget_min ?? null,
    budget_max: input.budget_max ?? null,
    check_in_date: input.check_in_date ?? null,
    is_public: input.is_public,
    location_lat: input.location_lat ?? null,
    location_lng: input.location_lng ?? null,
    search_radius_km: input.search_radius_km ?? null,
  });

  return { id: post.id };
}
