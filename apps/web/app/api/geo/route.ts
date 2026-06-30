import { NextResponse } from "next/server";

import {
  geocodeByPlaceId,
  placesAutocomplete,
  reverseGeocode,
} from "@/lib/geo/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server proxy for the address picker — keeps GOOGLE_MAPS_API_KEY off the
// client. Public (signup runs pre-auth), so a light same-origin guard + the
// hidden key + Google's project quotas are the abuse protection.
//   ?op=autocomplete&q=...        → { suggestions: [{ placeId, main, secondary }] }
//   ?op=place&id=<placeId>        → { address }
//   ?op=reverse&lat=..&lng=..     → { address }
function blockedCrossSite(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false; // same-origin GETs usually omit Origin
  try {
    return new URL(origin).host !== new URL(req.url).host;
  } catch {
    return true;
  }
}

export async function GET(req: Request) {
  if (blockedCrossSite(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");
  try {
    if (op === "autocomplete") {
      const q = searchParams.get("q") ?? "";
      return NextResponse.json({ suggestions: await placesAutocomplete(q) });
    }
    if (op === "place") {
      const id = searchParams.get("id") ?? "";
      if (!id)
        return NextResponse.json({ error: "missing id" }, { status: 400 });
      return NextResponse.json({ address: await geocodeByPlaceId(id) });
    }
    if (op === "reverse") {
      const lat = Number(searchParams.get("lat"));
      const lng = Number(searchParams.get("lng"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json({ error: "bad coords" }, { status: 400 });
      }
      return NextResponse.json({ address: await reverseGeocode(lat, lng) });
    }
    return NextResponse.json({ error: "bad op" }, { status: 400 });
  } catch {
    return NextResponse.json({ suggestions: [], address: {} }, { status: 200 });
  }
}
