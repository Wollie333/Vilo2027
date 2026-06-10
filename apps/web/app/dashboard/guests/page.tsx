import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { gkeyFor } from "@/lib/guests/gkey";
import { throwOnError } from "@/lib/supabase/query";
import { createServerClient } from "@/lib/supabase/server";

import {
  GuestsBoard,
  type AcceptedQuoteLite,
  type GuestRow,
  type GuestSummary,
} from "./GuestsBoard";

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
        acceptedQuotes={{}}
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

  // All four reads depend only on host.id (+ filters from the URL), so fetch
  // them in one wave instead of awaiting the accepted-quotes query separately.
  const [summary, list, listingRows, { data: acceptedRows }] =
    await Promise.all([
      throwOnError(
        supabase.rpc("fetch_host_guests_summary", { p_host_id: host.id }),
        "dashboard/guests:summary",
      ),
      throwOnError(
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
        "dashboard/guests:list",
      ),
      throwOnError(
        supabase
          .from("listings")
          .select("id, name")
          .eq("host_id", host.id)
          .is("deleted_at", null)
          .order("name"),
        "dashboard/guests:listings",
      ),
      // Accepted-but-not-converted quotes → pulsing "Quote accepted" pill on
      // the matching guest row (keyed by the same gkey scheme the directory
      // uses).
      supabase
        .from("quotes")
        .select("id, guest_id, guest_email, total_amount, currency")
        .eq("host_id", host.id)
        .eq("status", "accepted")
        .is("deleted_at", null),
    ]);

  const listObj = (list ?? {}) as { guests?: GuestRow[]; total_count?: number };

  const acceptedQuotes: Record<string, AcceptedQuoteLite> = {};
  for (const q of acceptedRows ?? []) {
    const gkey = gkeyFor(q.guest_id, q.guest_email);
    if (gkey && !acceptedQuotes[gkey]) {
      acceptedQuotes[gkey] = {
        id: q.id,
        amount: Number(q.total_amount),
        currency: q.currency,
      };
    }
  }

  return (
    <GuestsBoard
      summary={(summary as GuestSummary | null) ?? null}
      guests={listObj.guests ?? []}
      acceptedQuotes={acceptedQuotes}
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
