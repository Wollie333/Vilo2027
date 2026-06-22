"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFetchableUrl } from "@/lib/security/ssrf";
import { parseIcal, rangesToDates } from "@/lib/ical-parser";

/** Cap imported dates per feed so a giant/hostile feed can't flood blocked_dates. */
const MAX_IMPORTED_DATES = 1000;

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
    .select("id, property_id, url, status")
    .eq("id", parsed.data.feedId)
    .maybeSingle();
  if (!feed) return { ok: false, error: "Feed not found." };

  const admin = createAdminClient();

  // 1. Fetch — SSRF guard first (reject private/loopback/metadata hosts).
  let body: string;
  try {
    await assertFetchableUrl(feed.url);
    const res = await fetch(feed.url, {
      // 30s timeout via AbortController
      signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "Vilo-CalendarSync/1.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
    body = await res.text();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error fetching feed";
    await admin
      .from("ical_feeds")
      .update({
        status: "error",
        last_sync_at: new Date().toISOString(),
        last_error: message.slice(0, 500),
      })
      .eq("id", feed.id);
    revalidatePath("/dashboard/calendar-sync");
    return { ok: false, error: `Couldn't fetch feed: ${message}` };
  }

  // 2. Parse (cap dates so a hostile feed can't flood blocked_dates)
  const ranges = parseIcal(body);
  const dates = rangesToDates(ranges).slice(0, MAX_IMPORTED_DATES);

  // 3. Write atomically + NON-destructively via the RPC: it replaces only this
  // feed's own source='ical' rows and inserts the new dates with ON CONFLICT DO
  // NOTHING (a manual / booking / quote_hold block on the same date always wins).
  // (A plain upsert here previously failed — there is no (property_id,date)
  // unique key, only the expression index the RPC targets.)
  const { data: inserted, error: rpcError } = await admin.rpc(
    "import_ical_blocks",
    {
      p_feed_id: feed.id,
      p_property_id: feed.property_id,
      p_dates: dates,
    },
  );
  if (rpcError) {
    await admin
      .from("ical_feeds")
      .update({
        status: "error",
        last_sync_at: new Date().toISOString(),
        last_error: rpcError.message.slice(0, 500),
      })
      .eq("id", feed.id);
    revalidatePath("/dashboard/calendar-sync");
    return { ok: false, error: `Couldn't write blocks: ${rpcError.message}` };
  }

  // Rows this feed actually blocks (dates already held by a real Vilo block are
  // skipped by DO NOTHING and not counted).
  const importedCount = typeof inserted === "number" ? inserted : dates.length;
  await admin
    .from("ical_feeds")
    .update({
      status: "active",
      last_sync_at: new Date().toISOString(),
      last_error: null,
      imported_count: importedCount,
    })
    .eq("id", feed.id);

  revalidatePath("/dashboard/calendar-sync");
  return { ok: true, imported: importedCount };
}
