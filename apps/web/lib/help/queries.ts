import { unstable_noStore as noStore } from "next/cache";

import { computeSetupCompletion } from "@/lib/setup/completion";
import { createServerClient } from "@/lib/supabase/server";

import {
  type HelpArticleListItem,
  type HelpArticleRow,
  type HelpAudience,
  type HelpCategoryRow,
  type HelpCategoryWithCount,
  type HelpFaqRow,
  type HelpStatusRow,
  type HelpVideoRow,
  parseCommunityThreads,
  parseContactSettings,
  parseTrendingPills,
  type HelpCommunityThread,
  type HelpContactSettings,
  HELP_CONTACT_DEFAULTS,
} from "./types";

const LIST_COLUMNS =
  "id, slug, title, excerpt, category_id, audience, status, featured_rank, read_time_minutes, helpful_count, not_helpful_count, view_count, has_video, published_at, updated_at";

function audienceFilter(audience: HelpAudience | "any"): string[] {
  if (audience === "any") return ["host", "guest", "both"];
  if (audience === "both") return ["host", "guest", "both"];
  return [audience, "both"];
}

export async function fetchHelpCategoriesWithCounts(
  audience: HelpAudience | "any" = "any",
): Promise<HelpCategoryWithCount[]> {
  const supabase = createServerClient();
  const audienceList = audienceFilter(audience);

  const { data: categories } = await supabase
    .from("help_categories")
    .select("*")
    .is("deleted_at", null)
    .eq("is_published", true)
    .in("audience", audienceList)
    .order("sort_order", { ascending: true });

  if (!categories || categories.length === 0) return [];

  const counts = await Promise.all(
    categories.map(async (c) => {
      const { count } = await supabase
        .from("help_articles")
        .select("id", { count: "exact", head: true })
        .eq("category_id", c.id)
        .eq("status", "published")
        .is("deleted_at", null)
        .in("audience", audienceList);
      return [c.id, count ?? 0] as const;
    }),
  );
  const countMap = new Map(counts);
  return categories.map((c) => ({
    ...(c as HelpCategoryRow),
    article_count: countMap.get(c.id) ?? 0,
  }));
}

export type PopularSort = "popular" | "newest" | "updated";

export async function fetchHelpArticles({
  audience = "any",
  sort = "popular",
  limit = 6,
  categorySlug,
}: {
  audience?: HelpAudience | "any";
  sort?: PopularSort;
  limit?: number;
  categorySlug?: string;
} = {}): Promise<HelpArticleListItem[]> {
  const supabase = createServerClient();
  const audienceList = audienceFilter(audience);

  let categoryId: string | undefined;
  if (categorySlug) {
    const { data: cat } = await supabase
      .from("help_categories")
      .select("id")
      .eq("slug", categorySlug)
      .is("deleted_at", null)
      .maybeSingle();
    if (!cat) return [];
    categoryId = (cat as { id: string }).id;
  }

  let q = supabase
    .from("help_articles")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null)
    .in("audience", audienceList)
    .limit(limit);

  if (categoryId) q = q.eq("category_id", categoryId);

  if (sort === "newest") {
    q = q.order("published_at", { ascending: false, nullsFirst: false });
  } else if (sort === "updated") {
    q = q.order("updated_at", { ascending: false });
  } else {
    q = q
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("helpful_count", { ascending: false });
  }

  const { data } = await q;
  return (data ?? []) as HelpArticleListItem[];
}

export async function fetchHelpArticleBySlug(
  slug: string,
): Promise<HelpArticleRow | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("help_articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  return (data as HelpArticleRow | null) ?? null;
}

export async function fetchRelatedArticles(
  articleId: string,
  categoryId: string | null,
  limit = 4,
): Promise<HelpArticleListItem[]> {
  if (!categoryId) return [];
  const supabase = createServerClient();
  const { data } = await supabase
    .from("help_articles")
    .select(LIST_COLUMNS)
    .eq("category_id", categoryId)
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("id", articleId)
    .order("helpful_count", { ascending: false })
    .limit(limit);
  return (data ?? []) as HelpArticleListItem[];
}

export async function fetchHelpVideos(
  audience: HelpAudience | "any" = "any",
  limit = 4,
): Promise<HelpVideoRow[]> {
  const supabase = createServerClient();
  const audienceList = audienceFilter(audience);
  const { data } = await supabase
    .from("help_videos")
    .select("*")
    .eq("status", "published")
    .is("deleted_at", null)
    .in("audience", audienceList)
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })
    .limit(limit);
  return (data ?? []) as HelpVideoRow[];
}

