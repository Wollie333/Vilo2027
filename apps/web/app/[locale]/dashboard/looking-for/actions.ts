"use server";

import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type FetchPostsInput = {
  hostId: string;
  category?: string;
  region?: string;
  sortBy?: "nearest" | "newest" | "budget_high";
  quickFilter?: "all" | "no_quotes" | "expiring_soon";
  limit?: number;
};

/**
 * Fetch active Looking For posts for a host to browse.
 * Includes both public posts and private posts targeted at this host.
 */
export async function fetchLookingForPostsAction(input: FetchPostsInput) {
  const supabase = createServerClient();

  // First, get IDs of posts that target this host (for private posts)
  const { data: targetedPosts } = await supabase
    .from("looking_for_post_targets")
    .select("post_id")
    .eq("host_id", input.hostId);

  const targetedPostIds = (targetedPosts ?? []).map((t) => t.post_id);

  // Build query - fetch public posts OR posts targeted at this host
  let query = supabase
    .from("looking_for_posts")
    .select(
      `
      id,
      title,
      description,
      category,
      check_in_date,
      check_out_date,
      adults,
      children,
      infants,
      location_text,
      location_region,
      budget_min,
      budget_max,
      budget_currency,
      budget_per,
      is_urgent,
      is_public,
      view_count,
      quote_count,
      created_at,
      expires_at,
      guest:user_profiles!guest_id(full_name, avatar_url, phone_verified_at, id_verified_at)
    `,
    )
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());

  // Filter for public posts OR posts targeted at this host
  if (targetedPostIds.length > 0) {
    query = query.or(`is_public.eq.true,id.in.(${targetedPostIds.join(",")})`);
  } else {
    query = query.eq("is_public", true);
  }

  // Apply filters
  if (input.category) {
    query = query.eq("category", input.category);
  }
  if (input.region) {
    query = query.eq("location_region", input.region);
  }

  // Apply strategic quick filters
  if (input.quickFilter === "no_quotes") {
    query = query.eq("quote_count", 0);
  } else if (input.quickFilter === "expiring_soon") {
    // Posts expiring in the next 48 hours
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    query = query.lte("expires_at", in48Hours.toISOString());
  }

  // Apply sorting
  switch (input.sortBy) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "budget_high":
      query = query.order("budget_max", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "nearest":
    default:
      // For now, sort by urgent first, then newest
      // Geo-sorting will be added when we implement the RPC
      query = query
        .order("is_urgent", { ascending: false })
        .order("created_at", { ascending: false });
      break;
  }

  // Limit results
  query = query.limit(input.limit ?? 50);

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch looking for posts:", error);
    return { success: false, error: error.message };
  }

  // Check which posts the host has already quoted
  const postIds = (data ?? []).map((p) => p.id);
  const { data: responses } = await supabase
    .from("looking_for_responses")
    .select("post_id")
    .eq("host_id", input.hostId)
    .in("post_id", postIds);

  const quotedPostIds = new Set((responses ?? []).map((r) => r.post_id));
  const targetedPostIdSet = new Set(targetedPostIds);

  // Transform the data
  const posts = (data ?? []).map((row) => {
    // Handle the guest relation - can be object or array depending on query
    const guest = row.guest as unknown as {
      full_name: string | null;
      avatar_url: string | null;
      phone_verified_at: string | null;
      id_verified_at: string | null;
    } | null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      check_in_date: row.check_in_date,
      check_out_date: row.check_out_date,
      adults: row.adults,
      children: row.children,
      infants: row.infants,
      location_text: row.location_text,
      location_region: row.location_region,
      budget_min: row.budget_min,
      budget_max: row.budget_max,
      budget_currency: row.budget_currency,
      budget_per: row.budget_per,
      is_urgent: row.is_urgent,
      is_targeted: targetedPostIdSet.has(row.id), // True if this is a private post targeted at the host
      view_count: row.view_count,
      quote_count: row.quote_count,
      created_at: row.created_at,
      expires_at: row.expires_at,
      guest_name: guest?.full_name ?? null,
      guest_avatar: guest?.avatar_url ?? null,
      guest_verification: {
        email_verified: true, // All registered guests have verified email
        phone_verified: Boolean(guest?.phone_verified_at),
        id_verified: Boolean(guest?.id_verified_at),
      },
      availability: {
        status: "unknown" as const,
        available_count: 0,
        total_count: 0,
        message: "No dates specified",
      },
      distance_km: null, // Will be calculated by RPC later
      already_quoted: quotedPostIds.has(row.id),
    };
  });

  // Check availability for posts with dates (batch RPC calls)
  const postsWithDates = posts.filter(
    (p) => p.check_in_date && p.check_out_date,
  );

  if (postsWithDates.length > 0) {
    // Check availability for all posts in parallel
    const availabilityResults = await Promise.all(
      postsWithDates.map(async (post) => {
        const { data: availability } = await supabase.rpc(
          "check_host_availability_for_dates",
          {
            p_host_id: input.hostId,
            p_check_in: post.check_in_date,
            p_check_out: post.check_out_date,
          },
        );
        return { postId: post.id, availability };
      }),
    );

    // Map availability results to posts
    const availabilityMap = new Map(
      availabilityResults.map((r) => [r.postId, r.availability]),
    );

    for (const post of posts) {
      const avail = availabilityMap.get(post.id);
      if (avail) {
        post.availability = {
          status: avail.status ?? "unknown",
          available_count: avail.available_count ?? 0,
          total_count: avail.total_count ?? 0,
          message: avail.message ?? "",
        };
      }
    }
  }

  return { success: true, data: posts };
}

