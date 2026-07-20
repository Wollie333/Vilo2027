"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { guestCan } from "@/lib/guests/permissions";
import { MAX_ACTIVE_LOOKING_FOR_POSTS } from "@/lib/looking-for/limits";
import { dispatchEvent } from "@/lib/notifications/dispatch";
import { notifyMatchingAlerts } from "@/lib/looking-for/matchAlerts";
import { replacePostRequirements } from "@/lib/looking-for/writeRequirements";
import { sanitiseListingHtml } from "@/lib/sanitiseHtml";
import { revalidatePath } from "next/cache";

const REQUEST_IMAGE_BUCKET = "looking-for-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

type CreateRequestInput = {
  guest_id: string;
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

/**
 * Upload one image for a Looking-For request. Public bucket
 * (`looking-for-images`) so `<img src=publicUrl>` renders on the public
 * directory without a signed URL; path is scoped to the signed-in user's id.
 * Returns the public URL — the caller stores it on the post via
 * create/update. Size + type are also capped at the storage layer.
 */
export async function uploadRequestImageAction(
  formData: FormData,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file received." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { success: false, error: "Image is too large — max 5MB." };
  }
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "Only image files are allowed." };
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Please sign in to upload an image." };
  }

  // Admin storage client so the upload doesn't depend on session cookies being
  // readable in this action context; the path is still scoped to user.id.
  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/request-${Date.now()}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from(REQUEST_IMAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) {
    console.error("[looking-for:uploadImage] failed", uploadErr);
    return { success: false, error: `Upload failed: ${uploadErr.message}` };
  }

  const { data: pub } = admin.storage
    .from(REQUEST_IMAGE_BUCKET)
    .getPublicUrl(path);
  return { success: true, url: pub.publicUrl };
}

/**
 * Create a new Looking For post
 */
export async function createRequestAction(input: CreateRequestInput) {
  const supabase = createServerClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== input.guest_id) {
    return { success: false, error: "Not authenticated" };
  }

  // Global guest permission gate (admin-controlled in Feature permissions →
  // Guests). Off = posting is disabled platform-wide.
  if (!(await guestCan("looking_for_post"))) {
    return {
      success: false,
      error: "Posting requests is currently unavailable.",
    };
  }

  // Cap: at most 3 ACTIVE posts per guest at a time (posting stays free). The DB
  // trigger trg_looking_for_post_cap is the authoritative guard; this mirrors it
  // for a friendly message before we attempt the insert. A slot frees up as a
  // post is fulfilled / cancelled / expires.
  const { count: activeCount } = await supabase
    .from("looking_for_posts")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", input.guest_id)
    .eq("status", "active");
  if ((activeCount ?? 0) >= MAX_ACTIVE_LOOKING_FOR_POSTS) {
    return {
      success: false,
      error: `You can have up to ${MAX_ACTIVE_LOOKING_FOR_POSTS} active requests at a time. Close or fulfil one to post another.`,
    };
  }

  // Set expiry (30 days by default)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Create the post
  const { data: post, error } = await supabase
    .from("looking_for_posts")
    .insert({
      guest_id: input.guest_id,
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
    // The DB cap trigger raises this on a race past the count check above.
    if (error.message?.includes("looking_for_post_cap_reached")) {
      return {
        success: false,
        error: `You can have up to ${MAX_ACTIVE_LOOKING_FOR_POSTS} active requests at a time. Close or fulfil one to post another.`,
      };
    }
    console.error("Failed to create request:", error);
    return { success: false, error: error.message };
  }

  // Record the action log row. This deliberately does NOT swallow its error: the
  // predecessor did (`console.error` + "continue anyway"), which is exactly why a
  // hard 42P01 on every single post went unnoticed for a day and left
  // `looking_for_usage` silently empty. A logging failure here is a real bug —
  // surface it rather than let the platform lie about what it recorded.
  const { error: recErr } = await supabase.rpc("record_guest_post", {
    p_user_id: user.id,
    p_post_id: post.id,
  });
  if (recErr) {
    await createAdminClient()
      .from("looking_for_posts")
      .delete()
      .eq("id", post.id);
    return {
      success: false,
      error: "Could not post your request. Please try again.",
    };
  }

  // Save the admin-managed requirement selections (Property type, Facilities…).
  await replacePostRequirements(post.id, input.requirement_keys ?? []);

  // Real-time: notify hosts whose active saved-search alert matches this request.
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

  revalidatePath("/portal/looking-for");
  return { success: true, data: { id: post.id } };
}