export async function fetchHelpFaqs(
  audience: HelpAudience | "any" = "any",
  featuredOnly = true,
  limit = 6,
): Promise<HelpFaqRow[]> {
  const supabase = createServerClient();
  const audienceList = audienceFilter(audience);
  let q = supabase
    .from("help_faqs")
    .select("*")
    .eq("is_published", true)
    .is("deleted_at", null)
    .in("audience", audienceList);
  if (featuredOnly) q = q.eq("is_featured", true);
  q = q.order("sort_order", { ascending: true }).limit(limit);
  const { data } = await q;
  return (data ?? []) as HelpFaqRow[];
}

export async function fetchHelpStatus(): Promise<HelpStatusRow[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("help_status_components")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []) as HelpStatusRow[];
}

export type HelpSettingsBundle = {
  trending: string[];
  contact: HelpContactSettings;
  community: HelpCommunityThread[];
};

export async function fetchHelpSettings(): Promise<HelpSettingsBundle> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("help_settings")
    .select("key, value")
    .in("key", ["trending", "contact", "community"]);

  const map = new Map<string, unknown>(
    (data ?? []).map((r) => [
      (r as { key: string }).key,
      (r as { value: unknown }).value,
    ]),
  );
  const rawTrending = map.get("trending");
  const rawContact = map.get("contact");
  const rawCommunity = map.get("community");

  return {
    trending: parseTrendingPills(
      rawTrending as Parameters<typeof parseTrendingPills>[0],
    ),
    contact: rawContact
      ? parseContactSettings(
          rawContact as Parameters<typeof parseContactSettings>[0],
        )
      : HELP_CONTACT_DEFAULTS,
    community: parseCommunityThreads(
      rawCommunity as Parameters<typeof parseCommunityThreads>[0],
    ),
  };
}

export async function searchHelpArticles(
  query: string,
  audience: HelpAudience | "any" = "any",
  limit = 20,
): Promise<HelpArticleListItem[]> {
  const q = (query ?? "").trim();
  if (!q) return [];
  const supabase = createServerClient();
  const audienceList = audienceFilter(audience);

  const { data } = await supabase
    .from("help_articles")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null)
    .in("audience", audienceList)
    .textSearch("search_tsv", q, { type: "websearch", config: "english" })
    .limit(limit);
  return (data ?? []) as HelpArticleListItem[];
}

export type GettingStartedState = {
  // Original five — consumed by /dashboard/help. Keep their keys + shape.
  account_created: { done: boolean; meta?: string };
  first_listing: { done: boolean; meta?: string };
  paystack_verified: { done: boolean; meta?: string };
  ical_connected: { done: boolean; meta?: string };
  policies_set: { done: boolean; meta?: string };
  // Extras for the dashboard first-login experience.
  email_verified: { done: boolean; meta?: string };
  profile_completed: { done: boolean; meta?: string };
  listing_published: { done: boolean; meta?: string };
};

