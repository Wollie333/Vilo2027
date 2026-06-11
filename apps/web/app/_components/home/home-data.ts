import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/taxonomy/getCategories";
import type { CategoryNode } from "@/lib/taxonomy/types";

// ── Shared shapes the home sections render ────────────────────────────────

export type HomeListingCard = {
  href: string;
  image: string | null;
  name: string;
  location: string;
  rating: string | null;
  reviews: string | null;
  detail: string;
  /** Raw base price + its settlement currency, so the card can convert for
   *  display (the <Money> component handles ZAR→display + the "≈" marker). */
  priceAmount: number | null;
  priceCurrency: string;
  fromLabel: boolean;
  perLabel: string;
  badge: { label: string; tone: "instant" | "featured" } | null;
};

export type HomeDestination = {
  name: string;
  stays: string;
  href: string;
  image: string | null;
};

export type HomeReview = {
  body: string;
  initials: string;
  name: string;
  detail: string;
};

export type HomeStats = {
  properties: number;
  hosts: number;
  provinces: number;
};

export type HomeChip = {
  slug: string;
  label: string;
  icon: string;
};

export type HomeTypeCard = {
  title: string;
  meta: string;
  href: string;
  image: string | null;
};

export type HomeData = {
  featured: HomeListingCard[];
  totalStays: number;
  destinations: HomeDestination[];
  popularCities: string[];
  reviews: HomeReview[];
  stats: HomeStats;
  chips: HomeChip[];
  browseTypes: HomeTypeCard[];
};

// ── Helpers ───────────────────────────────────────────────────────────────

type PhotoRow = { url: string; sort_order: number };
type RoomRow = {
  base_price: number | null;
  is_active: boolean | null;
  deleted_at: string | null;
};

