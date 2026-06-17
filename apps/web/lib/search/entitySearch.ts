import { createServerClient } from "@/lib/supabase/server";

export type SearchHit = {
  id: string;
  kind: "listing" | "booking" | "review" | "refund" | "addon";
  title: string;
  subtitle?: string;
  href: string;
};

export type SearchResult = {
  total: number;
  hits: SearchHit[];
};

const PER_KIND_LIMIT = 5;

export async function searchEntities(rawQuery: string): Promise<SearchResult> {
  const q = rawQuery.trim();
  if (q.length < 2) return { total: 0, hits: [] };

  const supabase = createServerClient();
  const ilike = `%${q.replaceAll("%", "").replaceAll("_", "")}%`;

  const [listings, bookings, reviews, refunds, addons] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, city")
      .or(`name.ilike.${ilike},city.ilike.${ilike}`)
      .is("deleted_at", null)
      .limit(PER_KIND_LIMIT),
    supabase
      .from("bookings")
      .select("id, reference, guest_name, guest_email")
      .or(
        `reference.ilike.${ilike},guest_name.ilike.${ilike},guest_email.ilike.${ilike}`,
      )
      .is("deleted_at", null)
      .limit(PER_KIND_LIMIT),
    supabase
      .from("reviews")
      .select(
        "id, body, rating, listing_id, listings:properties!reviews_listing_id_fkey(name)",
      )
      .ilike("body", ilike)
      .limit(PER_KIND_LIMIT),
    supabase
      .from("refund_requests")
      .select("id, booking_id, status, bookings(reference, guest_name)")
      .or(`host_note.ilike.${ilike},decline_reason.ilike.${ilike}`)
      .is("deleted_at", null)
      .limit(PER_KIND_LIMIT),
    supabase
      .from("addons")
      .select("id, name, description")
      .or(`name.ilike.${ilike},description.ilike.${ilike}`)
      .eq("is_active", true)
      .limit(PER_KIND_LIMIT),
  ]);

  const hits: SearchHit[] = [];

  for (const row of listings.data ?? []) {
    hits.push({
      id: row.id,
      kind: "listing",
      title: row.name,
      subtitle: row.city ?? undefined,
      href: `/dashboard/listings/${row.id}/edit`,
    });
  }

  for (const row of bookings.data ?? []) {
    hits.push({
      id: row.id,
      kind: "booking",
      title: row.reference,
      subtitle: row.guest_name ?? row.guest_email ?? undefined,
      href: `/dashboard/bookings/${row.id}`,
    });
  }

  for (const row of reviews.data ?? []) {
    const listingName = (row.listings as { name?: string } | null)?.name;
    const snippet = (row.body ?? "").slice(0, 80);
    hits.push({
      id: row.id,
      kind: "review",
      title: snippet || `Review (${row.rating}★)`,
      subtitle: listingName
        ? `${row.rating}★ · ${listingName}`
        : `${row.rating}★`,
      href: `/dashboard/reviews`,
    });
  }

  for (const row of refunds.data ?? []) {
    const booking = row.bookings as {
      reference?: string;
      guest_name?: string;
    } | null;
    hits.push({
      id: row.id,
      kind: "refund",
      title: booking?.reference ?? "Refund request",
      subtitle: booking?.guest_name ?? row.status,
      href: `/dashboard/refunds`,
    });
  }

  for (const row of addons.data ?? []) {
    hits.push({
      id: row.id,
      kind: "addon",
      title: row.name,
      subtitle: row.description ?? undefined,
      href: `/dashboard/addons`,
    });
  }

  return { total: hits.length, hits };
}
