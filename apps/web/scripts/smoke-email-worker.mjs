import { createClient } from "@supabase/supabase-js";

const WORKER_URL = "https://vilo2027.vercel.app/api/email-worker";
const FOUNDER_EMAIL = "wollie333@gmail.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bearer = process.env.EMAIL_WORKER_SECRET;

if (!url || !serviceKey || !bearer) {
  console.error("Missing env vars");
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profile } = await sb
  .from("user_profiles")
  .select("id, email")
  .eq("email", FOUNDER_EMAIL)
  .maybeSingle();

let hostId = null;
let guestId = null;

if (profile) {
  const { data: host } = await sb
    .from("hosts")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (host) hostId = host.id;
  else guestId = profile.id;
}

if (!hostId && !guestId) {
  const { data: anyHost } = await sb
    .from("hosts")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (anyHost) hostId = anyHost.id;
}

if (!hostId && !guestId) {
  console.error("No host or guest found to attach test row to.");
  process.exit(1);
}

const type = hostId ? "welcome_host" : "booking_confirmed_guest";
const payload = hostId
  ? { firstName: "Wollie" }
  : {
      guestFirstName: "Wollie",
      listingName: "Smoke Test Cabin",
      hostName: "Vilo",
      checkIn: "2026-06-01",
      checkOut: "2026-06-03",
      nights: 2,
      totalAmount: "R 1 800",
      bookingReference: "VILO-SMOKE",
      bookingId: "smoke",
      checkInTime: "14:00",
      address: "Test address",
    };

console.log("→ enqueueing", { type, hostId, guestId });

const { data: inserted, error: insertError } = await sb
  .from("notification_queue")
  .insert({ type, host_id: hostId, guest_id: guestId, payload })
  .select("id")
  .single();

if (insertError) {
  console.error("Insert failed:", insertError);
  process.exit(1);
}

console.log("→ row enqueued:", inserted.id);
console.log("→ POST", WORKER_URL);

const resp = await fetch(WORKER_URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});

const json = await resp.json();
console.log("→ worker response:", JSON.stringify(json, null, 2));

const { data: after } = await sb
  .from("notification_queue")
  .select("id, type, sent_at, failed_at, error")
  .eq("id", inserted.id)
  .single();

console.log("→ row after:", after);

if (after.sent_at) {
  console.log("\n✅ SMOKE TEST PASSED");
  process.exit(0);
}
if (after.failed_at) {
  console.log("\n❌ FAILED:", after.error);
  process.exit(2);
}
console.log("\n⚠️  Row not picked up");
process.exit(3);
