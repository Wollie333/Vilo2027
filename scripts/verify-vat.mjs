// VAT engine live verification — service role. Sets a real listing VAT-registered,
// inserts a test booking, and confirms the apply_booking_vat trigger grossed the
// total up + the effective_vat_rate function. Cleans up after itself.
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

let pass = 0,
  fail = 0;
const log = (ok, label, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

const { data: listing } = await supabase
  .from("listings")
  .select("id, host_id, vat_number, vat_rate, currency")
  .limit(1)
  .maybeSingle();

if (!listing) {
  console.log("No listing to test against. Aborting.");
  process.exit(0);
}

const orig = { vat_number: listing.vat_number, vat_rate: listing.vat_rate };
const cur = listing.currency || "ZAR";

try {
  // 1. effective_vat_rate = 0 when no VAT number.
  await supabase
    .from("listings")
    .update({ vat_number: null, vat_rate: 15 })
    .eq("id", listing.id);
  let { data: r0 } = await supabase.rpc("effective_vat_rate", {
    p_listing_id: listing.id,
  });
  log(Number(r0) === 0, "effective_vat_rate = 0 with no VAT number", `got ${r0}`);

  // 2. effective_vat_rate = 15 when VAT-registered.
  await supabase
    .from("listings")
    .update({ vat_number: "TEST-VAT-123", vat_rate: 15 })
    .eq("id", listing.id);
  let { data: r15 } = await supabase.rpc("effective_vat_rate", {
    p_listing_id: listing.id,
  });
  log(Number(r15) === 15, "effective_vat_rate = 15 when VAT-registered", `got ${r15}`);

  // 3. Custom rate (e.g. 20% for another country) overrides.
  await supabase
    .from("listings")
    .update({ vat_rate: 20 })
    .eq("id", listing.id);
  let { data: r20 } = await supabase.rpc("effective_vat_rate", {
    p_listing_id: listing.id,
  });
  log(Number(r20) === 20, "custom VAT rate (20%) honoured", `got ${r20}`);

  // 4. Insert a booking at 15% → trigger grosses 1000 → 1150 (vat 150).
  await supabase
    .from("listings")
    .update({ vat_rate: 15 })
    .eq("id", listing.id);
  const { data: bk, error: bErr } = await supabase
    .from("bookings")
    .insert({
      host_id: listing.host_id,
      listing_id: listing.id,
      guest_name: "VAT Probe",
      guest_email: "vat-probe@example.com",
      origin: "host_manual",
      scope: "whole_listing",
      check_in: "2099-01-01",
      check_out: "2099-01-03",
      guests_count: 1,
      base_amount: 1000,
      cleaning_fee: 0,
      total_amount: 1000,
      currency: cur,
      status: "pending",
      payment_status: "pending",
    })
    .select("id, total_amount, vat_amount, vat_rate")
    .single();

  if (bErr) {
    log(false, "insert test booking", bErr.message);
  } else {
    log(
      Number(bk.total_amount) === 1150,
      "booking total grossed up 1000 → 1150",
      `got ${bk.total_amount}`,
    );
    log(Number(bk.vat_amount) === 150, "booking vat_amount = 150", `got ${bk.vat_amount}`);
    log(Number(bk.vat_rate) === 15, "booking vat_rate = 15", `got ${bk.vat_rate}`);
    await supabase.from("bookings").delete().eq("id", bk.id);

    // 5. Non-VAT listing → no gross-up.
    await supabase
      .from("listings")
      .update({ vat_number: null })
      .eq("id", listing.id);
    const { data: bk2 } = await supabase
      .from("bookings")
      .insert({
        host_id: listing.host_id,
        listing_id: listing.id,
        guest_name: "VAT Probe 2",
        guest_email: "vat-probe2@example.com",
        origin: "host_manual",
        scope: "whole_listing",
        check_in: "2099-02-01",
        check_out: "2099-02-03",
        guests_count: 1,
        base_amount: 1000,
        cleaning_fee: 0,
        total_amount: 1000,
        currency: cur,
        status: "pending",
        payment_status: "pending",
      })
      .select("id, total_amount, vat_amount")
      .single();
    if (bk2) {
      log(
        Number(bk2.total_amount) === 1000 && Number(bk2.vat_amount) === 0,
        "non-VAT listing leaves total at 1000, vat 0",
        `got total ${bk2.total_amount}, vat ${bk2.vat_amount}`,
      );
      await supabase.from("bookings").delete().eq("id", bk2.id);
    }
  }
} finally {
  // Restore the listing exactly as we found it.
  await supabase.from("listings").update(orig).eq("id", listing.id);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
