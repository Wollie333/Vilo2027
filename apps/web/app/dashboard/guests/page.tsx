import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";

import { GuestsBoard, type GuestRow, type GuestSummary } from "./GuestsBoard";

export const metadata: Metadata = {
  title: "Guests",
};

// Reads Supabase per-request (filters live in the URL) — never cache.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const SEGMENTS = new Set(["all", "vip", "returning", "new", "ota", "lapsed"]);
const SORTS = new Set(["recent", "value", "stays", "name"]);

type SearchParams = {
  seg?: string;
  sort?: string;
  q?: string;
  page?: string;
  listing?: string;
  channel?: string;
  rating?: string;
};

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/guests");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  // Platform staff / mid-onboarding hosts have no hosts row → empty board.
  if (!host) {
    return (
      <GuestsBoard
        summary={null}
        guests={[]}
        totalCount={0}
        listings={[]}
        seg="all"
        sort="recent"
        q=""
        listingId=""
        channel=""
        rating=""
        page={1}
        pageSize={PAGE_SIZE}
      />
    );
  }

  const seg = SEGMENTS.has(searchParams.seg ?? "") ? searchParams.seg! : "all";
  const sort = SORTS.has(searchParams.sort ?? "")
    ? searchParams.sort!
    : "recent";
  const q = (searchParams.q ?? "").trim();
  const listingId = (searchParams.listing ?? "").trim();
  const channel = (searchParams.channel ?? "").trim();
  const rating = (searchParams.rating ?? "").trim();
  const minRating = rating ? Number.parseFloat(rating) : null;
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const [{ data: summary }, { data: list }, { data: listingRows }] =
    await Promise.all([
      supabase.rpc("fetch_host_guests_summary", { p_host_id: host.id }),
      supabase.rpc("fetch_host_guests", {
        p_host_id: host.id,
        p_segment: seg,
        p_search: q || null,
        p_listing_id: listingId || null,
        p_channel: channel || null,
        p_min_rating: minRating,
        p_sort: sort,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      }),
      supabase
        .from("listings")
        .select("id, name")
        .eq("host_id", host.id)
        .is("deleted_at", null)
        .order("name"),
    ]);

  const listObj = (list ?? {}) as { guests?: GuestRow[]; total_count?: number };

  return (
    <GuestsBoard
      summary={(summary as GuestSummary | null) ?? null}
      guests={listObj.guests ?? []}
      totalCount={listObj.total_count ?? 0}
      listings={(listingRows ?? []) as { id: string; name: string }[]}
      seg={seg}
      sort={sort}
      q={q}
      listingId={listingId}
      channel={channel}
      rating={rating}
      page={page}
      pageSize={PAGE_SIZE}
    />
  );
}