function heroPhoto(photos: PhotoRow[] | null): string | null {
  if (!photos || photos.length === 0) return null;
  return (
    [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null
  );
}

/** Lowest bookable price for a listing — shared by cards and category rollup.
 *  listing.base_price is kept as the effective "from" price (cheapest active
 *  room, including per-person rates) by recomputeListingFromRooms, so we read it
 *  directly — deriving min(room.base_price) here missed per-person rooms whose
 *  rate lives in price_per_person (base_price 0). */
function listingAmount(l: {
  booking_mode: string | null;
  base_price: number | null;
  listing_rooms: RoomRow[] | null;
}): number | null {
  return l.base_price != null ? Number(l.base_price) : null;
}

type ListingCardRow = {
  slug: string;
  name: string;
  city: string | null;
  province: string | null;
  base_price: number | null;
  currency: string;
  max_guests: number | null;
  bedrooms: number | null;
  booking_mode: string | null;
  avg_rating: number | null;
  total_reviews: number | null;
  instant_booking: boolean | null;
  is_featured: boolean | null;
  photos: PhotoRow[] | null;
  listing_rooms: RoomRow[] | null;
};

const LISTING_CARD_SELECT =
  "slug, name, city, province, base_price, currency, max_guests, bedrooms, booking_mode, avg_rating, total_reviews, instant_booking, is_featured, photos:listing_photos ( url, sort_order ), listing_rooms ( base_price, is_active, deleted_at )";

function toListingCard(l: ListingCardRow): HomeListingCard {
  const location = [l.city, l.province].filter(Boolean).join(" · ");

  // Price — mirrors /explore and /c/[slug].
  const amount = listingAmount(l);
  const perLabel = "/ night";
  const fromLabel = l.booking_mode === "rooms_only";

  const detailBits: string[] = [];
  if (l.max_guests) detailBits.push(`Sleeps ${l.max_guests}`);
  if (l.bedrooms)
    detailBits.push(
      `${l.bedrooms} ${l.bedrooms === 1 ? "bedroom" : "bedrooms"}`,
    );

  const hasRating =
    l.avg_rating != null && l.total_reviews != null && l.total_reviews > 0;

  const badge: HomeListingCard["badge"] = l.instant_booking
    ? { label: "Instant book", tone: "instant" }
    : l.is_featured
      ? { label: "Featured", tone: "featured" }
      : null;

  return {
    href: `/listing/${l.slug}`,
    image: heroPhoto(l.photos),
    name: l.name,
    location,
    rating: hasRating ? Number(l.avg_rating).toFixed(1) : null,
    reviews: hasRating ? `(${l.total_reviews})` : null,
    detail: detailBits.join(" · "),
    priceAmount: amount,
    priceCurrency: l.currency,
    fromLabel,
    perLabel,
    badge,
  };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Main loader ───────────────────────────────────────────────────────────

/**
 * Loads everything the public homepage renders from the live database.
 * Every query is resilient: a failed/empty read yields a safe empty slice so
 * the page never throws. Reviewer names live in `user_profiles`, which is NOT
 * publicly readable, so guest reviews are anonymised (matches /[handle]).
 */
export async function getHomeData(): Promise<HomeData> {
  const supabase = createServerClient();
  const brandName = await getBrandName();

  // Category tree is cached (tag: 'taxonomy'); kick it off alongside the reads.
  const treePromise = getCategoryTree();

  const [featuredRes, fallbackRes, aggRes, countRes, reviewsRes] =
    await Promise.all([
      // Featured listings (hand-picked by admin).
      supabase
        .from("listings")
        .select(LISTING_CARD_SELECT)
        .eq("is_published", true)
        .eq("listing_type", "accommodation")
        .is("deleted_at", null)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(8),
      // Fallback pool — top-rated then newest — used if too few are featured.
      supabase
        .from("listings")
        .select(LISTING_CARD_SELECT)
        .eq("is_published", true)
        .eq("listing_type", "accommodation")
        .is("deleted_at", null)
        .order("avg_rating", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(8),
      // Aggregation pool — destinations, provinces, hosts, category rollup.
      supabase
        .from("listings")
        .select(
          "city, province, category_id, base_price, currency, booking_mode, host:hosts!inner ( display_name ), photos:listing_photos ( url, sort_order ), listing_rooms ( base_price, is_active, deleted_at )",
        )
        .eq("is_published", true)
        .eq("listing_type", "accommodation")
        .is("deleted_at", null)
        .limit(1000),
      // Exact published-listing count for the hero + "show all" CTA.
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true)
        .eq("listing_type", "accommodation")
        .is("deleted_at", null),
      // Most-recent public reviews (anonymised).
      supabase
        .from("reviews")
        .select(
          "id, body, created_at, listing:listings!reviews_listing_id_fkey ( name )",
        )
        .eq("is_published", true)
        .eq("flagged", false)
        .not("body", "is", null)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  // ── Featured (with fallback to top of the pool) ──────────────────────────
  const featuredRows = (featuredRes.data ?? []) as unknown as ListingCardRow[];
  const fallbackRows = (fallbackRes.data ?? []) as unknown as ListingCardRow[];
  const seen = new Set(featuredRows.map((l) => l.slug));
  const featuredPool = [
    ...featuredRows,
    ...fallbackRows.filter((l) => !seen.has(l.slug)),
  ].slice(0, 8);
  const featured = featuredPool.map(toListingCard);

  // ── Destinations / provinces / hosts / categories (one pass) ─────────────
  type AggRow = {
    city: string | null;
    province: string | null;
    category_id: string | null;
    base_price: number | null;
    currency: string;
    booking_mode: string | null;
    host: { display_name: string } | null;
    photos: PhotoRow[] | null;
    listing_rooms: RoomRow[] | null;
  };
  const aggRows = (aggRes.data ?? []) as unknown as AggRow[];

  // Map every category id (leaf incl. descendants) to its top-level "type"
  // bucket so a listing categorised at any depth rolls up to the type card.
  const tree = await treePromise;
  const idToBucket = new Map<string, string>(); // category_id -> bucket slug
  const buckets = new Map<
    string,
    { label: string; image: string | null; count: number; from: number | null }
  >();
  const collectIds = (node: CategoryNode): string[] => [
    node.id,
    ...node.children.flatMap(collectIds),
  ];
  // Buckets are the leaf categories under each accommodation root (mirrors the
  // explore type chips); fall back to roots if a root has no children.
  for (const root of tree.accommodation) {
    const leaves = root.children.length > 0 ? root.children : [root];
    for (const leaf of leaves) {
      buckets.set(leaf.slug, {
        label: leaf.label,
        image: leaf.hero_image_url,
        count: 0,
        from: null,
      });
      for (const id of collectIds(leaf)) idToBucket.set(id, leaf.slug);
    }
  }

  const cityMap = new Map<string, { count: number; image: string | null }>();
  const provinces = new Set<string>();
  const hosts = new Set<string>();
  for (const row of aggRows) {
    if (row.province) provinces.add(row.province);
    if (row.host?.display_name) hosts.add(row.host.display_name);
    const city = row.city?.trim();
    if (city) {
      const entry = cityMap.get(city) ?? { count: 0, image: null };
      entry.count += 1;
      if (!entry.image) entry.image = heroPhoto(row.photos);
      cityMap.set(city, entry);
    }
    // Category rollup.
    const bucketSlug = row.category_id
      ? idToBucket.get(row.category_id)
      : undefined;
    if (bucketSlug) {
      const b = buckets.get(bucketSlug)!;
      b.count += 1;
      if (!b.image) b.image = heroPhoto(row.photos);
      const amount = listingAmount(row);
      if (amount != null && (b.from == null || amount < b.from))
        b.from = amount;
    }
  }

  const browseTypes: HomeTypeCard[] = [...buckets.entries()]
    .filter(([, b]) => b.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([slug, b]) => ({
      title: b.label,
      meta:
        b.from != null
          ? `${b.count} ${b.count === 1 ? "stay" : "stays"} from ${formatMoney(b.from, "ZAR")}`
          : `${b.count} ${b.count === 1 ? "stay" : "stays"}`,
      href: `/c/${slug}`,
      image: b.image,
    }));

  // Chips — every leaf category, newest-rooted order, linking into /explore.
  const chips: HomeChip[] = [
    { slug: "", label: "All stays", icon: "sparkles" },
  ];
  for (const root of tree.accommodation) {
    for (const leaf of root.children) {
      chips.push({ slug: leaf.slug, label: leaf.label, icon: leaf.icon });
    }
  }

  const rankedCities = [...cityMap.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  );

  const destinations: HomeDestination[] = rankedCities
    .slice(0, 6)
    .map(([name, v]) => ({
      name,
      stays: `${v.count} ${v.count === 1 ? "stay" : "stays"}`,
      href: `/explore?where=${encodeURIComponent(name)}`,
      image: v.image,
    }));

  const popularCities = rankedCities.slice(0, 6).map(([name]) => name);

  const totalStays = countRes.count ?? aggRows.length;

  const stats: HomeStats = {
    properties: totalStays,
    hosts: hosts.size,
    provinces: provinces.size,
  };

  // ── Reviews (anonymised — user_profiles is not public) ───────────────────
  type ReviewRow = {
    body: string | null;
    created_at: string;
    listing: { name: string } | null;
  };
  const reviewRows = (reviewsRes.data ?? []) as unknown as ReviewRow[];
  const reviews: HomeReview[] = reviewRows
    .filter((r) => r.body && r.body.trim().length > 0)
    .map((r) => {
      const stay = r.listing?.name ?? `a ${brandName} stay`;
      const when = monthYear(r.created_at);
      return {
        body: `“${r.body!.trim()}”`,
        initials: "VG",
        name: "Verified guest",
        detail: when ? `${stay} · ${when}` : stay,
      };
    });

  return {
    featured,
    totalStays,
    destinations,
    popularCities,
    reviews,
    stats,
    chips,
    browseTypes,
  };
}
