// Seed ONE review-eligible booking for the demo host so the "Request a review"
// button lights up (it's disabled when zero stays qualify).
//
// Eligibility (lib/reviews/eligible.ts): status='completed' + payment_status in
// (completed|partially_refunded|refunded) + NO review row yet. The demo host's
// completed stays are all already reviewed, so nothing qualifies — this adds a
// fresh completed+paid stay with no review.
//
// Idempotent: deletes its own BK-REV01 booking first, then re-inserts.
//
//   node --env-file=.env.local scripts/seed-review-eligible.mjs   # from apps/web

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

const HOST = "0a111111-1111-4111-8111-111111111111";
const PROPERTY = "0a222222-2222-4222-8222-222222222221"; // Seaview Cottage
const GUEST = "71e59e50-964e-42c5-9424-1aa83d445114"; // has an account → in-app notif works
const BOOKING_ID = "0a777777-7777-4777-8777-7777777777e1";
const REF = "BK-REV01";

async function main() {
  // Clean any prior run (delete review rows then the booking).
  await admin.from("reviews").delete().eq("booking_id", BOOKING_ID);
  await admin.from("bookings").delete().eq("id", BOOKING_ID);

  const { error } = await admin.from("bookings").insert({
    id: BOOKING_ID,
    property_id: PROPERTY,
    host_id: HOST,
    guest_id: GUEST,
    reference: REF,
    status: "completed",
    payment_status: "completed", // ← paid, so it qualifies
    check_in: "2026-07-08",
    check_out: "2026-07-11",
    guests_count: 2,
    base_amount: 4200,
    cleaning_fee: 300,
    total_amount: 4500,
    currency: "ZAR",
    payment_method: "paystack",
    confirmed_at: "2026-07-01T09:00:00Z",
    checked_out_at: "2026-07-11T10:00:00Z",
    scope: "whole_listing",
    origin: "guest_request",
    channel: "direct",
    guest_name: "Lindiwe Zulu",
    guest_email: "guest@wielodemo.com",
    guest_phone: "+27829876543",
  });
  if (error) {
    console.error("✗ insert booking:", error.message);
    process.exit(1);
  }

  console.log("✅ Review-eligible booking seeded.");
  console.log(`   ${REF} — Lindiwe Zulu · completed + paid · NO review yet`);
  console.log(
    "   → /dashboard/reviews: 'Request a review' is now clickable (count 1).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
