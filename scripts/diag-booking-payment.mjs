// One-off READ-ONLY diagnostic: inspect the most recent bookings + their
// payment rows + the host's Paystack gateway, to see why a paid test booking
// is stuck pending. Service role — no writes.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(
  new URL("../apps/web/.env.local", import.meta.url),
  "utf8",
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: bookings, error } = await supabase
  .from("bookings")
  .select(
    "id, reference, origin, status, payment_status, payment_method, scope, total_amount, balance_due, currency, host_id, guest_id, created_at, confirmed_at",
  )
  .order("created_at", { ascending: false })
  .limit(6);

if (error) {
  console.log("BOOKINGS QUERY ERROR:", error.message);
  process.exit(1);
}

for (const b of bookings) {
  console.log("\n========================================");
  console.log(`Booking ${b.reference}  (${b.id})`);
  console.log(`  created     : ${b.created_at}`);
  console.log(`  origin      : ${b.origin}`);
  console.log(`  status      : ${b.status}`);
  console.log(`  pay_status  : ${b.payment_status}`);
  console.log(`  pay_method  : ${b.payment_method}`);
  console.log(`  scope       : ${b.scope}`);
  console.log(`  total/bal   : ${b.total_amount} / ${b.balance_due} ${b.currency}`);
  console.log(`  confirmed_at: ${b.confirmed_at}`);

  const { data: pays } = await supabase
    .from("payments")
    .select(
      "id, status, method, kind, amount, provider_reference, captured_at, voided_at, created_at",
    )
    .eq("booking_id", b.id)
    .order("created_at", { ascending: false });
  if (!pays || pays.length === 0) {
    console.log("  payments    : (none)");
  } else {
    for (const p of pays) {
      console.log(
        `  payment     : ${p.status}/${p.method}/${p.kind ?? "-"} amount=${p.amount} ref=${p.provider_reference ?? "-"} captured=${p.captured_at ?? "-"} voided=${p.voided_at ?? "-"}`,
      );
    }
  }
}

// Host Paystack gateway for the most recent booking's host.
if (bookings[0]) {
  const { data: gw } = await supabase
    .from("host_payment_gateways")
    .select("gateway, is_enabled, environment, statement_descriptor, created_at")
    .eq("host_id", bookings[0].host_id);
  console.log("\n========================================");
  console.log(`Host ${bookings[0].host_id} payment gateways:`);
  console.log(gw && gw.length ? gw : "(none connected)");
}
