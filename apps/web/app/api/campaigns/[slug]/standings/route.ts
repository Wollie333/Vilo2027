import { NextResponse } from "next/server";

import {
  loadCampaignLeaderboard,
  toPublicRows,
} from "@/lib/affiliate/leaderboard";

// The 30-second poll behind LiveStandings. It goes through the SAME
// loadCampaignLeaderboard the pages render from, so the first paint and every
// refresh after it can never disagree about a standing.
//
// This is an UNAUTHENTICATED endpoint (the campaign page is public), so it
// mirrors that page's gates — a draft/archived campaign, or one whose
// leaderboard is not public, is 404 here exactly as it is there — and it
// returns only the anonymised public fields.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const data = await loadCampaignLeaderboard(params.slug);
  if (!data) return new NextResponse(null, { status: 404 });

  const { campaign } = data;
  if (campaign.status === "draft" || campaign.status === "archived") {
    return new NextResponse(null, { status: 404 });
  }
  if ((campaign.competition?.leaderboard_visibility ?? "public") !== "public") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(
    { rows: toPublicRows(data.rows) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
