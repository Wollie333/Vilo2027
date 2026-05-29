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
      cleaning_fee: 400,
      currency: "ZAR",
      cancellation_policy: "strict",
      accepts_paystack: true,
      booking_mode: "flexible",
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
      price: 2200,
      currency: "ZAR",
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

  console.log("\n✅ Demo seed complete.");
  console.log("   Host login:  %s / %s", HOST_EMAIL, HOST_PASSWORD);
  console.log("   Guest login: %s / %s", GUEST_EMAIL, GUEST_PASSWORD);
  console.log("   2 listings, 2 rooms, 2 add-ons, 5 bookings, 4 payments,");
  console.log("   1 pending refund request, 1 conversation, 1 review.");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message ?? err);
  process.exit(1);
});
