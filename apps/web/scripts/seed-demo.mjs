// Demo seed for host-side feature verification.
//
// Creates ONE login-ready host (+ one guest) and an idempotent set of demo
// data so every host dashboard feature has something realistic to render:
// listings, rooms, photos, amenities, seasonal pricing, add-ons, bookings
// across every status, payments, a pending refund request, auto-generated
// invoices, a conversation, and a review.
//
// Runs against whatever Supabase project apps/web/.env.local points to, using
// the service-role key (RLS bypassed). Re-runnable: every row uses a fixed UUID
// and is upserted, and booking status transitions only run for brand-new
// bookings so the on_booking_confirmed counters/triggers don't double-fire.
//
//   pnpm --filter web seed:demo
//   (or)  node --env-file=.env.local scripts/seed-demo.mjs   # from apps/web

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run from apps/web with: node --env-file=.env.local scripts/seed-demo.mjs",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Demo login credentials ──────────────────────────────────────────────
const HOST_EMAIL = "host@vilodemo.com";
const HOST_PASSWORD = "ViloDemo123!";
const GUEST_EMAIL = "guest@vilodemo.com";
const GUEST_PASSWORD = "ViloDemo123!";

// ── Fixed UUIDs (v4-shaped) so re-runs upsert instead of duplicate ───────
const HOST_ID = "0a111111-1111-4111-8111-111111111111";
const SUBSCRIPTION_ID = "0a111111-1111-4111-8111-1111111111aa";
const BANKING_ID = "0a111111-1111-4111-8111-1111111111bb";
const LISTING_A = "0a222222-2222-4222-8222-222222222221"; // whole_listing
const LISTING_B = "0a222222-2222-4222-8222-222222222222"; // rooms / flexible
const ROOM_1 = "0a333333-3333-4333-8333-333333333331";
const ROOM_2 = "0a333333-3333-4333-8333-333333333332";
const ADDON_1 = "0a444444-4444-4444-8444-444444444441";
const ADDON_2 = "0a444444-4444-4444-8444-444444444442";
const LISTING_ADDON_1 = "0a444444-4444-4444-8444-4444444444a1";
const SEASON_1 = "0a555555-5555-4555-8555-555555555551";
const PHOTO_A = "0a666666-6666-4666-8666-666666666661";
const PHOTO_B = "0a666666-6666-4666-8666-666666666662";
const B1 = "0a777777-7777-4777-8777-777777777701"; // pending  / guest_request
const B2 = "0a777777-7777-4777-8777-777777777702"; // confirmed / host_manual EFT
const B3 = "0a777777-7777-4777-8777-777777777703"; // completed / paystack (review)
const B4 = "0a777777-7777-4777-8777-777777777704"; // cancelled / refund pending
const B5 = "0a777777-7777-4777-8777-777777777705"; // confirmed / rooms scope
const PAY_2 = "0a888888-8888-4888-8888-888888888802";
const PAY_3 = "0a888888-8888-4888-8888-888888888803";
const PAY_4 = "0a888888-8888-4888-8888-888888888804";
const PAY_5 = "0a888888-8888-4888-8888-888888888805";
const REFREQ_1 = "0a999999-9999-4999-8999-999999999901";
const CONV_1 = "0aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const MSG_1 = "0abbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01";
const MSG_2 = "0abbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02";
const REVIEW_1 = "0acccccc-cccc-4ccc-8ccc-cccccccccc01";

const nowIso = () => new Date().toISOString();

// ── Helpers ──────────────────────────────────────────────────────────────
async function findUserByEmail(email) {
  let page = 1;
  // Small dataset — a few pages is plenty.
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
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) return data.user;
  // Already registered → look it up.
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  throw new Error(`Could not create or find auth user ${email}: ${error.message}`);
}

