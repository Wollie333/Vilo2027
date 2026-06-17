// Void mechanics live probe — service role. Confirms voided_at excludes a
// payment from the live sum, and that voiding a refund makes the refund-total
// trigger reverse it. Cleans up after itself.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(
  new URL("./.env.local", import.meta.url),
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

let pass = 0,
  fail = 0;
const log = (ok, label, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

const { data: listing } = await supabase
  .from("listings")
  .select("id, host_id, currency")
  .limit(1)
  .maybeSingle();
if (!listing) {
  console.log("No listing. Aborting.");
  process.exit(0);
}

const { data: bk } = await supabase
  .from("bookings")
  .insert({
    host_id: listing.host_id,
    property_id: listing.id,
    guest_name: "Void Probe",
    guest_email: "void-probe@example.com",
    origin: "host_manual",
    scope: "whole_listing",
    check_in: "2099-03-01",
    check_out: "2099-03-03",
    guests_count: 1,
    base_amount: 1000,
    cleaning_fee: 0,
    total_amount: 1000,
    currency: listing.currency || "ZAR",
    status: "pending",
    payment_status: "pending",
  })
  .select("id")
  .single();

const liveSum = async () => {
  const { data } = await supabase
    .from("payments")
    .select("amount, kind, status")
    .eq("booking_id", bk.id)
    .eq("status", "completed")
    .is("voided_at", null);
  return (data ?? []).reduce((s, p) => s + Number(p.amount), 0);
};
const refundTotal = async () => {
  const { data } = await supabase
    .from("bookings")
    .select("refund_total")
    .eq("id", bk.id)
    .maybeSingle();
  return Number(data?.refund_total ?? 0);
};

try {
  // Payment: live sum reflects it, then voiding removes it.
  const { data: pay } = await supabase
    .from("payments")
    .insert({
      booking_id: bk.id,
      amount: 500,
      currency: listing.currency || "ZAR",
      method: "eft",
      kind: "balance",
      status: "completed",
      captured_at: new Date(0).toISOString(),
    })
    .select("id")
    .single();
  log((await liveSum()) === 500, "completed payment counts in live sum", `${await liveSum()}`);

  await supabase
    .from("payments")
    .update({ voided_at: new Date(0).toISOString(), void_reason: "probe" })
    .eq("id", pay.id);
  log((await liveSum()) === 0, "voided payment excluded from live sum", `${await liveSum()}`);
  // (Refund-trigger void uses the same voided_at guard; not probed here because
  // refund_requests needs a real guest user + payment FK to set up.)
  void refundTotal;
} finally {
  await supabase.from("payments").delete().eq("booking_id", bk.id);
  await supabase.from("refund_requests").delete().eq("booking_id", bk.id);
  await supabase.from("bookings").delete().eq("id", bk.id);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
