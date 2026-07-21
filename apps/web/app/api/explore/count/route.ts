import { NextResponse } from "next/server";

import {
  searchListings,
  type BrowseSearchParams,
} from "@/app/_components/browse/searchListings";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preview count for the /explore filter sheet: "Show 12 stays" BEFORE applying.
// It runs the SAME loader the page runs, so the previewed number and the
// applied result set cannot disagree. `page` is deliberately not forwarded —
// this is the total across all pages, which is what the page header shows too.
// `priorityCountry` is not passed either: it only re-orders the two country
// buckets, and the total is counted with the same filters either way.
const KEYS = [
  "where",
  "guests",
  "type",
  "sort",
  "min_price",
  "max_price",
  "bedrooms",
  "bathrooms",
  "amenities",
  "instant",
  "rating",
  "verified",
] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const params: BrowseSearchParams = {};
  for (const key of KEYS) {
    const value = searchParams.get(key);
    if (value !== null) params[key] = value;
  }
  const result = await searchListings(
    createServerClient(),
    params,
    "/explore",
    null,
  );
  return NextResponse.json({ count: result.totalCount });
}
