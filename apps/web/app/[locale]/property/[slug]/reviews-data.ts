import { reviewPhotoUrl } from "@/lib/reviews/photos";
import { createServerClient } from "@/lib/supabase/server";

export type TripType =
  | "couples"
  | "family"
  | "solo"
  | "friends"
  | "business"
  | "other";

export type PublicReview = {
  id: string;
  guestName: string;
  createdAt: string;
  rating: number;
  body: string | null;
  tripType: TripType | null;
  helpfulCount: number;
  nights: number | null;
  hostResponse: string | null;
  photos: string[];
};

export type ReviewCategory = { key: string; label: string; avg: number };
export type ReviewTheme = {
  label: string;
  iconKey: string;
  count: number | null;
};
export type TripTypeCount = { key: TripType; label: string; count: number };

export type ReviewsData = {
  count: number;
  average: number;
  distribution: { star: number; count: number }[];
  categories: ReviewCategory[];
  themes: ReviewTheme[];
  tripTypes: TripTypeCount[];
  featured: PublicReview | null;
  reviews: PublicReview[];
};

const CATEGORY_META: { key: string; col: string; label: string }[] = [
  { key: "cleanliness", col: "rating_cleanliness", label: "Cleanliness" },
  { key: "accuracy", col: "rating_accuracy", label: "Accuracy" },
  { key: "checkin", col: "rating_checkin", label: "Check-in" },
  { key: "communication", col: "rating_communication", label: "Communication" },
  { key: "location", col: "rating_location", label: "Location" },
  { key: "value", col: "rating_value", label: "Value" },
];

const TRIP_LABELS: Record<TripType, string> = {
  couples: "Couples",
  family: "Families",
  solo: "Solo",
  friends: "Friends",
  business: "Business",
  other: "Other",
};

type RawReview = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  trip_type: TripType | null;
  helpful_count: number | null;
  rating_cleanliness: number | null;
  rating_communication: number | null;
  rating_checkin: number | null;
  rating_accuracy: number | null;
  rating_location: number | null;
  rating_value: number | null;
  host_response: string | null;
  guest: { full_name: string | null } | null;
  booking: { nights: number | null; guest_name: string | null } | null;
  photos: { storage_path: string; sort_order: number }[] | null;
};

function firstNameLastInitial(name: string | null): string {
  if (!name) return "Guest";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Loads published reviews for a listing plus the derived aggregates that drive
 * the reviews section (distribution, per-category averages, trip-type counts)
 * and the host-curated "Guests mention" themes.
 */
export async function loadListingReviews(
  listingId: string,
): Promise<ReviewsData> {
  const supabase = createServerClient();

  const [{ data: reviewRows }, { data: themeRows }, { data: listingRow }] =
    await Promise.all([
      supabase
        .from("reviews")
        .select(
          `id, rating, body, created_at, trip_type, helpful_count, host_response,
         rating_cleanliness, rating_communication, rating_checkin,
         rating_accuracy, rating_location, rating_value,
         guest:user_profiles!reviews_guest_id_fkey ( full_name ),
         booking:bookings ( nights, guest_name ),
         photos:review_photos ( storage_path, sort_order )`,
        )
        .eq("property_id", listingId)
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_review_themes")
        .select("label, icon_key, mention_count, sort_order")
        .eq("property_id", listingId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("properties")
        .select("featured_review_id")
        .eq("id", listingId)
        .maybeSingle(),
    ]);
  const featuredReviewId = listingRow?.featured_review_id ?? null;

  const rows = (reviewRows ?? []) as unknown as RawReview[];

  const reviews: PublicReview[] = rows.map((r) => ({
    id: r.id,
    guestName: firstNameLastInitial(
      r.guest?.full_name ?? r.booking?.guest_name ?? null,
    ),
    createdAt: r.created_at,
    rating: r.rating,
    body: r.body,
    tripType: r.trip_type,
    helpfulCount: r.helpful_count ?? 0,
    nights: r.booking?.nights ?? null,
    hostResponse: r.host_response ?? null,
    photos: (r.photos ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => reviewPhotoUrl(p.storage_path)),
  }));

  const count = reviews.length;
  const average =
    count > 0
      ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 100) / 100
      : 0;

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: rows.filter((r) => r.rating === star).length,
  }));

  const categories: ReviewCategory[] = CATEGORY_META.map((c) => {
    const vals = rows
      .map((r) => r[c.col as keyof RawReview] as number | null)
      .filter((v): v is number => v != null);
    const avg =
      vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
        : 0;
    return { key: c.key, label: c.label, avg };
  }).filter((c) => c.avg > 0);

  const tripCounts = new Map<TripType, number>();
  for (const r of rows) {
    if (r.trip_type)
      tripCounts.set(r.trip_type, (tripCounts.get(r.trip_type) ?? 0) + 1);
  }
  const tripTypes: TripTypeCount[] = [...tripCounts.entries()]
    .map(([key, c]) => ({ key, label: TRIP_LABELS[key], count: c }))
    .sort((a, b) => b.count - a.count);

  const themes: ReviewTheme[] = (
    (themeRows ?? []) as Array<{
      label: string;
      icon_key: string;
      mention_count: number | null;
    }>
  ).map((t) => ({
    label: t.label,
    iconKey: t.icon_key,
    count: t.mention_count,
  }));

  // Featured = the host's pinned review if set + still published; otherwise the
  // latest highest-rated review (preferring one with written text).
  const pinned = featuredReviewId
    ? (reviews.find((r) => r.id === featuredReviewId) ?? null)
    : null;
  const byRatingThenRecent = (a: PublicReview, b: PublicReview) =>
    b.rating - a.rating || b.createdAt.localeCompare(a.createdAt);
  const withBody = reviews.filter((r) => r.body && r.body.length > 0);
  const fallback =
    (withBody.length > 0 ? [...withBody] : [...reviews]).sort(
      byRatingThenRecent,
    )[0] ?? null;
  const featured = pinned ?? fallback;

  return {
    count,
    average,
    distribution,
    categories,
    themes,
    tripTypes,
    featured,
    reviews,
  };
}
