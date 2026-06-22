// Full end-to-end test fixture: ONE login-ready host with a complete, realistic
// account AND a PUBLISHED website on the default theme — so the founder can log
// in and exercise every surface (dashboard, properties, rooms, bookings,
// reviews, inbox, and the live tenant site + on-site checkout).
//
// Seeds: auth user (+ guest reviewers) · host · business · 1 guesthouse property
// · 3 rooms · photos · amenities · seasonal pricing · reviews · a spread of
// bookings across statuses · a host_websites site (published) built from the
// DEFAULT theme's page blueprint · channel membership · 1 blog post · 1 contact
// form.
//
// Idempotent: fixed UUIDs (0b… namespace, distinct from seed-demo's 0a…) +
// upserts; website pages/membership are delete-then-insert; bookings only
// transition status on first insert so on_booking_confirmed triggers don't
// double-fire.
//
//   node --env-file=.env.local scripts/seed-test-site.mjs        # from apps/web
//
// Login email/password + subdomain are overridable via env:
//   TEST_HOST_EMAIL, TEST_HOST_PASSWORD, TEST_SUBDOMAIN

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run from apps/web with: node --env-file=.env.local scripts/seed-test-site.mjs",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Credentials + site identity (overridable) ───────────────────────────
const HOST_EMAIL = process.env.TEST_HOST_EMAIL || "host@vilotest.com";
const HOST_PASSWORD = process.env.TEST_HOST_PASSWORD || "ViloTest123!";
const SUBDOMAIN = (process.env.TEST_SUBDOMAIN || "vilotest").toLowerCase();
const SITE_NAME = "Olive Grove Guesthouse";

// ── Fixed UUIDs (0b… namespace) ─────────────────────────────────────────
const HOST_ID = "0b111111-1111-4111-8111-111111111111";
const SUBSCRIPTION_ID = "0b111111-1111-4111-8111-1111111111aa";
const BANKING_ID = "0b111111-1111-4111-8111-1111111111bb";
const PROP = "0b222222-2222-4222-8222-222222222221";
const ROOM_1 = "0b333333-3333-4333-8333-333333333331";
const ROOM_2 = "0b333333-3333-4333-8333-333333333332";
const ROOM_3 = "0b333333-3333-4333-8333-333333333333";
const WEBSITE_ID = "0b999999-9999-4999-8999-999999999991";
const BLOG_CAT = "0b999999-9999-4999-8999-9999999999c1";
const BLOG_POST = "0b999999-9999-4999-8999-9999999999d1";
const FORM_ID = "0b999999-9999-4999-8999-9999999999f1";

const nowIso = () => new Date().toISOString();

// ── Helpers (mirrors scripts/seed-demo.mjs) ─────────────────────────────
async function findUserByEmail(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function ensureAuthUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) return data.user;
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  throw new Error(`Could not create/find auth user ${email}: ${error.message}`);
}

