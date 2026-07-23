// Seed ONE fully-verified host, ready to use the system, for manual testing.
//
// Creates: 1 host (verified, active, subscribed) + default business + banking,
// 1 published property holding 3 rooms, 3 add-ons (linked to the property so they
// appear at checkout), 3 DIFFERENT specials (one FIXED-date so the checkout can be
// tested against a locked stay), and 1 coupon. NO website is created — the founder
// will build/test the website feature manually.
//
// Re-runnable: every row uses a fixed UUID and is upserted.
//
//   node --env-file=.env.local scripts/seed-single-host.mjs   # from apps/web

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run from apps/web with: node --env-file=.env.local scripts/seed-single-host.mjs",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Login credentials ────────────────────────────────────────────────────
const HOST_EMAIL = "host@wielotest.com";
const HOST_PASSWORD = "WieloTest123!";

// ── Fixed UUIDs (v4-shaped) so re-runs upsert instead of duplicate ─────────
const HOST_ID = "0b111111-1111-4111-8111-111111111111";
const SUBSCRIPTION_ID = "0b111111-1111-4111-8111-1111111111aa";
const BANKING_ID = "0b111111-1111-4111-8111-1111111111bb";
const PROPERTY = "0b222222-2222-4222-8222-222222222221";
const ROOM_1 = "0b333333-3333-4333-8333-333333333331";
const ROOM_2 = "0b333333-3333-4333-8333-333333333332";
const ROOM_3 = "0b333333-3333-4333-8333-333333333333";
const ADDON_1 = "0b444444-4444-4444-8444-444444444441";
const ADDON_2 = "0b444444-4444-4444-8444-444444444442";
const ADDON_3 = "0b444444-4444-4444-8444-444444444443";
const PADDON_1 = "0b444444-4444-4444-8444-4444444444a1";
const PADDON_2 = "0b444444-4444-4444-8444-4444444444a2";
const PADDON_3 = "0b444444-4444-4444-8444-4444444444a3";
const SPECIAL_1 = "0b555555-5555-4555-8555-555555555551";
const SPECIAL_2 = "0b555555-5555-4555-8555-555555555552";
const SPECIAL_3 = "0b555555-5555-4555-8555-555555555553";
const COUPON = "0b666666-6666-4666-8666-666666666661";
const PHOTO = "0b777777-7777-4777-8777-777777777701";

const nowIso = () => new Date().toISOString();

// Small free stock images (Unsplash, w=400 → light thumbnails). Only
// images.unsplash.com and *.supabase.co are allowlisted for next/image.
const uimg = (id, w = 400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=60&auto=format&fit=crop`;

// Room featured-photo ids.
const RPHOTO_1 = "0b777777-7777-4777-8777-7777777777a1";
const RPHOTO_2 = "0b777777-7777-4777-8777-7777777777a2";
const RPHOTO_3 = "0b777777-7777-4777-8777-7777777777a3";

// Add-on images must live in the public `addon-images` bucket — the add-ons page
// resolves image_path via storage.getPublicUrl(), so a raw URL won't render.
async function uploadAddonImage(path, srcUrl) {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`fetch ${srcUrl}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { error } = await admin.storage
    .from("addon-images")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}
const A1_IMG = `${HOST_ID}/addon-welcome-platter.jpg`;
const A2_IMG = `${HOST_ID}/addon-farm-breakfast.jpg`;
const A3_IMG = `${HOST_ID}/addon-stargazing.jpg`;

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function ensureAuthUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error) return data.user;
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  throw new Error(`Could not create or find auth user ${email}: ${error.message}`);
}