/**
 * Record a host viewing a Looking For post (for view count tracking).
 */
export async function recordPostViewAction(postId: string, hostId: string) {
  const supabase = createServerClient();

  // Insert view record (will be ignored if already exists due to unique constraint)
  await supabase
    .from("looking_for_post_views")
    .upsert(
      { post_id: postId, host_id: hostId },
      { onConflict: "post_id,host_id", ignoreDuplicates: true },
    );

  return { success: true };
}

/**
 * Bookmark/unbookmark a Looking For post.
 */
export async function toggleBookmarkAction(postId: string, hostId: string) {
  const supabase = createServerClient();

  // Check if already bookmarked
  const { data: existing } = await supabase
    .from("looking_for_bookmarks")
    .select("id")
    .eq("post_id", postId)
    .eq("host_id", hostId)
    .maybeSingle();

  if (existing) {
    // Remove bookmark
    await supabase.from("looking_for_bookmarks").delete().eq("id", existing.id);
    return { success: true, bookmarked: false };
  } else {
    // Add bookmark
    await supabase
      .from("looking_for_bookmarks")
      .insert({ post_id: postId, host_id: hostId });
    return { success: true, bookmarked: true };
  }
}

/**
 * Mark a post as "Not a Fit" and hide it from the browse view.
 */
export async function passOnPostAction(
  postId: string,
  hostId: string,
  reason?: string,
) {
  const supabase = createServerClient();

  await supabase.from("looking_for_passes").insert({
    post_id: postId,
    host_id: hostId,
    reason: reason ?? null,
  });

  revalidatePath("/dashboard/looking-for");
  return { success: true };
}

// -----------------------------------------------------------------------------
// ALERT MANAGEMENT ACTIONS
// -----------------------------------------------------------------------------

type CreateAlertInput = {
  hostId: string;
  name?: string;
  category?: string;
  location_region?: string;
  min_budget?: number;
  max_budget?: number;
  min_guests?: number;
  max_guests?: number;
  check_in_from?: string;
  check_in_to?: string;
};

/**
 * Create a new saved search alert.
 */
export async function createAlertAction(input: CreateAlertInput) {
  const supabase = createServerClient();

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Generate a name if not provided
  const alertName =
    input.name ||
    [
      input.category,
      input.location_region,
      input.min_guests && `${input.min_guests}+ guests`,
    ]
      .filter(Boolean)
      .join(" · ") ||
    "Custom Alert";

  const { data, error } = await supabase
    .from("looking_for_alerts")
    .insert({
      host_id: input.hostId,
      name: alertName,
      category: input.category || null,
      location_region: input.location_region || null,
      min_budget: input.min_budget || null,
      max_budget: input.max_budget || null,
      min_guests: input.min_guests || null,
      max_guests: input.max_guests || null,
      check_in_from: input.check_in_from || null,
      check_in_to: input.check_in_to || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create alert:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/looking-for/alerts");
  return { success: true, data: { id: data.id } };
}

/**
 * Update an existing alert.
 */
export async function updateAlertAction(
  alertId: string,
  input: Partial<CreateAlertInput>,
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
    .from("looking_for_alerts")
    .select("host_id")
    .eq("id", alertId)
    .single();

  if (!existing) {
    return { success: false, error: "Alert not found" };
  }

  // Verify host owns this alert
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("id", existing.host_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return { success: false, error: "Not authorized" };
  }

  const { error } = await supabase
    .from("looking_for_alerts")
    .update({
      name: input.name,
      category: input.category,
      location_region: input.location_region,
      min_budget: input.min_budget,
      max_budget: input.max_budget,
      min_guests: input.min_guests,
      max_guests: input.max_guests,
      check_in_from: input.check_in_from,
      check_in_to: input.check_in_to,
    })
    .eq("id", alertId);

  if (error) {
    console.error("Failed to update alert:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/looking-for/alerts");
  return { success: true };
}

/**
 * Toggle an alert's active status.
 */
export async function toggleAlertActiveAction(alertId: string) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get current status
  const { data: alert } = await supabase
    .from("looking_for_alerts")
    .select("is_active, host_id")
    .eq("id", alertId)
    .single();

  if (!alert) {
    return { success: false, error: "Alert not found" };
  }

  // Verify ownership
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("id", alert.host_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return { success: false, error: "Not authorized" };
  }

  const { error } = await supabase
    .from("looking_for_alerts")
    .update({ is_active: !alert.is_active })
    .eq("id", alertId);

  if (error) {
    console.error("Failed to toggle alert:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/looking-for/alerts");
  return { success: true, is_active: !alert.is_active };
}

/**
 * Delete a saved search alert.
 */
export async function deleteAlertAction(alertId: string) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership
  const { data: alert } = await supabase
    .from("looking_for_alerts")
    .select("host_id")
    .eq("id", alertId)
    .single();

  if (!alert) {
    return { success: false, error: "Alert not found" };
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("id", alert.host_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return { success: false, error: "Not authorized" };
  }

  const { error } = await supabase
    .from("looking_for_alerts")
    .delete()
    .eq("id", alertId);

  if (error) {
    console.error("Failed to delete alert:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/looking-for/alerts");
  return { success: true };
}
