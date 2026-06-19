import type { createAdminClient } from "@/lib/supabase/admin";
import { websiteAssetUrl } from "@/lib/website/assets";

// Shared read path for the cross-host platform directory (`/specials`). Reads
// with the admin client and guards in JS (RLS only exposes active rows, but the
// directory also depends on freshly-derived guards — sold-out + date windows —
// that can't all be expressed as column-to-column SQL filters; pre-MVP volume is
// tiny so post-filtering in JS is correct and simpler than a SECURITY DEFINER
// view). A special is listed only when: active, not soft-deleted, opted into the
// directory, not sold out, live (go_live_at passed), still bookable (book_by not
// passed) and not fully in the past. Unlisted (show_in_directory=false) specials
// never appear here but remain reachable at /special/[slug].

export const SPECIALS_PAGE_SIZE = 24;

// Mirrors BROWSE_TYPE_LABEL (app/_components/browse/searchListings.ts) — kept
// local so the directory doesn't depend on the browse module.
export const SPECIAL_TYPE_LABEL: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  bb: "B&B",
  self_catering: "Self-catering",
  lodge: "Lodge",
  other: "Stay",
};

export type DirectorySpecial = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  heroUrl: string | null;
  badge: string | null;
  dateMode: "fixed" | "flexible";
  fixedCheckIn: string | null;
  fixedCheckOut: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  minNights: number | null;
  maxNights: number | null;
  priceMode: "flat" | "per_night";
  flatTotal: number | null;
  perNightPrice: number | null;
  currency: string;
  wasPrice: number | null;
  savingsAmount: number | null;
  savingsPct: number | null;
  remaining: number;
  categories: string[];
  isFeatured: boolean;
  propertyName: string;
  propertyCity: string | null;
  propertyProvince: string | null;
  accommodationType: string | null;
};

export type SpecialsSearchParams = {
  where?: string;
  type?: string;
  category?: string;
  page?: string;
};

export type SpecialsDirectoryResult = {
  specials: DirectorySpecial[];
  where: string;
  type: string;
  category: string;
  hasFilters: boolean;
  totalCount: number;
  totalPages: number;
  safePage: number;
  prevHref: string | null;
  nextHref: string | null;
};

type PropertyJoin = {
  slug: string | null;
  name: string;
  city: string | null;
  province: string | null;
  accommodation_type: string | null;
  deleted_at: string | null;
  photos: Array<{ url: string; sort_order: number }> | null;
};

type SpecialRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  hero_image_path: string | null;
  badge: string | null;
  date_mode: string;
  fixed_check_in: string | null;
  fixed_check_out: string | null;
  window_start: string | null;
  window_end: string | null;
  min_nights: number | null;
  max_nights: number | null;
  price_mode: string;
  flat_total: number | null;
  per_night_price: number | null;
  currency: string;
  quantity: number;
  redemptions_used: number;
  go_live_at: string | null;
  book_by: string | null;
  was_price: number | null;
  savings_amount: number | null;
  savings_pct: number | null;
  categories: string[] | null;
  is_featured: boolean | null;
  sort_order: number | null;
  property: PropertyJoin | PropertyJoin[] | null;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildQueryString(
  base: { where: string; type: string; category: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (base.where) params.set("where", base.where);
  if (base.type) params.set("type", base.type);
  if (base.category) params.set("category", base.category);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

/** Cross-host directory query + JS guards + filters + pagination. */
export async function searchSpecials(
  admin: ReturnType<typeof createAdminClient>,
  searchParams: SpecialsSearchParams | undefined,
  basePath: string,
): Promise<SpecialsDirectoryResult> {
  const where = (searchParams?.where ?? "").trim();
  const type = searchParams?.type ?? "";
  const category = searchParams?.category ?? "";
  const pageRaw = parseInt(searchParams?.page ?? "", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const hasFilters = where.length > 0 || type !== "" || category !== "";

  const today = todayISO();

  const { data } = await admin
    .from("specials")
    .select(
      "id, slug, title, description, hero_image_path, badge, date_mode, fixed_check_in, fixed_check_out, window_start, window_end, min_nights, max_nights, price_mode, flat_total, per_night_price, currency, quantity, redemptions_used, go_live_at, book_by, was_price, savings_amount, savings_pct, categories, is_featured, sort_order, property:properties!inner ( slug, name, city, province, accommodation_type, deleted_at, photos:property_photos ( url, sort_order ) )",
    )
    .eq("status", "active")
    .eq("show_in_directory", true)
    .is("deleted_at", null);

  const rows = (data ?? []) as unknown as SpecialRow[];

  const mapped: DirectorySpecial[] = [];
  for (const r of rows) {
    const property = Array.isArray(r.property) ? r.property[0] : r.property;
    if (!property || property.deleted_at) continue;

    // Date / inventory guards (mirror the booking action's runtime predicates).
    if (r.go_live_at && r.go_live_at > today) continue;
    if (r.book_by && r.book_by < today) continue;
    const stayEnd = r.date_mode === "fixed" ? r.fixed_check_out : r.window_end;
    if (stayEnd && stayEnd <= today) continue;
    const remaining = Math.max(0, r.quantity - r.redemptions_used);
    if (remaining <= 0) continue;

    const photos = property.photos ?? [];
    const fallbackPhoto = [...photos].sort(
      (a, b) => a.sort_order - b.sort_order,
    )[0]?.url;
    const heroUrl = websiteAssetUrl(r.hero_image_path) ?? fallbackPhoto ?? null;

    mapped.push({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      heroUrl,
      badge: r.badge,
      dateMode: r.date_mode === "flexible" ? "flexible" : "fixed",
      fixedCheckIn: r.fixed_check_in,
      fixedCheckOut: r.fixed_check_out,
      windowStart: r.window_start,
      windowEnd: r.window_end,
      minNights: r.min_nights,
      maxNights: r.max_nights,
      priceMode: r.price_mode === "per_night" ? "per_night" : "flat",
      flatTotal: r.flat_total == null ? null : Number(r.flat_total),
      perNightPrice:
        r.per_night_price == null ? null : Number(r.per_night_price),
      currency: r.currency,
      wasPrice: r.was_price == null ? null : Number(r.was_price),
      savingsAmount: r.savings_amount == null ? null : Number(r.savings_amount),
      savingsPct: r.savings_pct,
      remaining,
      categories: r.categories ?? [],
      isFeatured: !!r.is_featured,
      propertyName: property.name,
      propertyCity: property.city,
      propertyProvince: property.province,
      accommodationType: property.accommodation_type,
    });
  }

  // Filters (JS — see module note).
  let filtered = mapped;
  if (where.length > 0) {
    const needle = where.toLowerCase();
    filtered = filtered.filter((s) =>
      [s.title, s.propertyName, s.propertyCity, s.propertyProvince]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle)),
    );
  }
  if (type) {
    filtered = filtered.filter((s) => s.accommodationType === type);
  }
  if (category) {
    filtered = filtered.filter((s) => s.categories.includes(category));
  }

  // Featured first, then sort_order, then title for a stable order.
  const order = new Map(rows.map((r, i) => [r.id, i]));
  filtered.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    const ao = order.get(a.id) ?? 0;
    const bo = order.get(b.id) ?? 0;
    return ao - bo;
  });

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / SPECIALS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = (safePage - 1) * SPECIALS_PAGE_SIZE;
  const specials = filtered.slice(rangeStart, rangeStart + SPECIALS_PAGE_SIZE);

  const prevHref =
    safePage > 1
      ? (() => {
          const qs = buildQueryString({ where, type, category }, safePage - 1);
          return `${basePath}${qs ? `?${qs}` : ""}`;
        })()
      : null;
  const nextHref =
    safePage < totalPages
      ? `${basePath}?${buildQueryString({ where, type, category }, safePage + 1)}`
      : null;

  return {
    specials,
    where,
    type,
    category,
    hasFilters,
    totalCount,
    totalPages,
    safePage,
    prevHref,
    nextHref,
  };
}