async function up(table, rows, onConflict = "id") {
  // Upsert one row at a time: PostgREST builds a single column set from the
  // UNION of keys across an array and sends NULL (not DEFAULT) for keys a row
  // omits — which trips NOT NULL columns. Per-row upsert lets defaults apply.
  for (const row of rows) {
    const { error } = await admin.from(table).upsert(row, { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

async function bookingExists(id) {
  const { data, error } = await admin.from("bookings").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`select booking ${id}: ${error.message}`);
  return Boolean(data);
}

async function setBookingStatus(id, patch) {
  const { error } = await admin.from("bookings").update(patch).eq("id", id);
  if (error) throw new Error(`update booking ${id} -> ${patch.status}: ${error.message}`);
}

// Insert a booking as `pending`, attach rooms/addons, then transition it to its
// final status so the on_booking_confirmed + invoice triggers fire naturally.
// Skips the whole dance if the booking already exists (idempotent re-run).
async function seedBooking(base, finalStatus, { rooms = [], addons = [] } = {}) {
  if (await bookingExists(base.id)) return;
  const { error } = await admin.from("bookings").insert({ ...base, status: "pending" });
  if (error) throw new Error(`insert booking ${base.id}: ${error.message}`);

  if (rooms.length) await up("booking_rooms", rooms);
  if (addons.length) await up("booking_addons", addons);

  if (finalStatus === "confirmed") {
    await setBookingStatus(base.id, { status: "confirmed", confirmed_at: nowIso() });
  } else if (finalStatus === "completed") {
    await setBookingStatus(base.id, { status: "confirmed", confirmed_at: nowIso() });
    await setBookingStatus(base.id, { status: "completed", checked_out_at: nowIso() });
  } else if (finalStatus === "cancelled_by_guest") {
    await setBookingStatus(base.id, {
      status: "cancelled_by_guest",
      cancelled_at: nowIso(),
      cancelled_by: "guest",
      cancellation_reason: "Change of travel plans",
    });
  }
  // 'pending' → leave as inserted.
}

// ── Seed ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding demo data into ${URL} ...`);

  // 1. Auth users + profiles
  const hostUser = await ensureAuthUser(HOST_EMAIL, HOST_PASSWORD);
  const guestUser = await ensureAuthUser(GUEST_EMAIL, GUEST_PASSWORD);
  const HOST_UID = hostUser.id;
  const GUEST_UID = guestUser.id;

  await up("user_profiles", [
    { id: HOST_UID, role: "host", full_name: "Thandi Mokoena", email: HOST_EMAIL, phone: "+27821234567" },
    { id: GUEST_UID, role: "guest", full_name: "Sipho Dlamini", email: GUEST_EMAIL, phone: "+27829876543" },
  ]);

  // 2. Host + subscription + banking
  await up("hosts", [
    {
      id: HOST_ID,
      user_id: HOST_UID,
      handle: "vilo-demo-host",
      display_name: "Cape Coast Retreats",
      bio: "Family-run stays along the Cape coast. Warm welcomes, sea views, and great coffee.",
      avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200",
      cover_photo_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200",
      languages_spoken: ["English", "Afrikaans", "isiXhosa"],
      is_verified: true,
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

  // Banking: encryption is OPTIONAL app-side; plain text round-trips fine.
  await up("eft_banking_details", [
    {
      id: BANKING_ID,
      host_id: HOST_ID,
      account_holder: "Cape Coast Retreats (Pty) Ltd",
      account_number: "62812345678",
      bank_name: "FNB",
      branch_code: "250655",
      account_type: "business",
      label: "Primary",
      is_default: true,
    },
  ]);

  // 2b. Business details — drives the branded document numbering
  // (INV-/Q-/CR-/RF- use the trading name) and the invoice/quote PDF header.
  // The host-insert trigger already created a default `businesses` row; enrich it.
  {
    const { error } = await admin
      .from("businesses")
      .update({
        legal_name: "Cape Coast Retreats (Pty) Ltd",
        trading_name: "Cape Coast Retreats",
        vat_number: "4123456789",
        company_registration_number: "2021/123456/07",
        address_line1: "12 Marine Drive",
        city: "Hermanus",
        postal_code: "7200",
        country: "ZA",
      })
      .eq("host_id", HOST_ID)
      .eq("is_default", true);
    if (error) throw new Error(`update default business: ${error.message}`);
  }

  // 3. Listings
  await up("listings", [
    {
      id: LISTING_A,
      host_id: HOST_ID,
      listing_type: "accommodation",
      accommodation_type: "self_catering",
      name: "Seaview Cottage, Hermanus",
      slug: "seaview-cottage-hermanus",
      description: "A bright self-catering cottage a short walk from the cliff path. Sleeps 4.",
      city: "Hermanus",
      province: "Western Cape",
      country: "ZA",
      latitude: -34.4187,
      longitude: 19.2345,
      bedrooms: 2,
      bathrooms: 1,
      max_guests: 4,
      base_price: 1500,
      cleaning_fee: 350,
      currency: "ZAR",
      check_in_time: "14:00",
      check_out_time: "10:00",
      min_nights: 2,
      cancellation_policy: "moderate",
      accepts_paystack: true,
      accepts_eft: true,
      booking_mode: "whole_listing",
      is_published: true,
      published_at: nowIso(),
    },
    {
      id: LISTING_B,
      host_id: HOST_ID,
      listing_type: "accommodation",
      accommodation_type: "guesthouse",
      name: "The Vines Guesthouse, Stellenbosch",
      slug: "the-vines-guesthouse-stellenbosch",
      description: "Boutique guesthouse in the winelands. Book individual rooms or the whole house.",
      city: "Stellenbosch",
      province: "Western Cape",
      country: "ZA",
      latitude: -33.9321,
      longitude: 18.8602,
      bedrooms: 4,
      bathrooms: 4,
      max_guests: 8,
      base_price: 2400,
      weekend_price: 2700,
      cleaning_fee: 400,
      currency: "ZAR",
      min_nights: 2,
      check_in_time: "15:00",
      check_out_time: "10:00",
      cancellation_policy: "moderate",
      accepts_paystack: true,
      accepts_eft: true,
      booking_mode: "flexible",
      instant_booking: true,
      // Combo discounts (listing-page redesign) — applied server-side.
      whole_listing_discount_pct: 10,
      weekly_discount_pct: 5,
      monthly_discount_pct: 10,
      is_published: true,
      published_at: nowIso(),
    },
  ]);

  // 4. Photos
  await up("listing_photos", [
    {
      id: PHOTO_A,
      listing_id: LISTING_A,
      storage_path: `listing-photos/${LISTING_A}/cover.jpg`,
      url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200",
      sort_order: 0,
      caption: "Living room with sea view",
    },
    {
      id: PHOTO_B,
      listing_id: LISTING_B,
      storage_path: `listing-photos/${LISTING_B}/cover.jpg`,
      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200",
      sort_order: 0,
      caption: "Guesthouse exterior",
    },
  ]);

  // 5. Amenities
  await up("listing_amenities", [
    { id: "0ad00000-0000-4000-8000-00000000a001", listing_id: LISTING_A, amenity_key: "wifi" },
    { id: "0ad00000-0000-4000-8000-00000000a002", listing_id: LISTING_A, amenity_key: "kitchen" },
    { id: "0ad00000-0000-4000-8000-00000000a003", listing_id: LISTING_A, amenity_key: "sea_view" },
    { id: "0ad00000-0000-4000-8000-00000000a004", listing_id: LISTING_A, amenity_key: "braai_bbq" },
    { id: "0ad00000-0000-4000-8000-00000000b001", listing_id: LISTING_B, amenity_key: "wifi" },
    { id: "0ad00000-0000-4000-8000-00000000b002", listing_id: LISTING_B, amenity_key: "pool" },
    { id: "0ad00000-0000-4000-8000-00000000b003", listing_id: LISTING_B, amenity_key: "breakfast_included" },
  ]);

  // 6. Rooms (for the flexible listing B)
  await up("listing_rooms", [
    {
      id: ROOM_1,
      listing_id: LISTING_B,
      name: "Chardonnay Room",
      description: "Queen room overlooking the vineyard.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 2,
      base_price: 1200,
      cleaning_fee: 150,
      currency: "ZAR",
      bed_type: "Queen",
      view_type: "Vineyard",
      sort_order: 0,
    },
    {
      id: ROOM_2,
      listing_id: LISTING_B,
      name: "Shiraz Suite",
      description: "Spacious suite with a private balcony.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 3,
      base_price: 1800,
      cleaning_fee: 200,
      currency: "ZAR",
      bed_type: "King",
      view_type: "Mountain",
      sort_order: 1,
    },
  ]);

  // 7. Seasonal pricing (listing A)
  await up("listing_seasonal_pricing", [
    {
      id: SEASON_1,
      listing_id: LISTING_A,
      label: "December Peak",
      start_date: "2026-12-15",
      end_date: "2027-01-10",
      adjustment_type: "absolute",
      adjustment_value: 2200,
    },
  ]);

  // 8. Add-ons + listing link
  await up("addons", [
    {
      id: ADDON_1,
      host_id: HOST_ID,
      name: "Welcome wine basket",
      description: "Local wine, cheese, and biltong on arrival.",
      pricing_model: "per_stay",
      unit_price: 500,
      currency: "ZAR",
    },
    {
      id: ADDON_2,
      host_id: HOST_ID,
      name: "Daily breakfast",
      description: "Continental breakfast delivered each morning.",
      pricing_model: "per_guest_per_night",
      unit_price: 120,
      currency: "ZAR",
    },
  ]);
  await up("listing_addons", [
    { id: LISTING_ADDON_1, listing_id: LISTING_A, addon_id: ADDON_1 },
  ]);

  // 9. Bookings (+ rooms / addons / status transitions)
  const baseGuest = { guest_id: GUEST_UID, guest_name: "Sipho Dlamini", guest_email: GUEST_EMAIL, guest_phone: "+27829876543" };

  // B1 — pending, guest request, whole listing
  await seedBooking(
    {
      id: B1,
      listing_id: LISTING_A,
      host_id: HOST_ID,
      ...baseGuest,
      check_in: "2026-06-10",
      check_out: "2026-06-13",
      guests_count: 2,
      base_amount: 4500,
      cleaning_fee: 350,
      total_amount: 4850,
      currency: "ZAR",
      origin: "guest_request",
      scope: "whole_listing",
      payment_status: "pending",
    },
    "pending",
  );

  // B2 — confirmed, host manual, EFT paid, with an add-on + a conversation
  await seedBooking(
    {
      id: B2,
      listing_id: LISTING_A,
      host_id: HOST_ID,
      ...baseGuest,
      check_in: "2026-06-20",
      check_out: "2026-06-23",
      guests_count: 2,
      base_amount: 4500,
      cleaning_fee: 350,
      total_amount: 5350,
      currency: "ZAR",
      origin: "host_manual",
      scope: "whole_listing",
      payment_method: "eft",
      payment_status: "completed",
      host_payment_note: "EFT received 2026-05-26, ref VILO-B2.",
    },
    "confirmed",
    {
      addons: [
        {
          id: "0ae00000-0000-4000-8000-00000000ad02",
          booking_id: B2,
          addon_id: ADDON_1,
          label: "Welcome wine basket",
          unit_price: 500,
          quantity: 1,
          pricing_model: "per_stay",
          currency: "ZAR",
          subtotal: 500,
        },
      ],
    },
  );
  await up("payments", [
    { id: PAY_2, booking_id: B2, amount: 5350, method: "eft", status: "completed", currency: "ZAR", captured_at: nowIso() },
  ]);

  // B3 — completed, paystack paid (eligible for a review)
  await seedBooking(
    {
      id: B3,
      listing_id: LISTING_A,
      host_id: HOST_ID,
      ...baseGuest,
      check_in: "2026-05-10",
      check_out: "2026-05-14",
      guests_count: 3,
      base_amount: 6000,
      cleaning_fee: 350,
      total_amount: 6350,
      currency: "ZAR",
      origin: "guest_request",
      scope: "whole_listing",
      payment_method: "paystack",
      payment_status: "completed",
    },
    "completed",
  );
  await up("payments", [
    { id: PAY_3, booking_id: B3, amount: 6350, method: "paystack", status: "completed", currency: "ZAR", provider_reference: "ps_demo_b3", captured_at: nowIso() },
  ]);

  // B4 — cancelled by guest, paystack paid, pending refund request
  await seedBooking(
    {
      id: B4,
      listing_id: LISTING_A,
      host_id: HOST_ID,
      ...baseGuest,
      check_in: "2026-07-01",
      check_out: "2026-07-04",
      guests_count: 2,
      base_amount: 4500,
      cleaning_fee: 350,
      total_amount: 4850,
      currency: "ZAR",
      origin: "guest_request",
      scope: "whole_listing",
      payment_method: "paystack",
      payment_status: "completed",
    },
    "cancelled_by_guest",
  );
  await up("payments", [
    { id: PAY_4, booking_id: B4, amount: 4850, method: "paystack", status: "completed", currency: "ZAR", provider_reference: "ps_demo_b4", captured_at: nowIso() },
  ]);
  await up("refund_requests", [
    {
      id: REFREQ_1,
      booking_id: B4,
      payment_id: PAY_4,
      host_id: HOST_ID,
      guest_id: GUEST_UID,
      requested_amount: 4850,
      currency: "ZAR",
      reason: "Guest cancelled — requesting refund per policy.",
      initiated_by: "guest",
      status: "pending",
    },
  ]);

  // B5 — confirmed, rooms scope on listing B
  await seedBooking(
    {
      id: B5,
      listing_id: LISTING_B,
      host_id: HOST_ID,
      ...baseGuest,
      check_in: "2026-06-15",
      check_out: "2026-06-18",
      guests_count: 2,
      base_amount: 3600,
      cleaning_fee: 150,
      total_amount: 3750,
      currency: "ZAR",
      origin: "guest_request",
      scope: "rooms",
      payment_method: "paystack",
      payment_status: "completed",
    },
    "confirmed",
    {
      rooms: [
        { id: "0af00000-0000-4000-8000-00000000b001", booking_id: B5, room_id: ROOM_1, base_amount: 3600, cleaning_fee: 150 },
      ],
    },
  );
  await up("payments", [
    { id: PAY_5, booking_id: B5, amount: 3750, method: "paystack", status: "completed", currency: "ZAR", provider_reference: "ps_demo_b5", captured_at: nowIso() },
  ]);

  // 10. Conversation + messages (tied to B2)
  await up("conversations", [
    {
      id: CONV_1,
      guest_id: GUEST_UID,
      host_id: HOST_ID,
      listing_id: LISTING_A,
      booking_id: B2,
      status: "open",
      unread_host: 1,
      last_message_at: nowIso(),
      last_message_preview: "Perfect, see you on the 20th!",
    },
  ]);
  await up("messages", [
    {
      id: MSG_1,
      conversation_id: CONV_1,
      sender_id: HOST_UID,
      body: "Hi Sipho — your booking is confirmed. Check-in is from 14:00.",
      read_by_host: true,
      read_by_guest: true,
    },
    {
      id: MSG_2,
      conversation_id: CONV_1,
      sender_id: GUEST_UID,
      body: "Perfect, see you on the 20th!",
      read_by_host: false,
      read_by_guest: true,
    },
  ]);

  // 11. Review (on completed booking B3)
  await up("reviews", [
    {
      id: REVIEW_1,
      booking_id: B3,
      listing_id: LISTING_A,
      host_id: HOST_ID,
      guest_id: GUEST_UID,
      rating: 5,
      body: "Beautiful cottage, spotless and the sea views were unreal. Thandi was a wonderful host.",
      is_published: true,
    },
  ]);

  // ────────────────────────────────────────────────────────────────
  // 12. Listing-page redesign content (focused on guesthouse LISTING_B)
  // ────────────────────────────────────────────────────────────────

  // Host enrichment — Superhost + response metrics + highlights/languages.
  // Direct UPDATE (not upsert): an upsert insert-attempt would violate the
  // NOT NULL `handle` column since we omit it here.
  {
    const { error } = await admin
      .from("hosts")
      .update({
        is_superhost: true,
        phone_verified: true,
        payout_verified: true,
        response_rate: 1.0,
        avg_response_hours: 1,
        highlights: ["Lives nearby", "Wine-farm local", "Great with families"],
        languages_spoken: ["English", "Afrikaans", "isiXhosa"],
      })
      .eq("id", HOST_ID);
    if (error) throw new Error(`update hosts: ${error.message}`);
  }

  // Gallery photos for LISTING_B (cover PHOTO_B already exists at sort 0).
  await up("listing_photos", [
    { id: "0a666666-6666-4666-8666-6666666666b1", listing_id: LISTING_B, storage_path: `listing-photos/${LISTING_B}/g1.jpg`, url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200", sort_order: 1, caption: "Vineyard suite" },
    { id: "0a666666-6666-4666-8666-6666666666b2", listing_id: LISTING_B, storage_path: `listing-photos/${LISTING_B}/g2.jpg`, url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200", sort_order: 2, caption: "Lounge" },
    { id: "0a666666-6666-4666-8666-6666666666b3", listing_id: LISTING_B, storage_path: `listing-photos/${LISTING_B}/g3.jpg`, url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200", sort_order: 3, caption: "Kitchen" },
    { id: "0a666666-6666-4666-8666-6666666666b4", listing_id: LISTING_B, storage_path: `listing-photos/${LISTING_B}/g4.jpg`, url: "https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=1200", sort_order: 4, caption: "Winelands at dusk" },
    // Per-room cover photos.
    { id: "0a666666-6666-4666-8666-66666666f6c1", listing_id: LISTING_B, room_id: ROOM_1, storage_path: `listing-photos/${LISTING_B}/r1.jpg`, url: "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=900", sort_order: 5, caption: "Chardonnay Room" },
    { id: "0a666666-6666-4666-8666-66666666f6c2", listing_id: LISTING_B, room_id: ROOM_2, storage_path: `listing-photos/${LISTING_B}/r2.jpg`, url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900", sort_order: 6, caption: "Shiraz Suite" },
  ]);

  // Point each room at its cover photo + a size, so room cards (and the rich
  // quote line items) show a thumbnail, bed type and m².
  {
    const { error: e1 } = await admin
      .from("listing_rooms")
      .update({ featured_photo_id: "0a666666-6666-4666-8666-66666666f6c1", room_size_sqm: 22 })
      .eq("id", ROOM_1);
    const { error: e2 } = await admin
      .from("listing_rooms")
      .update({ featured_photo_id: "0a666666-6666-4666-8666-66666666f6c2", room_size_sqm: 30 })
      .eq("id", ROOM_2);
    if (e1 || e2) throw new Error(`set room featured photos: ${(e1 ?? e2).message}`);
  }

  // More amenities for LISTING_B.
  await up("listing_amenities", [
    { id: "0ad00000-0000-4000-8000-00000000b004", listing_id: LISTING_B, amenity_key: "parking" },
    { id: "0ad00000-0000-4000-8000-00000000b005", listing_id: LISTING_B, amenity_key: "kitchen" },
    { id: "0ad00000-0000-4000-8000-00000000b006", listing_id: LISTING_B, amenity_key: "air_conditioning" },
    { id: "0ad00000-0000-4000-8000-00000000b007", listing_id: LISTING_B, amenity_key: "garden" },
    { id: "0ad00000-0000-4000-8000-00000000b008", listing_id: LISTING_B, amenity_key: "braai_bbq" },
    { id: "0ad00000-0000-4000-8000-00000000b009", listing_id: LISTING_B, amenity_key: "mountain_view" },
  ]);

  // Seasonal pricing tiers for LISTING_B (listing-wide).
  await up("listing_seasonal_pricing", [
    { id: "0a555555-5555-4555-8555-5555555555b1", listing_id: LISTING_B, label: "Winter off-peak", start_date: "2026-05-01", end_date: "2026-08-31", adjustment_type: "absolute", adjustment_value: 1900, priority: 1 },
    { id: "0a555555-5555-4555-8555-5555555555b2", listing_id: LISTING_B, label: "Festive peak", start_date: "2026-12-15", end_date: "2027-01-10", adjustment_type: "absolute", adjustment_value: 3200, min_nights: 4, priority: 10 },
  ]);

  // Blocked dates for LISTING_B (manual host blocks — show as unavailable).
  await up(
    "blocked_dates",
    ["2026-12-24", "2026-12-25", "2026-12-26", "2026-12-31", "2027-01-01"].map((date, i) => ({
      id: `0ab10cd0-0000-4000-8000-00000000b0${(i + 10).toString().padStart(2, "0")}`,
      listing_id: LISTING_B,
      date,
      reason: "Owner stay",
    })),
  );

  // Points of interest ("Where you'll be").
  await up("listing_points_of_interest", [
    { id: "0a0e0000-0000-4000-8000-0000000000e1", listing_id: LISTING_B, category: "eat", name: "Tokara Restaurant", travel_time: "8 min", sort_order: 0 },
    { id: "0a0e0000-0000-4000-8000-0000000000e2", listing_id: LISTING_B, category: "eat", name: "The Fat Butcher", travel_time: "10 min", sort_order: 1 },
    { id: "0a0e0000-0000-4000-8000-0000000000e3", listing_id: LISTING_B, category: "eat", name: "Schoon Café", travel_time: "12 min", sort_order: 2 },
    { id: "0a0d0000-0000-4000-8000-0000000000d1", listing_id: LISTING_B, category: "do", name: "Stellenbosch wine route", travel_time: "5 min", sort_order: 0 },
    { id: "0a0d0000-0000-4000-8000-0000000000d2", listing_id: LISTING_B, category: "do", name: "Jonkershoek hikes", travel_time: "20 min", sort_order: 1 },
    { id: "0a0d0000-0000-4000-8000-0000000000d3", listing_id: LISTING_B, category: "do", name: "Village museum", travel_time: "9 min", sort_order: 2 },
    { id: "0a0c0000-0000-4000-8000-0000000000c1", listing_id: LISTING_B, category: "travel", name: "Cape Town Intl (CPT)", travel_time: "35 min", sort_order: 0 },
    { id: "0a0c0000-0000-4000-8000-0000000000c2", listing_id: LISTING_B, category: "travel", name: "Cape Town CBD", travel_time: "50 min", sort_order: 1 },
    { id: "0a0c0000-0000-4000-8000-0000000000c3", listing_id: LISTING_B, category: "travel", name: "Stellenbosch station", travel_time: "10 min", sort_order: 2 },
  ]);

  // "Guests mention" review themes.
  await up("listing_review_themes", [
    { id: "0a0a0000-0000-4000-8000-0000000000a1", listing_id: LISTING_B, label: "Wine farm setting", icon_key: "grape", mention_count: 41, sort_order: 0 },
    { id: "0a0a0000-0000-4000-8000-0000000000a2", listing_id: LISTING_B, label: "The host", icon_key: "heart-handshake", mention_count: 58, sort_order: 1 },
    { id: "0a0a0000-0000-4000-8000-0000000000a3", listing_id: LISTING_B, label: "Spotless", icon_key: "sparkles", mention_count: 47, sort_order: 2 },
    { id: "0a0a0000-0000-4000-8000-0000000000a4", listing_id: LISTING_B, label: "Quiet", icon_key: "ear-off", mention_count: 24, sort_order: 3 },
    { id: "0a0a0000-0000-4000-8000-0000000000a5", listing_id: LISTING_B, label: "Breakfast", icon_key: "coffee", mention_count: 33, sort_order: 4 },
  ]);

  // Extra reviewers → completed bookings on LISTING_B → published reviews
  // with per-category sub-ratings + trip_type + helpful counts.
  const REVIEWERS = [
    { uid: null, email: "nomvula@vilodemo.com", name: "Nomvula Khumalo", bId: "0a777777-7777-4777-8777-7777777777b6", rId: "0acccccc-cccc-4ccc-8ccc-ccccccccccb6", inDate: "2026-02-10", outDate: "2026-02-13", rating: 5, trip: "couples", helpful: 14, body: "The vineyard views at sunrise are unreal. Thandi left us a bottle of estate red and the warmest welcome. We didn't want to leave." },
    { uid: null, email: "jacobus@vilodemo.com", name: "Jacobus Visser", bId: "0a777777-7777-4777-8777-7777777777b7", rId: "0acccccc-cccc-4ccc-8ccc-ccccccccccb7", inDate: "2026-03-05", outDate: "2026-03-10", rating: 5, trip: "friends", helpful: 22, body: "Booked the whole house for a wine weekend with friends. Spotless, quiet, and a 5-minute drive to the best tasting rooms. Faultless." },
    { uid: null, email: "ayanda@vilodemo.com", name: "Ayanda Radebe", bId: "0a777777-7777-4777-8777-7777777777b8", rId: "0acccccc-cccc-4ccc-8ccc-ccccccccccb8", inDate: "2026-03-20", outDate: "2026-03-22", rating: 5, trip: "family", helpful: 31, body: "Took my parents for their anniversary. The breakfast each morning was a highlight and the host organised a quiet table at Tokara for us." },
    { uid: null, email: "sven@vilodemo.com", name: "Sven Petersen", bId: "0a777777-7777-4777-8777-7777777777b9", rId: "0acccccc-cccc-4ccc-8ccc-ccccccccccb9", inDate: "2026-04-02", outDate: "2026-04-06", rating: 4, trip: "solo", helpful: 8, body: "Came to write for a few days and got very little done — too distracted by the gardens. Comfortable bed, great coffee. Road in is bumpy." },
  ];
  const subRatings = (r) => ({
    rating_cleanliness: 5,
    rating_communication: 5,
    rating_checkin: 5,
    rating_accuracy: r >= 5 ? 5 : 4,
    rating_location: 5,
    rating_value: r >= 5 ? 5 : 4,
  });
  for (const rv of REVIEWERS) {
    const u = await ensureAuthUser(rv.email, "ViloDemo123!");
    rv.uid = u.id;
    await up("user_profiles", [
      { id: rv.uid, role: "guest", full_name: rv.name, email: rv.email },
    ]);
    await seedBooking(
      {
        id: rv.bId,
        listing_id: LISTING_B,
        host_id: HOST_ID,
        guest_id: rv.uid,
        guest_name: rv.name,
        guest_email: rv.email,
        check_in: rv.inDate,
        check_out: rv.outDate,
        guests_count: 2,
        base_amount: 4800,
        cleaning_fee: 400,
        total_amount: 5200,
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
        listing_id: LISTING_B,
        host_id: HOST_ID,
        guest_id: rv.uid,
        rating: rv.rating,
        body: rv.body,
        trip_type: rv.trip,
        helpful_count: rv.helpful,
        is_published: true,
        ...subRatings(rv.rating),
      },
    ]);
  }

  console.log("\n✅ Demo seed complete.");
  console.log("   Host login:  %s / %s", HOST_EMAIL, HOST_PASSWORD);
  console.log("   Guest login: %s / %s", GUEST_EMAIL, GUEST_PASSWORD);
  console.log("   2 listings, 2 rooms (with cover photos), 2 add-ons,");
  console.log("   5 bookings, 4 payments, 1 pending refund, business details");
  console.log("   (branded numbering), 1 conversation, reviews.");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message ?? err);
  process.exit(1);
});
