// One-off data cleanup: listings/businesses/personal addresses created before
// the LocationPicker fix stored the LOCAL MUNICIPALITY (e.g. "Thaba Chweu Local
// Municipality") in the city/town field. This re-derives the real town from the
// saved pin (lat/lng) via the same keyless Photon reverse geocode the picker
// uses, and writes it back. Run:
//   node --env-file=.env.local scripts/fix-municipality-cities.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const PHOTON = "https://photon.komoot.io";
const isMunicipality = (s) => !!s && /municipalit|metropolitan/i.test(s);

function townOf(p) {
  const isPlace = p.osm_key === "place";
  const candidates = [isPlace ? p.name : undefined, p.city, p.locality, p.county];
  return candidates.find((c) => !!c && !isMunicipality(c)) ?? null;
}

async function townFromPin(lat, lng) {
  try {
    const url = new URL(`${PHOTON}/reverse`);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("lang", "en");
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    return f ? townOf(f.properties) : null;
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fixTable(table, idCol = "id") {
  const { data, error } = await admin
    .from(table)
    .select(`${idCol}, city, latitude, longitude`)
    .or("city.ilike.%municipalit%,city.ilike.%metropolitan%")
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (error) {
    console.error(`[${table}] select failed:`, error.message);
    return;
  }
  const rows = data ?? [];
  console.log(`[${table}] ${rows.length} row(s) with a municipality in city`);
  let fixed = 0;
  for (const r of rows) {
    const town = await townFromPin(r.latitude, r.longitude);
    if (town && town !== r.city) {
      const { error: upErr } = await admin
        .from(table)
        .update({ city: town })
        .eq(idCol, r[idCol]);
      if (upErr) console.error(`[${table}] ${r[idCol]} update failed:`, upErr.message);
      else {
        fixed += 1;
        console.log(`[${table}] ${r[idCol]}: "${r.city}" -> "${town}"`);
      }
    } else {
      console.log(`[${table}] ${r[idCol]}: no better town from pin (kept "${r.city}")`);
    }
    await sleep(350); // be gentle on the free geocoder
  }
  console.log(`[${table}] fixed ${fixed}/${rows.length}`);
}

await fixTable("listings");
await fixTable("businesses");
await fixTable("host_personal_details", "host_id");
console.log("Done.");
process.exit(0);
