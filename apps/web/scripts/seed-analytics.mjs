// Analytics demo seed for testing the analytics dashboard
//
// Populates property_view_events, additional bookings with varied dates/channels,
// and generates realistic data distributions for the analytics dashboard.
//
// Prerequisites: Run seed-demo.mjs first to create the base host/listings
//
// Usage:
//   node --env-file=.env.local scripts/seed-analytics.mjs

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Use the same demo host from seed-demo.mjs
const HOST_ID = "0a111111-1111-4111-8111-111111111111";
const LISTING_A = "0a222222-2222-4222-8222-222222222221";
const LISTING_B = "0a222222-2222-4222-8222-222222222222";

// Helper: Generate random date in the past N days
function randomDateInPast(maxDaysAgo) {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * maxDaysAgo);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

// Helper: Generate random country (weighted towards South Africa)
function randomCountry() {
  const countries = ["ZA", "ZA", "ZA", "ZA", "ZA", "GB", "US", "DE", "AU", "FR"];
  return countries[Math.floor(Math.random() * countries.length)];
}

// Helper: Generate random device
function randomDevice() {
  const devices = ["desktop", "desktop", "mobile", "mobile", "tablet"];
  return devices[Math.floor(Math.random() * devices.length)];
}

// Helper: Generate random channel
function randomChannel() {
  const channels = ["direct", "direct", "airbnb", "booking", "expedia"];
  return channels[Math.floor(Math.random() * channels.length)];
}

async function main() {
  console.log("🌱 Seeding analytics data...\n");

  // ==========================================
  // 1. Listing View Events (100 views)
  // ==========================================
  console.log("📊 Creating listing view events...");

  const viewEvents = [];
  for (let i = 0; i < 100; i++) {
    const listingId = Math.random() > 0.6 ? LISTING_A : LISTING_B;
    const sessionId = crypto.randomUUID();
    const viewedAt = randomDateInPast(90); // Past 90 days

    viewEvents.push({
      property_id: listingId,
      session_id: sessionId,
      user_id: null, // Most views are anonymous
      duration_seconds: Math.floor(Math.random() * 300) + 10, // 10-310 seconds
      device: randomDevice(),
      referrer: Math.random() > 0.5 ? "https://google.com" : null,
      country: randomCountry(),
      viewed_at: viewedAt,
      created_at: viewedAt,
    });
  }

  const { error: viewsError } = await admin
    .from("property_view_events")
    .upsert(viewEvents, { onConflict: "session_id,property_id" });

  if (viewsError) {
    console.error("❌ Failed to seed listing views:", viewsError);
  } else {
    console.log(`✅ Created ${viewEvents.length} listing view events\n`);
  }

  // ==========================================
  // 2. Additional Bookings (50 bookings with varied data)
  // ==========================================
  console.log("📅 Creating additional bookings...");

  const bookings = [];
  const payments = [];

  for (let i = 0; i < 50; i++) {
    const bookingId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();

    const createdAt = randomDateInPast(180); // Past 6 months
    const checkIn = new Date(new Date(createdAt).getTime() + Math.random() * 60 * 24 * 60 * 60 * 1000);
    const nights = Math.floor(Math.random() * 7) + 1;
    const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);

    const listingId = Math.random() > 0.5 ? LISTING_A : LISTING_B;
    const channel = randomChannel();
    const totalAmount = Math.floor(Math.random() * 3000) + 500; // R500 - R3500

    // 80% confirmed, 10% cancelled, 10% pending
    let status;
    let rand = Math.random();
    if (rand < 0.8) status = "confirmed";
    else if (rand < 0.9) status = "cancelled";
    else status = "pending";

    bookings.push({
      id: bookingId,
      host_id: HOST_ID,
      property_id: listingId,
      guest_user_id: null, // Anonymous guest
      guest_email: `guest${i}@example.com`,
      guest_name: `Guest ${i}`,
      guest_phone: "+27812345678",
      channel,
      booking_type: "whole_listing",
      num_guests: Math.floor(Math.random() * 4) + 1,
      check_in_date: checkIn.toISOString().split("T")[0],
      check_out_date: checkOut.toISOString().split("T")[0],
      nights,
      total_amount: totalAmount,
      currency: "ZAR",
      status,
      cancellation_reason: status === "cancelled" ? "guest_request" : null,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
      created_at: createdAt,
      updated_at: createdAt,
    });

    if (status === "confirmed") {
      payments.push({
        id: paymentId,
        booking_id: bookingId,
        amount: totalAmount,
        currency: "ZAR",
        status: "completed",
        payment_method: Math.random() > 0.5 ? "paystack" : "manual_eft",
        provider_reference: `demo_${paymentId.slice(0, 8)}`,
        created_at: createdAt,
        updated_at: createdAt,
      });
    }
  }

  const { error: bookingsError } = await admin
    .from("bookings")
    .upsert(bookings, { onConflict: "id" });

  if (bookingsError) {
    console.error("❌ Failed to seed bookings:", bookingsError);
  } else {
    console.log(`✅ Created ${bookings.length} bookings\n`);
  }

  if (payments.length > 0) {
    const { error: paymentsError } = await admin
      .from("payments")
      .upsert(payments, { onConflict: "id" });

    if (paymentsError) {
      console.error("❌ Failed to seed payments:", paymentsError);
    } else {
      console.log(`✅ Created ${payments.length} payments\n`);
    }
  }

  // ==========================================
  // 3. Update user_profiles.country for existing guests
  // ==========================================
  console.log("🌍 Updating guest countries...");

  // This would require fetching existing guests and updating them
  // For now, just a placeholder
  console.log("⏭️  Skipped (requires existing guest data)\n");

  console.log("✅ Analytics seeding complete!\n");
  console.log("📈 You can now visit /dashboard/reports to see the analytics dashboard with data\n");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
