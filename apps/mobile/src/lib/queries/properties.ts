import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Shape returned by the directory list query. Kept explicit so screens get a
// stable, typed contract regardless of the wider generated Row.
export type DirectoryProperty = {
  id: string;
  slug: string | null;
  name: string;
  city: string | null;
  province: string | null;
  base_price: number | null;
  currency: string;
  avg_rating: number | null;
  total_reviews: number;
  property_type: string;
  is_featured: boolean;
  property_photos: {
    url: string;
    sort_order: number;
    room_id: string | null;
  }[];
  hosts: { display_name: string; avatar_url: string | null } | null;
};

const DIRECTORY_SELECT =
  "id, slug, name, city, province, base_price, currency, avg_rating, total_reviews, property_type, is_featured, property_photos(url, sort_order, room_id), hosts(display_name, avatar_url)";

type PhotoLike = { url: string; sort_order: number; room_id: string | null };

/** First property-level photo (room_id null), falling back to any photo. */
export function coverPhoto(p: { property_photos: PhotoLike[] }): string | null {
  const photos = [...(p.property_photos ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return (photos.find((ph) => ph.room_id === null) ?? photos[0])?.url ?? null;
}

export const propertyKeys = {
  all: ["properties"] as const,
  directory: (opts: { featured?: boolean }) =>
    ["properties", "directory", opts] as const,
  detail: (slug: string) => ["properties", "detail", slug] as const,
};

async function fetchDirectory(opts: {
  featured?: boolean;
}): Promise<DirectoryProperty[]> {
  let query = supabase
    .from("properties")
    .select(DIRECTORY_SELECT)
    .eq("is_published", true)
    .is("deleted_at", null);

  if (opts.featured) query = query.eq("is_featured", true);

  const { data, error } = await query
    .order("total_bookings", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as DirectoryProperty[];
}

/** Published properties for the directory (Home / Search). DB is the source of truth. */
export function useDirectoryProperties(opts: { featured?: boolean } = {}) {
  return useQuery({
    queryKey: propertyKeys.directory(opts),
    queryFn: () => fetchDirectory(opts),
  });
}

export type PropertyRoom = {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  currency: string;
  max_guests: number;
  bed_type: string | null;
  inventory_count: number;
  is_active: boolean;
};

export type PropertyReview = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  guest_id: string | null;
  host_response: string | null;
};

export type PropertyDetail = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  city: string | null;
  province: string | null;
  country: string;
  base_price: number | null;
  currency: string;
  avg_rating: number | null;
  total_reviews: number;
  property_type: string;
  max_guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  house_rules: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  cancellation_policy_label: string | null;
  instant_booking: boolean;
  property_photos: {
    url: string;
    sort_order: number;
    room_id: string | null;
  }[];
  property_rooms: PropertyRoom[];
  hosts: {
    display_name: string;
    avatar_url: string | null;
    handle: string;
    is_superhost: boolean;
    avg_rating: number | null;
  } | null;
};

const DETAIL_SELECT =
  "id, slug, name, description, city, province, country, base_price, currency, avg_rating, total_reviews, property_type, max_guests, bedrooms, bathrooms, house_rules, check_in_time, check_out_time, cancellation_policy_label, instant_booking, property_photos(url, sort_order, room_id), property_rooms(id, name, description, base_price, currency, max_guests, bed_type, inventory_count, is_active), hosts(display_name, avatar_url, handle, is_superhost, avg_rating)";

async function fetchPropertyDetail(
  slug: string,
): Promise<PropertyDetail | null> {
  const { data, error } = await supabase
    .from("properties")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as PropertyDetail | null) ?? null;
}

async function fetchPropertyReviews(
  propertyId: string,
): Promise<PropertyReview[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, guest_id, host_response")
    .eq("property_id", propertyId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as PropertyReview[];
}

/** Single published property by slug (listing detail screen). */
export function usePropertyDetail(slug: string) {
  return useQuery({
    queryKey: propertyKeys.detail(slug),
    queryFn: () => fetchPropertyDetail(slug),
    enabled: !!slug,
  });
}

export function usePropertyReviews(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["properties", "reviews", propertyId],
    queryFn: () => fetchPropertyReviews(propertyId as string),
    enabled: !!propertyId,
  });
}
