import { notFound, redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

// Friendly alias: wielo.co.za/race → the competition currently running.
//
// The canonical page stays /competitions/[slug] (data-driven, so season 2 and
// any future competition get one for free). This is just the short URL that
// goes on a poster or in a WhatsApp message, resolving to whichever campaign is
// live right now — so marketing never has to reprint a link when the season
// rolls over.
export const dynamic = "force-dynamic";

export default async function RaceAliasPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("affiliate_campaigns")
    .select("slug, competition")
    .eq("status", "active")
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  // No live competition, or its leaderboard is not public → nothing to show.
  if (!data) notFound();
  const visibility =
    (data.competition as { leaderboard_visibility?: string } | null)
      ?.leaderboard_visibility ?? "public";
  if (visibility !== "public") notFound();

  redirect(`/competitions/${data.slug}`);
}
