import { NextResponse, type NextRequest } from "next/server";

import {
  buildIcalFeed,
  collapseConsecutiveDates,
  verifyListingToken,
} from "@/lib/ical";
import { createAdminClient } from "@/lib/supabase/admin";

// Strip a trailing `.ics` from whatever the consumer sent so both
// `/ical/{id}/{token}.ics` and `/ical/{id}/{token}` work.
function stripIcsExt(token: string): string {
  return token.endsWith(".ics") ? token.slice(0, -4) : token;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { listing_id: string; token: string } },
) {
  const listingId = params.listing_id;
  const token = stripIcsExt(params.token);

  if (!/^[0-9a-f-]{36}$/i.test(listingId)) {
    return new NextResponse("Invalid listing id", { status: 400 });
  }

  if (!verifyListingToken(listingId, token)) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  // Admin client: this endpoint is unauthenticated (token-gated) so the
  // user-bound client would have no session. We still only ever expose
  // existing blocked_dates, never any sensitive booking info.
  const supabase = createAdminClient();

  const { data: listing } = await supabase
    .from("properties")
    .select("id, name, deleted_at")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.deleted_at) {
    return new NextResponse("Listing not found", { status: 404 });
  }

  // Pull a 24-month window — enough for most calendar consumers.
  const today = new Date();
  const horizon = new Date(today);
  horizon.setUTCMonth(horizon.getUTCMonth() + 24);

  const { data: blocks } = await supabase
    .from("blocked_dates")
    .select("date, booking_id, reason, room_id, room:property_rooms ( name )")
    .eq("listing_id", listingId)
    .gte("date", today.toISOString().slice(0, 10))
    .lte("date", horizon.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  const blockRows = (blocks ?? []).map((b) => {
    const room = b.room as unknown as { name: string } | null;
    return {
      date: b.date,
      booking_id: b.booking_id,
      reason: b.reason,
      room_name: room?.name ?? null,
    };
  });
  const spans = collapseConsecutiveDates(blockRows);
  const events = spans.map((s) => ({
    startDate: s.startDate,
    endDate: s.endDate,
    summary: s.summary,
    uid: `vilo-blocked-${listingId}-${s.uidSuffix}`,
  }));

  const body = buildIcalFeed({
    calendarName: `${listing.name} availability`,
    events,
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
      // Tell consumers the suggested filename.
      "Content-Disposition": `inline; filename="${listingId}.ics"`,
    },
  });
}
