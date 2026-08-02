// Seed ONE host whose only listing is an UNPUBLISHED draft — the exact state
// that triggers the publish-listing nudge (dashboard layout fires it when
// listingCount > 0 && no listing is published). Lets the founder log in and
// verify the PublishListingReminder modal + banner in the real dashboard.
//
// Does NOT touch the demo host (0a1111…) or its seeded report data.
// Re-runnable: fixed UUIDs are upserted; the auth user is found-or-created.
//
//   node --env-file=.env.local scripts/seed-nudge-host.mjs   # from apps/web

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run from apps/web with: node --env-file=.env.local scripts/seed-nudge-host.mjs",
  );
  process.exit(1);
}
const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Login credentials (founder logs in with these) ─────────────────────────
const HOST_EMAIL = "nudge-host@wielotest.com";
const HOST_PASSWORD = "WieloNudge123!";

// ── Fixed UUIDs (distinct 0c… prefix so nothing collides with 0a/0b seeds) ──
const HOST_ID = "0c111111-1111-4111-8111-111111111111";
const SUBSCRIPTION_ID = "0c111111-1111-4111-8111-1111111111aa";
const PROPERTY = "0c222222-2222-4222-8222-222222222221";
const ROOM_1 = "0c333333-3333-4333-8333-333333333331";
const PHOTO = "0c777777-7777-4777-8777-777777777701";

const nowIso = () => new Date().toISOString();

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
  console.log(`Seeding draft-only nudge host into ${URL} …`);

  // 1. Auth user + profile (email pre-verified so the verification wall is clear).
  const hostUser = await ensureAuthUser(HOST_EMAIL, HOST_PASSWORD);
  const HOST_UID = hostUser.id;
  await up("user_profiles", [
    { id: HOST_UID, role: "host", full_name: "Nomsa Dube", email: HOST_EMAIL, phone: "+27820007777", email_verified_at: nowIso() },
  ]);

  // 2. Host (verified + active so the dashboard is fully usable).
  await up("hosts", [
    {
      id: HOST_ID,
      user_id: HOST_UID,
      handle: "wielo-nudge-host",
      display_name: "Drakensberg Draft Stays",
      bio: "A work-in-progress listing for testing the publish nudge.",
      languages_spoken: ["English", "Zulu"],
      is_verified: true,
    },
  ]);
  {
    const { error } = await admin
      .from("hosts")
      .update({ is_active: true, is_verified: true, phone_verified: true })
      .eq("id", HOST_ID);
    if (error) throw new Error(`update hosts verification: ${error.message}`);
  }

  // Default business is created by the host-insert trigger.
  const { data: bizRow } = await admin
    .from("businesses")
    .select("id")
    .eq("host_id", HOST_ID)
    .eq("is_default", true)
    .maybeSingle();
  const BUSINESS_ID = bizRow?.id;
  if (!BUSINESS_ID) throw new Error("No default business created for host");

  // 3. Business plan + full feature unlock so no upgrade walls block the dashboard.
  await up("subscriptions", [
    { id: SUBSCRIPTION_ID, host_id: HOST_ID, plan: "business", status: "active", billing_cycle: "monthly" },
  ]);
  {
    const UNLIMITED = { staff_seats: 99, listings_limit: 99, inbox_limit: 999 };
    const FEATURES = [
      "addons", "reporting", "banking_details", "directory_listing", "directory_priority",
      "looking_for_access", "policies", "seasonal_pricing", "website_builder", "coupons",
      "direct_booking", "enquiry_only", "inbox_messages", "payment_paystack", "payment_paypal",
      "payment_eft", "reviews_respond", "calendar_management", "instant_booking",
      "custom_profile_url", "export_bookings", "canned_replies", "staff_seats",
      "listings_limit", "inbox_limit",
    ];
    const rows = FEATURES.map((feature_key) => ({
      host_id: HOST_ID,
      feature_key,
      is_enabled: true,
      limit_value: UNLIMITED[feature_key] ?? null,
      reason: "Nudge-host smoke test: unlock all features (AGENT_RULES.md §3.4)",
      overridden_by: HOST_UID,
    }));
    await up("host_feature_overrides", rows, "host_id,feature_key");
  }

  // 4. ONE listing — UNPUBLISHED (draft). This is the whole point: a host with a
  //    listing but nothing live → the publish nudge fires.
  await up("properties", [
    {
      id: PROPERTY,
      host_id: HOST_ID,
      business_id: BUSINESS_ID,
      property_type: "accommodation",
      accommodation_type: "guesthouse",
      name: "Berg View Cottage, Underberg",
      slug: "berg-view-cottage-underberg-draft",
      description: "A mountain cottage still being set up — not yet published.",
      city: "Underberg",
      province: "KwaZulu-Natal",
      country: "ZA",
      latitude: -29.7833,
      longitude: 29.5,
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 2,
      base_price: 1400,
      cleaning_fee: 250,
      currency: "ZAR",
      min_nights: 1,
      check_in_time: "14:00",
      check_out_time: "10:00",
      cancellation_policy: "moderate",
      accepts_paystack: true,
      accepts_eft: true,
      booking_mode: "flexible",
      is_published: false, // ← draft
      published_at: null,
    },
  ]);
  await up("property_photos", [
    {
      id: PHOTO,
      property_id: PROPERTY,
      storage_path: `listing-photos/${PROPERTY}/cover.jpg`,
      url: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200",
      sort_order: 0,
      caption: "Berg View Cottage",
    },
  ]);
  await up("property_rooms", [
    {
      id: ROOM_1,
      property_id: PROPERTY,
      name: "Mountain Room",
      description: "Queen room with a valley view.",
      bedrooms: 1,
      bathrooms: 1,
      max_guests: 2,
      base_price: 1400,
      cleaning_fee: 250,
      currency: "ZAR",
      bed_type: "Queen",
      view_type: "Mountain",
      sort_order: 0,
    },
  ]);

  console.log("\n✅ Draft-only nudge host ready.");
  console.log("   Login:    " + HOST_EMAIL);
  console.log("   Password: " + HOST_PASSWORD);
  console.log("   Host:     Drakensberg Draft Stays (" + HOST_ID + ")");
  console.log("   Listing:  Berg View Cottage — is_published = false");
  console.log("\n   → Log in, open /dashboard: the publish nudge + amber banner should appear.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