async function up(table, rows, onConflict = "id") {
  for (const row of rows) {
    const { error } = await admin.from(table).upsert(row, { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

async function main() {
  console.log(`Seeding single verified host into ${URL} ...`);

  // 1. Auth user + profile
  const hostUser = await ensureAuthUser(HOST_EMAIL, HOST_PASSWORD);
  const HOST_UID = hostUser.id;
  await up("user_profiles", [
    // email_verified_at pre-set so the hard email-verification wall doesn't block the seed host.
    { id: HOST_UID, role: "host", full_name: "Lerato Nkosi", email: HOST_EMAIL, phone: "+27820001111", email_verified_at: new Date().toISOString() },
  ]);

  // 2. Host — fully verified so it can use the whole system.
  await up("hosts", [
    {
      id: HOST_ID,
      user_id: HOST_UID,
      handle: "wielo-test-host",
      display_name: "Karoo Sky Stays",
      bio: "Star-gazing stays and slow mornings in the Great Karoo.",
      avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
      cover_photo_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200",
      languages_spoken: ["English", "Afrikaans"],
      is_verified: true,
    },
  ]);

  // The host-insert trigger creates a default business; banking/properties/specials
  // are business-scoped.
  const { data: bizRow } = await admin
    .from("businesses")
    .select("id")
    .eq("host_id", HOST_ID)
    .eq("is_default", true)
    .maybeSingle();
  const BUSINESS_ID = bizRow?.id;
  if (!BUSINESS_ID) throw new Error("No default business created for host");

  // Full verification signals + response metrics (direct UPDATE — omitting `handle`
  // in an upsert would trip its NOT NULL).
  {
    const { error } = await admin
      .from("hosts")
      .update({
        is_active: true,
        is_verified: true,
        is_superhost: true,
        phone_verified: true,
        payout_verified: true,
        response_rate: 1.0,
        avg_response_hours: 1,
      })
      .eq("id", HOST_ID);
    if (error) throw new Error(`update hosts verification: ${error.message}`);
  }

  // Top plan so every feature is unlocked — the founder can test the whole system
  // (add-ons, specials, website, etc. are tier-gated; `business` clears them all).
  await up("subscriptions", [
    { id: SUBSCRIPTION_ID, host_id: HOST_ID, plan: "business", status: "active", billing_cycle: "monthly" },
  ]);

  // Pre-MVP smoke-test unlock (AGENT_RULES.md §3.4): open every gated feature for
  // this host via per-host overrides, which check_feature_permission resolves FIRST
  // — independent of plan/product. Newer features (add-ons, website) are
  // product-gated and have no plan_features row, so an override is the reliable way
  // to let the founder test the whole system.
  {
    const UNLIMITED = { staff_seats: 99, listings_limit: 99, inbox_limit: 999 };
    const FEATURES = [
      "addons", "reporting", "banking_details",
      "directory_listing", "directory_priority", "looking_for_access", "policies",
      "seasonal_pricing", "website_builder", "coupons", "direct_booking",
      "enquiry_only", "inbox_messages", "payment_paystack", "payment_paypal",
      "payment_eft", "reviews_respond", "calendar_management", "instant_booking",
      "custom_profile_url", "export_bookings", "canned_replies",
      "staff_seats", "listings_limit", "inbox_limit",
    ];
    const rows = FEATURES.map((feature_key) => ({
      host_id: HOST_ID,
      feature_key,
      is_enabled: true,
      limit_value: UNLIMITED[feature_key] ?? null,
      reason: "Pre-MVP smoke-test: unlock all features for founder testing (AGENT_RULES.md §3.4)",
      overridden_by: HOST_UID,
    }));
    await up("host_feature_overrides", rows, "host_id,feature_key");
  }

  await up("eft_banking_details", [
    {
      id: BANKING_ID,
      host_id: HOST_ID,
      business_id: BUSINESS_ID,
      account_holder: "Karoo Sky Stays (Pty) Ltd",
      account_number: "62800011122",
      bank_name: "FNB",
      branch_code: "250655",
      account_type: "business",
      label: "Primary",
      is_default: true,
    },
  ]);

  {
    const { error } = await admin
      .from("businesses")
      .update({
        legal_name: "Karoo Sky Stays (Pty) Ltd",
        trading_name: "Karoo Sky Stays",
        vat_number: "4987654321",
        company_registration_number: "2022/654321/07",
        address_line1: "1 Church Street",
        city: "Prince Albert",
        postal_code: "6930",
        country: "ZA",
      })
      .eq("id", BUSINESS_ID);
    if (error) throw new Error(`update default business: ${error.message}`);
  }

  // 3. One property (flexible → rooms bookable) with a cover photo + amenities.
  await up("properties", [
    {
      id: PROPERTY,
      host_id: HOST_ID,
      business_id: BUSINESS_ID,
      property_type: "accommodation",
      accommodation_type: "guesthouse",
      name: "Karoo Sky Guesthouse, Prince Albert",
      slug: "karoo-sky-guesthouse-prince-albert",
      description:
        "A restored Karoo guesthouse with three individually styled rooms, big skies and darker-than-dark nights.",
      city: "Prince Albert",
      province: "Western Cape",
      country: "ZA",
      latitude: -33.2214,
      longitude: 22.0353,
      bedrooms: 3,
      bathrooms: 3,
      max_guests: 6,
      base_price: 1600,
      weekend_price: 1850,
      cleaning_fee: 300,
      currency: "ZAR",
      min_nights: 1,
      check_in_time: "14:00",
      check_out_time: "10:00",
      cancellation_policy: "moderate",
      accepts_paystack: true,
      accepts_eft: true,
      booking_mode: "flexible",
      instant_booking: true,
      is_published: true,
      published_at: nowIso(),
    },
  ]);

  await up("property_photos", [
    {
      id: PHOTO,
      property_id: PROPERTY,
      storage_path: `listing-photos/${PROPERTY}/cover.jpg`,
      url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200",
      sort_order: 0,
      caption: "Karoo Sky Guesthouse at dusk",
    },
  ]);

  await up("property_amenities", [
    { id: "0bd00000-0000-4000-8000-0000000000a1", property_id: PROPERTY, amenity_key: "wifi" },
    { id: "0bd00000-0000-4000-8000-0000000000a2", property_id: PROPERTY, amenity_key: "parking" },
    { id: "0bd00000-0000-4000-8000-0000000000a3", property_id: PROPERTY, amenity_key: "breakfast_included" },
    { id: "0bd00000-0000-4000-8000-0000000000a4", property_id: PROPERTY, amenity_key: "braai_bbq" },
  ]);

  // 4. THREE rooms.
  await up("property_rooms", [
    {
      id: ROOM_1,
      property_id: PROPERTY,
      name: "Milkyway Room",
      description: "Queen room with a private stoep facing the night sky.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 2,
      base_price: 1200,
      cleaning_fee: 120,
      currency: "ZAR",
      bed_type: "Queen",
      view_type: "Mountain",
      sort_order: 0,
    },
    {
      id: ROOM_2,
      property_id: PROPERTY,
      name: "Aloe Suite",
      description: "Spacious suite with a fireplace and a deep bath.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 3,
      base_price: 1600,
      cleaning_fee: 150,
      currency: "ZAR",
      bed_type: "King",
      view_type: "Garden",
      sort_order: 1,
    },
    {
      id: ROOM_3,
      property_id: PROPERTY,
      name: "Klein Cottage Room",
      description: "Cosy twin room, perfect for two travellers.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 2,
      base_price: 1000,
      cleaning_fee: 120,
      currency: "ZAR",
      bed_type: "Twin",
      view_type: "Courtyard",
      sort_order: 2,
    },
  ]);

  // 4b. A small cover photo per room + point each room at it.
  await up("property_photos", [
    { id: RPHOTO_1, property_id: PROPERTY, room_id: ROOM_1, storage_path: `listing-photos/${PROPERTY}/r1.jpg`, url: uimg("1522708323590-d24dbb6b0267"), sort_order: 1, caption: "Milkyway Room" },
    { id: RPHOTO_2, property_id: PROPERTY, room_id: ROOM_2, storage_path: `listing-photos/${PROPERTY}/r2.jpg`, url: uimg("1631049307264-da0ec9d70304"), sort_order: 2, caption: "Aloe Suite" },
    { id: RPHOTO_3, property_id: PROPERTY, room_id: ROOM_3, storage_path: `listing-photos/${PROPERTY}/r3.jpg`, url: uimg("1560448204-e02f11c3d0e2"), sort_order: 3, caption: "Klein Cottage Room" },
  ]);
  {
    const pairs = [
      [ROOM_1, RPHOTO_1, 20],
      [ROOM_2, RPHOTO_2, 28],
      [ROOM_3, RPHOTO_3, 16],
    ];
    for (const [roomId, photoId, sqm] of pairs) {
      const { error } = await admin
        .from("property_rooms")
        .update({ featured_photo_id: photoId, room_size_sqm: sqm })
        .eq("id", roomId);
      if (error) throw new Error(`set room featured photo: ${error.message}`);
    }
  }

  // 4d. Seasonal pricing rules (property_seasonal_pricing): a mix of an absolute
  //     peak, a percent off-peak, and a room-scoped rule — priority-ordered.
  await up("property_seasonal_pricing", [
    {
      id: "0b888888-8888-4888-8888-888888888851",
      property_id: PROPERTY,
      room_id: null,
      label: "Festive Peak",
      start_date: "2026-12-15",
      end_date: "2027-01-10",
      adjustment_type: "absolute",
      adjustment_value: 2400,
      currency: "ZAR",
      min_nights: 3,
      priority: 10,
      is_active: true,
    },
    {
      id: "0b888888-8888-4888-8888-888888888852",
      property_id: PROPERTY,
      room_id: null,
      label: "Winter Off-Peak (−15%)",
      start_date: "2026-07-01",
      end_date: "2026-08-31",
      adjustment_type: "percent",
      adjustment_value: -15,
      currency: "ZAR",
      priority: 1,
      is_active: true,
    },
    {
      id: "0b888888-8888-4888-8888-888888888853",
      property_id: PROPERTY,
      room_id: ROOM_2, // Aloe Suite only
      label: "Aloe Suite spring peak",
      start_date: "2026-09-20",
      end_date: "2026-10-05",
      adjustment_type: "absolute",
      adjustment_value: 2000,
      currency: "ZAR",
      priority: 5,
      is_active: true,
    },
  ]);

  // 5. THREE add-ons (with uploaded bucket images) + link each to the property.
  await uploadAddonImage(A1_IMG, uimg("1452195100486-9cc805987862"));
  await uploadAddonImage(A2_IMG, uimg("1533089860892-a7c6f0a88666"));
  await uploadAddonImage(A3_IMG, uimg("1419242902214-272b3f66ee7a"));
  await up("addons", [
    {
      id: ADDON_1,
      host_id: HOST_ID,
      name: "Welcome platter",
      description: "Local cheeses, preserves and a bottle of Karoo red on arrival.",
      pricing_model: "per_stay",
      unit_price: 450,
      currency: "ZAR",
      image_path: A1_IMG,
    },
    {
      id: ADDON_2,
      host_id: HOST_ID,
      name: "Farm breakfast",
      description: "Full breakfast served on the stoep each morning.",
      pricing_model: "per_guest_per_night",
      unit_price: 140,
      currency: "ZAR",
      image_path: A2_IMG,
    },
    {
      id: ADDON_3,
      host_id: HOST_ID,
      name: "Guided stargazing",
      description: "One-hour telescope session with a local astronomer.",
      pricing_model: "per_night",
      unit_price: 350,
      currency: "ZAR",
      image_path: A3_IMG,
    },
  ]);
  await up("property_addons", [
    { id: PADDON_1, property_id: PROPERTY, addon_id: ADDON_1 },
    { id: PADDON_2, property_id: PROPERTY, addon_id: ADDON_2 },
    { id: PADDON_3, property_id: PROPERTY, addon_id: ADDON_3 },
  ]);

  // 6. THREE deliberately-different specials.
  await up("specials", [
    // #1 — FIXED dates + flat total (whole property). Use this to test checkout
    //      against a locked stay (1–4 Aug 2026, R4200 for the 3 nights).
    {
      id: SPECIAL_1,
      host_id: HOST_ID,
      business_id: BUSINESS_ID,
      property_id: PROPERTY,
      room_id: null,
      slug: "karoo-fixed-stargazer-weekend",
      title: "Stargazer Weekend (fixed dates)",
      description: "Locked 3-night getaway over the new-moon weekend — whole guesthouse.",
      badge: "New moon",
      hero_image_path: uimg("1419242902214-272b3f66ee7a", 800),
      date_mode: "fixed",
      fixed_check_in: "2026-08-01",
      fixed_check_out: "2026-08-04",
      price_mode: "flat",
      flat_total: 4200,
      currency: "ZAR",
      max_guests: 6,
      was_price: 5100,
      savings_amount: 900,
      savings_pct: 18,
      quantity: 3,
      book_by: "2026-07-31",
      show_in_directory: true,
      show_on_website: true,
      status: "active",
    },
    // #2 — FLEXIBLE window + per-night pricing (whole property).
    {
      id: SPECIAL_2,
      host_id: HOST_ID,
      business_id: BUSINESS_ID,
      property_id: PROPERTY,
      room_id: null,
      slug: "karoo-midweek-escape",
      title: "Midweek Escape (flexible)",
      description: "Any 2+ nights, Sun–Thu, through spring — book the whole house at a reduced nightly rate.",
      badge: "Midweek",
      hero_image_path: uimg("1566073771259-6a8506099945", 800),
      date_mode: "flexible",
      window_start: "2026-07-10",
      window_end: "2026-11-30",
      min_nights: 2,
      max_nights: 14,
      price_mode: "per_night",
      per_night_price: 1350,
      currency: "ZAR",
      max_guests: 6,
      was_price: 1600,
      savings_amount: 250,
      savings_pct: 16,
      quantity: 20,
      book_by: "2026-11-25",
      show_in_directory: true,
      show_on_website: true,
      status: "active",
    },
    // #3 — FLEXIBLE window, single ROOM, flat weekend price.
    {
      id: SPECIAL_3,
      host_id: HOST_ID,
      business_id: BUSINESS_ID,
      property_id: PROPERTY,
      room_id: ROOM_1,
      slug: "milkyway-room-flash",
      title: "Milkyway Room Flash (single room)",
      description: "Two nights in the Milkyway Room for a flat weekend price.",
      badge: "Room deal",
      hero_image_path: uimg("1522708323590-d24dbb6b0267", 800),
      date_mode: "flexible",
      window_start: "2026-07-10",
      window_end: "2026-10-31",
      min_nights: 2,
      max_nights: 2,
      price_mode: "flat",
      flat_total: 2100,
      currency: "ZAR",
      max_guests: 2,
      was_price: 2400,
      savings_amount: 300,
      savings_pct: 12,
      quantity: 10,
      book_by: "2026-10-25",
      show_in_directory: true,
      show_on_website: true,
      status: "active",
    },
  ]);

  // 7. One coupon — 10% off the whole order, all properties.
  await up("coupons", [
    {
      id: COUPON,
      host_id: HOST_ID,
      code: "KAROO10",
      description: "10% off your stay — welcome to Karoo Sky.",
      discount_type: "percent",
      discount_value: 10,
      scope: "order",
      property_id: null,
      currency: "ZAR",
      min_nights: 1,
      starts_at: "2026-07-01T00:00:00Z",
      ends_at: "2026-12-31T23:59:59Z",
      max_redemptions: 100,
      per_guest_limit: 1,
      is_active: true,
    },
  ]);

  console.log("\n✅ Single-host seed complete.");
  console.log("   Host login: %s / %s", HOST_EMAIL, HOST_PASSWORD);
  console.log("   1 property, 3 rooms, 3 add-ons, 3 specials (1 fixed-date), 1 coupon (KAROO10).");
  console.log("   All rooms/add-ons/specials have small stock images.");
  console.log("   3 seasonal pricing rules (absolute peak, percent off-peak, room-scoped).");
  console.log("   No website created — build/test that manually.");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message ?? err);
  process.exit(1);
});