export async function fetchGettingStartedState(
  userId: string,
): Promise<GettingStartedState> {
  // Setup completion must always reflect the latest writes — never serve a
  // cached (pre-completion) snapshot, which would keep the checklist visible.
  noStore();
  const supabase = createServerClient();

  // hosts table doesn't carry paystack_subaccount_code / default_policy_id
  // — those are forward-looking field names that aren't in the schema yet.
  // Until they ship we proxy them off other signals:
  //   paystack_verified → host has a default EFT bank account
  //   policies_set      → host's first listing has a non-null check_in_time
  //                        (default cancellation_policy is 'moderate' so we
  //                         can't use that alone to detect "the host chose")
  const [{ data: authUserRes }, { data: profile }, { data: host }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("user_profiles")
        .select("id, created_at, full_name, email")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("hosts")
        .select("id, bio, avatar_url, languages_spoken")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const accountCreatedAt = (profile as { created_at?: string } | null)
    ?.created_at;
  const profileEmail = (profile as { email?: string | null } | null)?.email;
  const emailConfirmedAt = authUserRes?.user?.email_confirmed_at ?? null;
  const hostRow = host as {
    id?: string;
    bio?: string | null;
    avatar_url?: string | null;
    languages_spoken?: string[] | null;
  } | null;
  const hostId = hostRow?.id;

  // EFT bank account stands in for "payout method connected" until the real
  // Paystack subaccount flow ships.
  let hasBankAccount = false;
  if (hostId) {
    const { count: bankCount } = await supabase
      .from("eft_banking_details")
      .select("id", { count: "exact", head: true })
      .eq("host_id", hostId)
      .eq("is_archived", false);
    hasBankAccount = (bankCount ?? 0) > 0;
  }

  let firstListing: GettingStartedState["first_listing"] = { done: false };
  let icalConnected: GettingStartedState["ical_connected"] = { done: false };
  let listingPublished: GettingStartedState["listing_published"] = {
    done: false,
  };
  // The setup listing (oldest) drives the per-section completion shared with
  // the wizard. Defaults are filled in below once we have its data.
  let setupListing: Parameters<typeof computeSetupCompletion>[0]["listing"] =
    null;
  let setupPhotoCount = 0;
  let setupRoomCount = 0;
  let setupHasCancellation = false;
  if (hostId) {
    const { data: firstL } = await supabase
      .from("properties")
      .select(
        "id, name, is_published, listing_type, booking_mode, base_price, max_guests, cancellation_policy, check_in_time, check_out_time",
      )
      .eq("host_id", hostId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstL) {
      const row = firstL as {
        id: string;
        name?: string;
        is_published?: boolean | null;
        listing_type?: string | null;
        booking_mode?: string | null;
        base_price?: number | string | null;
        max_guests?: number | null;
        cancellation_policy?: string | null;
        check_in_time?: string | null;
        check_out_time?: string | null;
      };
      const name = row.name ?? "First listing";
      const status = row.is_published ? "published" : "draft";
      firstListing = { done: true, meta: `${name} · ${status}` };
      setupListing = row;

      // Photos + active rooms on the setup listing — needed so the checklist
      // reflects "added photos / rooms", which the old predicate ignored.
      const [{ count: photoCount }, { count: roomCount }] = await Promise.all([
        supabase
          .from("property_photos")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", row.id),
        supabase
          .from("property_rooms")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", row.id)
          .is("deleted_at", null)
          .eq("is_active", true),
      ]);
      setupPhotoCount = photoCount ?? 0;
      setupRoomCount = roomCount ?? 0;

      // A refund policy assigned listing-wide marks the Policies step done —
      // mirrors the wizard, which reads property_policies the same way.
      const { count: cancellationCount } = await supabase
        .from("property_policies")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", row.id)
        .eq("policy_type", "cancellation")
        .is("room_id", null);
      setupHasCancellation = (cancellationCount ?? 0) > 0;
    }

    const { data: listings } = await supabase
      .from("properties")
      .select("id, is_published")
      .eq("host_id", hostId)
      .is("deleted_at", null);
    const listingRows =
      (listings as { id: string; is_published: boolean }[] | null) ?? [];
    const listingIds = listingRows.map((l) => l.id);

    const publishedCount = listingRows.filter((l) => l.is_published).length;
    listingPublished = {
      done: publishedCount > 0,
      meta:
        publishedCount > 0
          ? `${publishedCount} listing${publishedCount === 1 ? "" : "s"} live`
          : "Share viloplatform.com/your-handle",
    };

    if (listingIds.length > 0) {
      const { count: feedCount } = await supabase
        .from("ical_feeds")
        .select("id", { count: "exact", head: true })
        .in("listing_id", listingIds);
      icalConnected = {
        done: (feedCount ?? 0) > 0,
        meta:
          (feedCount ?? 0) > 0
            ? `${feedCount} feed${feedCount === 1 ? "" : "s"} connected`
            : undefined,
      };
    }
  }

  // Shared completion predicates — same logic the setup wizard uses, so the
  // dashboard checklist and the wizard never disagree about what's done.
  const completion = computeSetupCompletion({
    host: hostRow,
    hasBankAccount,
    listing: setupListing,
    photoCount: setupPhotoCount,
    roomCount: setupRoomCount,
    hasCancellationPolicy: setupHasCancellation,
  });

  return {
    account_created: {
      done: Boolean(accountCreatedAt),
      meta: accountCreatedAt ? formatRelativeDate(accountCreatedAt) : undefined,
    },
    email_verified: {
      done: Boolean(emailConfirmedAt),
      meta: emailConfirmedAt
        ? `${profileEmail ?? "Email"} · verified`
        : `Check ${profileEmail ?? "your inbox"} for the link`,
    },
    profile_completed: {
      done: completion.profile,
      meta: completion.profile
        ? "Photo, bio and languages set"
        : "Profile photo, short bio, languages spoken",
    },
    first_listing: firstListing,
    paystack_verified: {
      done: hasBankAccount,
      meta: hasBankAccount
        ? "EFT bank account on file"
        : "2 min · so we can pay you out",
    },
    ical_connected: icalConnected,
    policies_set: {
      done: completion.policies,
      meta: completion.policies
        ? "Cancellation policy & check-in times set"
        : "Set cancellation policy and check-in / out times",
    },
    listing_published: listingPublished,
  };
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.max(0, Math.floor((now - then) / 86_400_000));
  if (days === 0) return "Done · today";
  if (days === 1) return "Done · yesterday";
  if (days < 14) return `Done · ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `Done · ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `Done · ${months} months ago`;
}