/**
 * Update an existing Looking For post
 */
export async function updateRequestAction(
  postId: string,
  input: Partial<CreateRequestInput>,
) {
  const supabase = createServerClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership + snapshot the prior match-relevant fields so we can fire
  // alerts to hosts this edit NEWLY matches (without re-notifying prior matches).
  const { data: existing } = await supabase
    .from("looking_for_posts")
    .select(
      "guest_id, title, category, location_region, location_text, adults, children, infants, budget_min, budget_max, check_in_date, is_public, location_lat, location_lng, search_radius_km",
    )
    .eq("id", postId)
    .single();

  if (!existing || existing.guest_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  // Update the post
  const { error } = await supabase
    .from("looking_for_posts")
    .update({
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
      budget_per: input.budget_per || null,
      is_urgent: input.is_urgent,
      is_public: input.is_public,
      quote_deadline: input.quote_deadline || null,
      min_host_rating: input.min_host_rating || null,
      ...(input.image_url !== undefined
        ? { image_url: input.image_url || null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) {
    console.error("Failed to update request:", error);
    return { success: false, error: error.message };
  }

  // Replace the requirement selections when the caller manages them (the form
  // always sends the array; omit it and existing selections are left untouched).
  if (input.requirement_keys !== undefined) {
    await replacePostRequirements(postId, input.requirement_keys);
  }

  // Fire alerts for hosts this edit NEWLY matches — e.g. the guest just added a
  // region/dates/budget, or flipped the post public. Passing the prior version
  // means hosts already notified at create aren't pinged again. Best-effort.
  await notifyMatchingAlerts(
    {
      id: postId,
      title: input.title ?? existing.title ?? null,
      category: input.category ?? existing.category,
      location_region: input.location_region ?? null,
      location_text: input.location_text ?? null,
      adults: input.adults ?? existing.adults,
      children: input.children ?? existing.children,
      infants: input.infants ?? existing.infants,
      budget_min: input.budget_min ?? null,
      budget_max: input.budget_max ?? null,
      check_in_date: input.check_in_date ?? null,
      is_public: input.is_public ?? existing.is_public,
      location_lat: input.location_lat ?? null,
      location_lng: input.location_lng ?? null,
      search_radius_km: input.search_radius_km ?? null,
    },
    {
      id: postId,
      title: existing.title ?? null,
      category: existing.category,
      location_region: existing.location_region,
      location_text: existing.location_text,
      adults: existing.adults,
      children: existing.children,
      infants: existing.infants,
      budget_min: existing.budget_min,
      budget_max: existing.budget_max,
      check_in_date: existing.check_in_date,
      is_public: existing.is_public,
      location_lat: existing.location_lat,
      location_lng: existing.location_lng,
      search_radius_km: existing.search_radius_km,
    },
  );

  revalidatePath("/portal/looking-for");
  revalidatePath(`/portal/looking-for/${postId}`);
  return { success: true };
}

/**
 * Delete/cancel a Looking For post
 */
export async function cancelRequestAction(postId: string) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from("looking_for_posts")
    .select("guest_id")
    .eq("id", postId)
    .single();

  if (!existing || existing.guest_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  // Soft-cancel by changing status
  const { error } = await supabase
    .from("looking_for_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    console.error("Failed to cancel request:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/portal/looking-for");
  return { success: true };
}

/**
 * Extend post expiry by 7 days
 */
export async function extendRequestAction(postId: string) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from("looking_for_posts")
    .select("guest_id, expires_at")
    .eq("id", postId)
    .single();

  if (!existing || existing.guest_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  // Extend by 7 days from current expiry or now
  const currentExpiry = existing.expires_at
    ? new Date(existing.expires_at)
    : new Date();
  currentExpiry.setDate(currentExpiry.getDate() + 7);

  const { error } = await supabase
    .from("looking_for_posts")
    .update({
      expires_at: currentExpiry.toISOString(),
      status: "active", // Reactivate if it was expired
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) {
    console.error("Failed to extend request:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/portal/looking-for");
  revalidatePath(`/portal/looking-for/${postId}`);
  return { success: true };
}

/**
 * Mark a post as fulfilled
 */
export async function markFulfilledAction(
  postId: string,
  fulfilledVia: "vilo_booking" | "ota" | "direct" | "other",
  bookingId?: string,
) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from("looking_for_posts")
    .select("guest_id")
    .eq("id", postId)
    .single();

  if (!existing || existing.guest_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  const { error } = await supabase
    .from("looking_for_posts")
    .update({
      status: "fulfilled",
      fulfilled_via: fulfilledVia,
      fulfilled_booking_id: bookingId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) {
    console.error("Failed to mark fulfilled:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/portal/looking-for");
  revalidatePath(`/portal/looking-for/${postId}`);
  return { success: true };
}

/**
 * Re-open a fulfilled or cancelled post
 */
export async function reopenRequestAction(postId: string) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership and current status
  const { data: existing } = await supabase
    .from("looking_for_posts")
    .select("guest_id, status")
    .eq("id", postId)
    .single();

  if (!existing || existing.guest_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  if (existing.status === "active") {
    return { success: false, error: "Post is already active" };
  }

  // Set new expiry (30 days from now)
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 30);

  const { error } = await supabase
    .from("looking_for_posts")
    .update({
      status: "active",
      fulfilled_via: null,
      fulfilled_booking_id: null,
      expires_at: newExpiry.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) {
    console.error("Failed to reopen request:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/portal/looking-for");
  revalidatePath(`/portal/looking-for/${postId}`);
  return { success: true };
}

/**
 * Duplicate a post as a new request
 */
export async function duplicateRequestAction(postId: string) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch original post
  const { data: original, error: fetchError } = await supabase
    .from("looking_for_posts")
    .select("*")
    .eq("id", postId)
    .eq("guest_id", user.id)
    .single();

  if (fetchError || !original) {
    return { success: false, error: "Post not found" };
  }

  // Create duplicate
  const result = await createRequestAction({
    guest_id: user.id,
    title: original.title,
    description: original.description,
    category: original.category,
    check_in_date: original.check_in_date,
    check_out_date: original.check_out_date,
    adults: original.adults,
    children: original.children,
    infants: original.infants,
    child_ages: original.child_ages ?? undefined,
    pets: original.pets ?? undefined,
    location_text: original.location_text,
    location_region: original.location_region,
    destination_flexible: original.destination_flexible ?? false,
    budget_min: original.budget_min,
    budget_max: original.budget_max,
    budget_per: original.budget_per,
    is_urgent: false, // Don't copy urgent status
    is_public: original.is_public,
    quote_deadline: undefined, // Don't copy deadline (user should set new one)
    min_host_rating: original.min_host_rating,
  });

  return result;
}

/**
 * Mark quotes as viewed and notify hosts (called when guest views quotes page)
 */
export async function markQuotesViewedAction(postId: string) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership
  const { data: post } = await supabase
    .from("looking_for_posts")
    .select("guest_id, title")
    .eq("id", postId)
    .single();

  if (!post || post.guest_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  // Fetch responses that haven't been viewed yet
  const { data: unviewedResponses } = await supabase
    .from("looking_for_responses")
    .select("id, host_id, quote_id, host:hosts(user_id)")
    .eq("post_id", postId)
    .is("viewed_at", null);

  if (!unviewedResponses || unviewedResponses.length === 0) {
    return { success: true }; // Nothing to update
  }

  // Mark all as viewed
  const responseIds = unviewedResponses.map((r) => r.id);
  await supabase
    .from("looking_for_responses")
    .update({ viewed_at: new Date().toISOString(), status: "viewed" })
    .in("id", responseIds);

  // Get guest name for notification
  const { data: guestProfile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const guestFirstName = guestProfile?.full_name?.split(" ")[0] ?? null;

  // Notify each host
  for (const response of unviewedResponses) {
    const hostData = response.host as unknown as { user_id: string } | null;
    if (hostData?.user_id) {
      await dispatchEvent({
        kind: "looking_for_quote_viewed",
        recipientUserId: hostData.user_id,
        hostId: response.host_id,
        refs: {
          post_id: postId,
          quote_id: response.quote_id ?? undefined,
          post_title: post.title ?? undefined,
          guest_first_name: guestFirstName ?? undefined,
        },
      });
    }
  }

  return { success: true };
}
