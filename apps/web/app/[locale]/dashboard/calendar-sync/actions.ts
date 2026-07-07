"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncFeed } from "@/lib/ical-sync";

type Result = { ok: true; imported?: number } | { ok: false; error: string };

const addFeedSchema = z.object({
  listingId: z.string().uuid(),
  url: z.string().url().max(1000),
  sourceLabel: z.string().min(1).max(40),
});

const idSchema = z.object({ feedId: z.string().uuid() });

async function assertOwnsListing(
  listingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: listing } = await supabase
    .from("properties")
    .select("id, host:hosts!inner ( user_id )")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };
  const host = Array.isArray(listing.host) ? listing.host[0] : listing.host;
  if (host?.user_id !== user.id) {
    return { ok: false, error: "You don't own this listing." };
  }
  return { ok: true };
}

export async function addIcalFeedAction(input: {
  listingId: string;
  url: string;
  sourceLabel: string;
}): Promise<Result> {
  const parsed = addFeedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid feed details." };

  const owner = await assertOwnsListing(parsed.data.listingId);
  if (!owner.ok) return owner;

  const supabase = createServerClient();
  const { error } = await supabase.from("ical_feeds").insert({
    property_id: parsed.data.listingId,
    url: parsed.data.url,
    source_label: parsed.data.sourceLabel,
    status: "active",
  });
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That URL is already added for this listing.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/calendar-sync");
  return { ok: true };
}

export async function removeIcalFeedAction(input: {
  feedId: string;
}): Promise<Result> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Verify ownership FIRST via the RLS-scoped client — the admin delete below
  // bypasses RLS, so an unowned feedId must never reach it (it would wipe another
  // host's ical-sourced blocks). Mirrors syncIcalFeedAction's ownership gate.
  const { data: feed } = await supabase
    .from("ical_feeds")
    .select("id")
    .eq("id", parsed.data.feedId)
    .maybeSingle();
  if (!feed) return { ok: false, error: "Feed not found." };

  // Now safe: wipe this feed's imported blocks (per AGENT_RULES.md §2.5, only the
  // ical-sourced rows for this exact feed).
  const admin = createAdminClient();
  await admin
    .from("blocked_dates")
    .delete()
    .eq("ical_feed_id", parsed.data.feedId)
    .eq("source", "ical");

  const { error } = await supabase
    .from("ical_feeds")
    .delete()
    .eq("id", parsed.data.feedId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/calendar-sync");
  return { ok: true };
}

export async function syncIcalFeedAction(input: {
  feedId: string;
}): Promise<Result> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: feed } = await supabase
    .from("ical_feeds")
    .select("id, property_id, url")
    .eq("id", parsed.data.feedId)
    .maybeSingle();
  if (!feed) return { ok: false, error: "Feed not found." };

  // Shared, session-less core (fetch + SSRF guard + parse + non-destructive RPC
  // write + status stamp) — identical to what the hands-off cron worker runs.
  const admin = createAdminClient();
  const result = await syncFeed(admin, feed);

  revalidatePath("/dashboard/calendar-sync");
  return result;
}
