// Live-DB sweep for the reviews feature: validates the new review_photos
// table + every embed used by the app against the real schema (limit(1) so
// column/relationship names are checked without needing data).
// Run: node --env-file=.env.local scripts/verify-reviews.mjs
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

const checks = [
  ["review_photos columns", () =>
    sb.from("review_photos").select("id, review_id, storage_path, sort_order, created_at").limit(1)],
  ["review_request_queue.send_at", () =>
    sb.from("review_request_queue").select("id, booking_id, guest_id, send_at, sent_at").limit(1)],
  ["listing reviews embed", () =>
    sb.from("reviews").select(
      "id, rating, body, trip_type, helpful_count, host_response, guest:user_profiles!reviews_guest_id_fkey ( full_name ), booking:bookings ( nights ), photos:review_photos ( storage_path, sort_order )",
    ).eq("is_published", true).limit(1)],
  ["dashboard reviews embed", () =>
    sb.from("reviews").select(
      "id, rating, host_response, flagged, listing:properties ( id, name ), booking:bookings ( id, nights, guest_name ), guest:user_profiles!reviews_guest_id_fkey ( full_name ), photos:review_photos ( storage_path, sort_order )",
    ).limit(1)],
  ["storage bucket review-photos", async () => {
    const { data, error } = await sb.storage.getBucket("review-photos");
    return { data, error, _public: data?.public };
  }],
];

let failed = 0;
for (const [name, run] of checks) {
  const { error, _public } = await run();
  if (error) {
    failed += 1;
    console.error(`✗ ${name}: ${error.message}`);
  } else {
    console.log(`✓ ${name}${_public !== undefined ? ` (public=${_public})` : ""}`);
  }
}
console.log(failed === 0 ? "\nAll review checks green." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