async function up(table, rows, onConflict = "id") {
  for (const row of rows) {
    const { error } = await admin.from(table).upsert(row, { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

async function bookingExists(id) {
  const { data, error } = await admin
    .from("bookings")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`select booking ${id}: ${error.message}`);
  return Boolean(data);
}

async function setBookingStatus(id, patch) {
  const { error } = await admin.from("bookings").update(patch).eq("id", id);
  if (error) throw new Error(`update booking ${id}: ${error.message}`);
}

async function seedBooking(base, finalStatus, { rooms = [], addons = [] } = {}) {
  if (await bookingExists(base.id)) return;
  // Insert as pending, attach rooms/addons, then transition to the final status
  // so the confirm trigger fires naturally (it generates the booking invoice via
  // ensure_booking_invoice — fixed in migration 20260622000000). Completed
  // bookings pass through `confirmed` so they get an invoice too.
  const { error } = await admin
    .from("bookings")
    .insert({ ...base, status: "pending" });
  if (error) throw new Error(`insert booking ${base.id}: ${error.message}`);
  if (rooms.length) await up("booking_rooms", rooms);
  if (addons.length) await up("booking_addons", addons);

  if (finalStatus === "confirmed") {
    await setBookingStatus(base.id, {
      status: "confirmed",
      confirmed_at: nowIso(),
    });
  } else if (finalStatus === "completed") {
    await setBookingStatus(base.id, {
      status: "confirmed",
      confirmed_at: nowIso(),
    });
    await setBookingStatus(base.id, {
      status: "completed",
      checked_out_at: nowIso(),
    });
  } else if (finalStatus === "cancelled_by_guest") {
    await setBookingStatus(base.id, {
      status: "cancelled_by_guest",
      cancelled_at: nowIso(),
      cancelled_by: "guest",
      cancellation_reason: "Change of travel plans",
    });
  }
}

// ── Seed ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding test site into ${URL} …`);

  // 1. Host auth user + profile
  const hostUser = await ensureAuthUser(HOST_EMAIL, HOST_PASSWORD);
  const HOST_UID = hostUser.id;
  await up("user_profiles", [
    {
      id: HOST_UID,
      role: "host",
      full_name: "Lerato van Wyk",
      email: HOST_EMAIL,
      phone: "+27 82 555 0142",
    },
  ]);

  // 2. Host + subscription + banking
  await up("hosts", [
    {
      id: HOST_ID,
      user_id: HOST_UID,
      handle: "olive-grove-guesthouse",
      display_name: SITE_NAME,
      bio: "A family-run guesthouse among the olive groves of the Cape Winelands. Slow mornings, big breakfasts, and a warm welcome.",
      avatar_url:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
      cover_photo_url:
        "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200",
      languages_spoken: ["English", "Afrikaans"],
      is_verified: true,
      is_superhost: true,
      response_rate: 1.0,
      avg_response_hours: 1,
      highlights: ["Winelands local", "Great with families", "Slow-living host"],
    },
  ]);
  await up("subscriptions", [
    {
      id: SUBSCRIPTION_ID,
      host_id: HOST_ID,
      plan: "free",
      status: "active",
      billing_cycle: "monthly",
    },
  ]);

  // 2b. Business — the host-insert trigger creates a default row; find + enrich
  // it (its id ties the property, banking + website together). Resolve it BEFORE
  // banking, which is business-scoped.
  let businessId;
  {
    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("host_id", HOST_ID)
      .eq("is_default", true)
      .maybeSingle();
    businessId = biz?.id;
    if (!businessId) {
      // Defensive: no trigger-created business — make one.
      const FALLBACK_BIZ = "0b111111-1111-4111-8111-1111111111cc";
      await up("businesses", [
        { id: FALLBACK_BIZ, host_id: HOST_ID, is_default: true },
      ]);
      businessId = FALLBACK_BIZ;
    }
    const { error } = await admin
      .from("businesses")
      .update({
        legal_name: "Olive Grove Guesthouse (Pty) Ltd",
        trading_name: SITE_NAME,
        vat_number: "4555012340",
        company_registration_number: "2022/555012/07",
        address_line1: "7 Olive Grove Lane",
        city: "Stellenbosch",
        province: "Western Cape",
        postal_code: "7600",
        country: "ZA",
        default_currency: "ZAR",
        default_language: "en",
      })
      .eq("id", businessId);
    if (error) throw new Error(`enrich business: ${error.message}`);
  }

  await up("eft_banking_details", [
    {
      id: BANKING_ID,
      host_id: HOST_ID,
      business_id: businessId,
      account_holder: "Olive Grove Guesthouse (Pty) Ltd",
      account_number: "62855501420",
      bank_name: "FNB",
      branch_code: "250655",
      account_type: "business",
      label: "Primary",
      is_default: true,
    },
  ]);

  // 3. Property — a flexible guesthouse (whole-place OR per-room bookings)
  await up("properties", [
    {
      id: PROP,
      host_id: HOST_ID,
      business_id: businessId,
      property_type: "accommodation",
      accommodation_type: "guesthouse",
      name: SITE_NAME,
      slug: "olive-grove-guesthouse",
      description:
        "A boutique guesthouse set among working olive groves outside Stellenbosch. Book a single room or take the whole house for a winelands escape.",
      city: "Stellenbosch",
      province: "Western Cape",
      country: "ZA",
      latitude: -33.9321,
      longitude: 18.8602,
      bedrooms: 3,
      bathrooms: 3,
      max_guests: 8,
      base_price: 2600,
      weekend_price: 2900,
      cleaning_fee: 450,
      currency: "ZAR",
      min_nights: 2,
      check_in_time: "14:00",
      check_out_time: "10:00",
      cancellation_policy: "moderate",
      accepts_paystack: true,
      accepts_eft: true,
      booking_mode: "flexible",
      instant_booking: true,
      whole_property_discount_pct: 10,
      weekly_discount_pct: 5,
      monthly_discount_pct: 10,
      is_published: true,
      published_at: nowIso(),
    },
  ]);

  // 4. Three rooms
  await up("property_rooms", [
    {
      id: ROOM_1,
      property_id: PROP,
      name: "Olive Room",
      description: "Cosy queen room opening onto the grove.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 2,
      min_guests: 1,
      base_price: 1300,
      cleaning_fee: 150,
      currency: "ZAR",
      bed_type: "Queen",
      view_type: "Garden",
      room_size_sqm: 22,
      sort_order: 0,
    },
    {
      id: ROOM_2,
      property_id: PROP,
      name: "Vineyard Suite",
      description: "Spacious suite with a private balcony over the vines.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 3,
      min_guests: 1,
      base_price: 1900,
      cleaning_fee: 200,
      currency: "ZAR",
      bed_type: "King",
      view_type: "Vineyard",
      room_size_sqm: 32,
      sort_order: 1,
    },
    {
      id: ROOM_3,
      property_id: PROP,
      name: "Mountain Loft",
      description: "Upstairs loft with sweeping Helderberg views, sleeps 2–3.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 3,
      min_guests: 1,
      base_price: 2100,
      cleaning_fee: 200,
      currency: "ZAR",
      bed_type: "King",
      view_type: "Mountain",
      room_size_sqm: 36,
      sort_order: 2,
    },
  ]);

  // 5. Photos (cover + gallery + per-room covers)
  await up("property_photos", [
    {
      id: "0b666666-6666-4666-8666-666666666601",
      property_id: PROP,
      storage_path: `listing-photos/${PROP}/cover.jpg`,
      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200",
      sort_order: 0,
      caption: "Guesthouse at golden hour",
    },
    {
      id: "0b666666-6666-4666-8666-666666666602",
      property_id: PROP,
      storage_path: `listing-photos/${PROP}/g1.jpg`,
      url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200",
      sort_order: 1,
      caption: "The grove",
    },
    {
      id: "0b666666-6666-4666-8666-666666666603",
      property_id: PROP,
      storage_path: `listing-photos/${PROP}/g2.jpg`,
      url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200",
      sort_order: 2,
      caption: "Lounge",
    },
    {
      id: "0b666666-6666-4666-8666-666666666604",
      property_id: PROP,
      storage_path: `listing-photos/${PROP}/g3.jpg`,
      url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200",
      sort_order: 3,
      caption: "Kitchen & breakfast nook",
    },
    {
      id: "0b666666-6666-4666-8666-6666666666c1",
      property_id: PROP,
      room_id: ROOM_1,
      storage_path: `listing-photos/${PROP}/r1.jpg`,
      url: "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=900",
      sort_order: 4,
      caption: "Olive Room",
    },
    {
      id: "0b666666-6666-4666-8666-6666666666c2",
      property_id: PROP,
      room_id: ROOM_2,
      storage_path: `listing-photos/${PROP}/r2.jpg`,
      url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900",
      sort_order: 5,
      caption: "Vineyard Suite",
    },
    {
      id: "0b666666-6666-4666-8666-6666666666c3",
      property_id: PROP,
      room_id: ROOM_3,
      storage_path: `listing-photos/${PROP}/r3.jpg`,
      url: "https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=900",
      sort_order: 6,
      caption: "Mountain Loft",
    },
  ]);
  // Point each room at its cover photo.
  for (const [room, photo] of [
    [ROOM_1, "0b666666-6666-4666-8666-6666666666c1"],
    [ROOM_2, "0b666666-6666-4666-8666-6666666666c2"],
    [ROOM_3, "0b666666-6666-4666-8666-6666666666c3"],
  ]) {
    await admin
      .from("property_rooms")
      .update({ featured_photo_id: photo })
      .eq("id", room);
  }

  // 6. Amenities
  await up("property_amenities", [
    { id: "0bd00000-0000-4000-8000-000000000001", property_id: PROP, amenity_key: "wifi" },
    { id: "0bd00000-0000-4000-8000-000000000002", property_id: PROP, amenity_key: "pool" },
    { id: "0bd00000-0000-4000-8000-000000000003", property_id: PROP, amenity_key: "breakfast_included" },
    { id: "0bd00000-0000-4000-8000-000000000004", property_id: PROP, amenity_key: "parking" },
    { id: "0bd00000-0000-4000-8000-000000000005", property_id: PROP, amenity_key: "kitchen" },
    { id: "0bd00000-0000-4000-8000-000000000006", property_id: PROP, amenity_key: "braai_bbq" },
    { id: "0bd00000-0000-4000-8000-000000000007", property_id: PROP, amenity_key: "mountain_view" },
    { id: "0bd00000-0000-4000-8000-000000000008", property_id: PROP, amenity_key: "garden" },
  ]);

  // 7. Seasonal pricing
  await up("property_seasonal_pricing", [
    {
      id: "0b555555-5555-4555-8555-555555555501",
      property_id: PROP,
      label: "Festive peak",
      start_date: "2026-12-15",
      end_date: "2027-01-10",
      adjustment_type: "absolute",
      adjustment_value: 3400,
      min_nights: 4,
      priority: 10,
    },
  ]);

  // 8. Bookings across statuses (+ payments)
  const baseGuestUser = await ensureAuthUser("guest@vilotest.com", HOST_PASSWORD);
  const GUEST_UID = baseGuestUser.id;
  await up("user_profiles", [
    {
      id: GUEST_UID,
      role: "guest",
      full_name: "Sipho Dlamini",
      email: "guest@vilotest.com",
      phone: "+27 82 987 6543",
    },
  ]);
  const guest = {
    guest_id: GUEST_UID,
    guest_name: "Sipho Dlamini",
    guest_email: "guest@vilotest.com",
    guest_phone: "+27 82 987 6543",
  };

  // Clear this script's own bookings (+ children) so re-runs land at the right
  // final status (a partially-seeded prior run can leave stale 'pending' rows).
  const ALL_BOOKING_IDS = [
    "0b777777-7777-4777-8777-777777777701",
    "0b777777-7777-4777-8777-777777777702",
    "0b777777-7777-4777-8777-777777777703",
    "0b777777-7777-4777-8777-777777777704",
    "0b777777-7777-4777-8777-7777777777a1",
    "0b777777-7777-4777-8777-7777777777a2",
    "0b777777-7777-4777-8777-7777777777a3",
  ];
  await admin.from("reviews").delete().in("booking_id", ALL_BOOKING_IDS);
  await admin.from("payments").delete().in("booking_id", ALL_BOOKING_IDS);
  await admin.from("booking_rooms").delete().in("booking_id", ALL_BOOKING_IDS);
  await admin.from("booking_addons").delete().in("booking_id", ALL_BOOKING_IDS);
  await admin.from("bookings").delete().in("id", ALL_BOOKING_IDS);

  // B1 — pending request (whole place)
  await seedBooking(
    {
      id: "0b777777-7777-4777-8777-777777777701",
      property_id: PROP,
      host_id: HOST_ID,
      ...guest,
      check_in: "2026-08-14",
      check_out: "2026-08-17",
      guests_count: 4,
      base_amount: 7800,
      cleaning_fee: 450,
      total_amount: 8250,
      currency: "ZAR",
      origin: "guest_request",
      scope: "whole_listing",
      payment_status: "pending",
    },
    "pending",
  );

  // B2 — confirmed, EFT
  await seedBooking(
    {
      id: "0b777777-7777-4777-8777-777777777702",
      property_id: PROP,
      host_id: HOST_ID,
      ...guest,
      check_in: "2026-07-03",
      check_out: "2026-07-06",
      guests_count: 2,
      base_amount: 7800,
      cleaning_fee: 450,
      total_amount: 8250,
      currency: "ZAR",
      origin: "host_manual",
      scope: "whole_listing",
      payment_method: "eft",
      payment_status: "completed",
      host_payment_note: "EFT received, ref VILO-T2.",
    },
    "confirmed",
  );
  await up("payments", [
    {
      id: "0b888888-8888-4888-8888-888888888802",
      booking_id: "0b777777-7777-4777-8777-777777777702",
      amount: 8250,
      method: "eft",
      status: "completed",
      currency: "ZAR",
      captured_at: nowIso(),
    },
  ]);

  // B3 — completed (room scope) → review eligible
  await seedBooking(
    {
      id: "0b777777-7777-4777-8777-777777777703",
      property_id: PROP,
      host_id: HOST_ID,
      ...guest,
      check_in: "2026-05-09",
      check_out: "2026-05-12",
      guests_count: 2,
      base_amount: 3900,
      cleaning_fee: 200,
      total_amount: 4100,
      currency: "ZAR",
      origin: "guest_request",
      scope: "rooms",
      payment_method: "paystack",
      payment_status: "completed",
    },
    "completed",
    {
      rooms: [
        {
          id: "0baf0000-0000-4000-8000-0000000000b1",
          booking_id: "0b777777-7777-4777-8777-777777777703",
          room_id: ROOM_2,
          base_amount: 3900,
          cleaning_fee: 200,
        },
      ],
    },
  );
  await up("payments", [
    {
      id: "0b888888-8888-4888-8888-888888888803",
      booking_id: "0b777777-7777-4777-8777-777777777703",
      amount: 4100,
      method: "paystack",
      status: "completed",
      currency: "ZAR",
      provider_reference: "ps_test_t3",
      captured_at: nowIso(),
    },
  ]);
  await up("reviews", [
    {
      id: "0bcccccc-cccc-4ccc-8ccc-cccccccccc01",
      booking_id: "0b777777-7777-4777-8777-777777777703",
      property_id: PROP,
      host_id: HOST_ID,
      guest_id: GUEST_UID,
      rating: 5,
      body: "The Vineyard Suite was a dream — coffee on the balcony watching the mist lift off the vines. Lerato thought of everything.",
      trip_type: "couples",
      helpful_count: 12,
      is_published: true,
      rating_cleanliness: 5,
      rating_communication: 5,
      rating_checkin: 5,
      rating_accuracy: 5,
      rating_location: 5,
      rating_value: 5,
    },
  ]);

  // B4 — cancelled by guest
  await seedBooking(
    {
      id: "0b777777-7777-4777-8777-777777777704",
      property_id: PROP,
      host_id: HOST_ID,
      ...guest,
      check_in: "2026-09-01",
      check_out: "2026-09-04",
      guests_count: 2,
      base_amount: 7800,
      cleaning_fee: 450,
      total_amount: 8250,
      currency: "ZAR",
      origin: "guest_request",
      scope: "whole_listing",
      payment_method: "paystack",
      payment_status: "completed",
    },
    "cancelled_by_guest",
  );

  // Extra reviewers → completed bookings → published reviews
  const REVIEWERS = [
    {
      email: "nomvula@vilotest.com",
      name: "Nomvula Khumalo",
      bId: "0b777777-7777-4777-8777-7777777777a1",
      rId: "0bcccccc-cccc-4ccc-8ccc-cccccccccca1",
      inDate: "2026-02-10",
      outDate: "2026-02-13",
      rating: 5,
      trip: "family",
      helpful: 18,
      body: "Took the whole house for a family weekend. Big breakfasts, a pool the kids loved, and the quietest nights. We'll be back.",
    },
    {
      email: "jacobus@vilotest.com",
      name: "Jacobus Visser",
      bId: "0b777777-7777-4777-8777-7777777777a2",
      rId: "0bcccccc-cccc-4ccc-8ccc-cccccccccca2",
      inDate: "2026-03-18",
      outDate: "2026-03-21",
      rating: 5,
      trip: "friends",
      helpful: 9,
      body: "Five minutes from the best tasting rooms in Stellenbosch and a world away from the noise. Spotless and effortless.",
    },
    {
      email: "ayanda@vilotest.com",
      name: "Ayanda Radebe",
      bId: "0b777777-7777-4777-8777-7777777777a3",
      rId: "0bcccccc-cccc-4ccc-8ccc-cccccccccca3",
      inDate: "2026-04-02",
      outDate: "2026-04-05",
      rating: 4,
      trip: "solo",
      helpful: 6,
      body: "Came to switch off for a few days and did exactly that. Comfortable bed, great coffee, the road in is a touch bumpy.",
    },
  ];
  for (const rv of REVIEWERS) {
    const u = await ensureAuthUser(rv.email, HOST_PASSWORD);
    await up("user_profiles", [
      { id: u.id, role: "guest", full_name: rv.name, email: rv.email },
    ]);
    await seedBooking(
      {
        id: rv.bId,
        property_id: PROP,
        host_id: HOST_ID,
        guest_id: u.id,
        guest_name: rv.name,
        guest_email: rv.email,
        check_in: rv.inDate,
        check_out: rv.outDate,
        guests_count: 2,
        base_amount: 7800,
        cleaning_fee: 450,
        total_amount: 8250,
        currency: "ZAR",
        origin: "guest_request",
        scope: "whole_listing",
        payment_method: "paystack",
        payment_status: "completed",
      },
      "completed",
    );
    await up("reviews", [
      {
        id: rv.rId,
        booking_id: rv.bId,
        property_id: PROP,
        host_id: HOST_ID,
        guest_id: u.id,
        rating: rv.rating,
        body: rv.body,
        trip_type: rv.trip,
        helpful_count: rv.helpful,
        is_published: true,
        rating_cleanliness: 5,
        rating_communication: 5,
        rating_checkin: 5,
        rating_accuracy: rv.rating >= 5 ? 5 : 4,
        rating_location: 5,
        rating_value: rv.rating >= 5 ? 5 : 4,
      },
    ]);
  }

  // ── 9. WEBSITE — published, on the DEFAULT theme ───────────────────────
  // Load the default theme (its base + page blueprint), exactly like
  // createWebsiteAction's loadDefaultTheme.
  const { data: theme } = await admin
    .from("site_themes")
    .select("slug, base, page_templates")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (!theme) throw new Error("No default theme found in site_themes.");
  const pageTemplates = Array.isArray(theme.page_templates)
    ? theme.page_templates
    : [];

  // The host_websites row (PUBLISHED). brand/seo/conversion all live on the row;
  // the public renderer reads them live when there's no frozen snapshot.
  await up("host_websites", [
    {
      id: WEBSITE_ID,
      business_id: businessId,
      host_id: HOST_ID,
      subdomain: SUBDOMAIN,
      status: "published",
      published_at: nowIso(),
      brand: {
        name: SITE_NAME,
        tagline: "A winelands escape among the olive groves",
        contact: { email: HOST_EMAIL, phone: "+27 82 555 0142" },
        socials: { instagram: "https://instagram.com/olivegrove" },
      },
      theme: theme.base ? { preset: theme.slug, base: theme.base } : { preset: theme.slug },
      seo: {
        title: `${SITE_NAME} — Stellenbosch guesthouse`,
        description:
          "Boutique winelands guesthouse outside Stellenbosch. Book a room or the whole house, direct and fee-free.",
      },
      settings: {},
    },
  ]);

  // Pages from the theme blueprint — published_sections = sections so the public
  // (non-preview) render shows content immediately. Delete-then-insert for idempotency.
  await admin.from("website_pages").delete().eq("website_id", WEBSITE_ID);
  await admin.from("website_pages").insert(
    pageTemplates.map((tpl) => ({
      website_id: WEBSITE_ID,
      kind: tpl.kind,
      slug: tpl.slug,
      title: tpl.title === "Home" ? SITE_NAME : tpl.title,
      nav_label: tpl.nav_label,
      nav_order: tpl.nav_order,
      show_in_nav: tpl.show_in_nav,
      draft_sections: tpl.sections ?? [],
      published_sections: tpl.sections ?? [],
    })),
  );

  // Channel membership — the property + all 3 rooms, visible.
  await admin.from("website_properties").delete().eq("website_id", WEBSITE_ID);
  await admin
    .from("website_properties")
    .insert([
      { website_id: WEBSITE_ID, property_id: PROP, is_visible: true, sort_order: 0 },
    ]);
  await admin.from("website_rooms").delete().eq("website_id", WEBSITE_ID);
  await admin.from("website_rooms").insert(
    [ROOM_1, ROOM_2, ROOM_3].map((room_id, i) => ({
      website_id: WEBSITE_ID,
      room_id,
      is_visible: true,
      sort_order: i,
    })),
  );

  // 10. A blog post + a contact form (best-effort — don't fail the seed if the
  // optional schemas differ).
  try {
    await up("website_blog_categories", [
      { id: BLOG_CAT, website_id: WEBSITE_ID, name: "Travel notes", slug: "travel-notes" },
    ]);
    await up("website_blog_posts", [
      {
        id: BLOG_POST,
        website_id: WEBSITE_ID,
        category_id: BLOG_CAT,
        title: "Five winelands tasting rooms within 15 minutes",
        slug: "five-winelands-tasting-rooms",
        status: "published",
        publish_at: nowIso(),
        excerpt:
          "Our favourite cellars a short drive from the grove — from big names to family secrets.",
        body_html:
          "<p>Stellenbosch is spoiled for choice. Here are five tasting rooms we send every guest to, all within a fifteen-minute drive of Olive Grove.</p>",
        author_name: "Lerato van Wyk",
      },
    ]);
  } catch (e) {
    console.log("  (blog skipped:", e.message, ")");
  }
  try {
    await up("website_forms", [
      {
        id: FORM_ID,
        website_id: WEBSITE_ID,
        type: "contact",
        name: "Contact us",
        // Field ids must be uuids (forms.schema.ts formFieldSchema.id) — the
        // editor generates them; the public render/submit rejects non-uuid ids.
        fields: [
          {
            id: "0b999999-9999-4999-8999-99999999fa01",
            type: "text",
            label: "Your name",
            required: true,
            width: "full",
          },
          {
            id: "0b999999-9999-4999-8999-99999999fa02",
            type: "email",
            label: "Email",
            required: true,
            width: "full",
          },
          {
            id: "0b999999-9999-4999-8999-99999999fa03",
            type: "textarea",
            label: "Message",
            required: true,
            width: "full",
          },
        ],
        settings: {
          submitLabel: "Send message",
          successMessage: "Thanks — we'll be in touch soon!",
          notifyInbox: true,
        },
      },
    ]);
  } catch (e) {
    console.log("  (form skipped:", e.message, ")");
  }

  // 11. Website analytics — a 14-day spread so the Overview/analytics dashboards
  // render real numbers (these are the same rows the live /api/site-track beacon
  // produces). Delete-then-insert keeps re-runs idempotent.
  await admin
    .from("website_analytics_events")
    .delete()
    .eq("website_id", WEBSITE_ID);
  {
    const devices = ["desktop", "desktop", "mobile", "mobile", "desktop"];
    const referrers = [
      null,
      "google.com",
      "facebook.com",
      "instagram.com",
      null,
      "google.com",
    ];
    const paths = ["/", "/", "/rooms", "/about", "/contact", "/", "/rooms"];
    const countries = ["ZA", "ZA", "ZA", "GB", "DE", "ZA", "US"];
    const rows = [];
    const now = Date.now();
    let sess = 0;
    for (let d = 0; d < 14; d++) {
      const dayMs = now - d * 86400000;
      const sessions = 4 + (d % 7); // 4–10 sessions/day
      for (let s = 0; s < sessions; s++) {
        sess++;
        const sessionId = `qa-sess-${d}-${s}`;
        const device = devices[sess % devices.length];
        const referrer = referrers[sess % referrers.length];
        const country = countries[sess % countries.length];
        const views = 1 + (sess % 3);
        for (let v = 0; v < views; v++) {
          rows.push({
            website_id: WEBSITE_ID,
            event: "pageview",
            path: paths[(sess + v) % paths.length],
            session_id: sessionId,
            referrer_host: referrer,
            device,
            country,
            created_at: new Date(dayMs - v * 60000).toISOString(),
          });
        }
        if (sess % 3 === 0) {
          rows.push({
            website_id: WEBSITE_ID,
            event: "booking_click",
            path: "/rooms",
            session_id: sessionId,
            referrer_host: referrer,
            device,
            country,
            created_at: new Date(dayMs).toISOString(),
          });
        }
      }
    }
    let analyticsOk = true;
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin
        .from("website_analytics_events")
        .insert(rows.slice(i, i + 200));
      if (error) {
        console.log("  (analytics skipped:", error.message, ")");
        analyticsOk = false;
        break;
      }
    }
    if (analyticsOk) {
      console.log(
        "   seeded %d website analytics events across 14 days",
        rows.length,
      );
    }
  }

  // ── Done ───────────────────────────────────────────────────────────────
  console.log("\n✅ Test-site seed complete.");
  console.log("   Host login:  %s / %s", HOST_EMAIL, HOST_PASSWORD);
  console.log("   Guest login: %s / %s", "guest@vilotest.com", HOST_PASSWORD);
  console.log(
    "   1 guesthouse property, 3 rooms, 4 published reviews, 7 bookings",
  );
  console.log(
    "   (mixed statuses: pending / confirmed / completed / cancelled + invoices),",
  );
  console.log(
    "   + a PUBLISHED website on the '%s' theme (%d pages), blog post, contact form.",
    theme.slug,
    pageTemplates.length,
  );
  console.log("\n   View the live site (until DNS is configured):");
  console.log("     http://localhost:3001/en/site?site=%s", SUBDOMAIN);
  console.log(
    "   Or in the dashboard: Website → it's published at subdomain '%s'.",
    SUBDOMAIN,
  );
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message ?? err);
  process.exit(1);
});
