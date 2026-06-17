// Live-DB check for W9 (Rooms tab). Confirms the join the Rooms editor + public
// renderer rely on (website_rooms ⨝ property_rooms) reads, and round-trips a
// website_rooms override row (visibility + cosmetic display_* + sort_order) on a
// real site without leaving residue. Net read-only (probe row removed/restored).
// Run: node --env-file=.env.local scripts/verify-website-rooms.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failed = false;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  failed = true;
  console.error(`  ✗ ${m}`);
};

// 1. The columns the loader selects must exist.
const { error: colErr } = await sb
  .from("website_rooms")
  .select(
    "id, website_id, room_id, is_visible, display_name, display_price, display_currency, display_desc, sort_order",
  )
  .limit(1);
if (colErr) bad(`website_rooms columns: ${colErr.message}`);
else ok("website_rooms exposes all editor/override columns");

// 2. The editor join (properties → property_rooms) reads.
const { error: prErr } = await sb
  .from("property_rooms")
  .select(
    "id, property_id, name, base_price, currency, description, is_active, sort_order",
  )
  .limit(1);
if (prErr) bad(`property_rooms columns: ${prErr.message}`);
else ok("property_rooms exposes all editor base columns");

// 3. Override round-trip on a real site that has at least one room.
const { data: site } = await sb
  .from("host_websites")
  .select("id, business_id")
  .is("deleted_at", null)
  .limit(1)
  .maybeSingle();

if (!site) {
  console.log("  • no host_websites row yet — skipping override round-trip");
} else {
  const { data: props } = await sb
    .from("properties")
    .select("id")
    .eq("business_id", site.business_id)
    .is("deleted_at", null);
  const propertyIds = (props ?? []).map((p) => p.id);
  const { data: room } = propertyIds.length
    ? await sb
        .from("property_rooms")
        .select("id")
        .in("property_id", propertyIds)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!room) {
    console.log("  • site has no rooms — skipping override round-trip");
  } else {
    // Snapshot any existing override so we can restore exactly.
    const { data: existing } = await sb
      .from("website_rooms")
      .select("*")
      .eq("website_id", site.id)
      .eq("room_id", room.id)
      .maybeSingle();

    const { error: upErr } = await sb
      .from("website_rooms")
      .upsert(
        {
          website_id: site.id,
          room_id: room.id,
          is_visible: false,
          display_name: "__w9_probe",
          display_price: 1234.56,
          display_currency: "USD",
          display_desc: "__w9_probe_desc",
          sort_order: 99,
        },
        { onConflict: "website_id,room_id" },
      );
    if (upErr) bad(`upsert website_rooms override: ${upErr.message}`);

    const { data: after } = await sb
      .from("website_rooms")
      .select("is_visible, display_name, display_price, display_currency")
      .eq("website_id", site.id)
      .eq("room_id", room.id)
      .single();
    if (
      after?.display_name === "__w9_probe" &&
      Number(after?.display_price) === 1234.56 &&
      after?.display_currency === "USD" &&
      after?.is_visible === false
    ) {
      ok("website_rooms override upsert round-trips");
    } else {
      bad("website_rooms override probe did not read back");
    }

    // Restore exactly.
    if (existing) {
      await sb
        .from("website_rooms")
        .update({
          is_visible: existing.is_visible,
          display_name: existing.display_name,
          display_price: existing.display_price,
          display_currency: existing.display_currency,
          display_desc: existing.display_desc,
          sort_order: existing.sort_order,
        })
        .eq("website_id", site.id)
        .eq("room_id", room.id);
      ok("restored original override row");
    } else {
      await sb
        .from("website_rooms")
        .delete()
        .eq("website_id", site.id)
        .eq("room_id", room.id);
      ok("removed probe override row");
    }
  }
}

// 4. Help article landed.
const { data: help } = await sb
  .from("help_articles")
  .select("slug, status")
  .eq("slug", "website-rooms")
  .maybeSingle();
if (help?.status === "published") ok("help article website-rooms published");
else bad("help article website-rooms missing");

console.log(failed ? "\n✗ W9 verify FAILED" : "\n🎉 W9 verify passed");
process.exit(failed ? 1 : 0);
