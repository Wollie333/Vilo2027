// Integration test harness for the booking lifecycle — the heart of the app.
// Drives REAL bookings against the linked DB (service-role) through host + guest
// journeys, asserts the records + triggers at each step, then cleans up
// everything it created. Finds bugs the unit tests can't (triggers, RLS, RPCs).
//
//   pnpm test:flows         (cd apps/web; runs with --env-file=.env.local)
//
// Safe under the pre-MVP data policy: every row it inserts is tracked and
// deleted in a finally block. Requires the demo seed (pnpm seed:demo).

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const HOST_ID = "0a111111-1111-4111-8111-111111111111";
const LISTING_A = "0a222222-2222-4222-8222-222222222221"; // whole_listing
const LISTING_B = "0a222222-2222-4222-8222-222222222222"; // rooms / flexible
const GUEST_EMAIL = "guest@vilodemo.com";

// ── tiny test runner ──
let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  \x1b[31m✗ ${name}${detail ? ` — ${detail}` : ""}\x1b[0m`);
  }
}
const created = { bookings: [], payments: [], refunds: [], coupons: [] };

async function cleanup() {
  // blocked_dates / invoices / booking_addons / booking_rooms cascade or are
  // cleared by booking delete; refund_requests + payments reference bookings.
  for (const id of created.refunds)
    await db.from("refund_requests").delete().eq("id", id);
  for (const id of created.bookings) {
    await db.from("blocked_dates").delete().eq("booking_id", id);
    await db.from("invoices").delete().eq("booking_id", id);
    await db.from("refund_requests").delete().eq("booking_id", id);
    await db.from("payments").delete().eq("booking_id", id);
    await db.from("booking_addons").delete().eq("booking_id", id);
    await db.from("booking_rooms").delete().eq("booking_id", id);
    await db.from("policy_snapshots").delete().eq("booking_id", id);
    await db.from("bookings").delete().eq("id", id);
  }
  for (const id of created.coupons)
    await db.from("coupons").delete().eq("id", id);
}

function isoPlus(days) {
  const d = new Date("2027-01-05T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function insertBooking(over = {}) {
  const ref = `TESTFLOW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await db
    .from("bookings")
    .insert({
      listing_id: LISTING_A,
      host_id: HOST_ID,
      guest_id: over.guest_id,
      reference: ref,
      check_in: over.check_in ?? isoPlus(0),
      check_out: over.check_out ?? isoPlus(3),
      guests_count: 2,
      base_amount: 3000,
      cleaning_fee: 500,
      total_amount: 3500,
      currency: "ZAR",
      status: "pending",
      payment_status: "pending",
      payment_method: over.payment_method ?? "paystack",
      scope: "whole_listing",
      ...over,
    })
    .select("id, reference, status")
    .single();
  if (error) throw new Error(`insertBooking: ${error.message}`);
  created.bookings.push(data.id);
  return data;
}

async function main() {
  console.log("\n🏨 Booking-flow integration tests\n");

  // Resolve the demo guest.
  const { data: guest } = await db
    .from("user_profiles")
    .select("id")
    .eq("email", GUEST_EMAIL)
    .maybeSingle();
  if (!guest) {
    console.error(
      `\n✗ Demo guest ${GUEST_EMAIL} not found — run \`pnpm seed:demo\` first.\n`,
    );
    process.exit(1);
  }
  const GUEST_UID = guest.id;

  // ── Journey A: whole-listing lifecycle (pending → confirmed → cancelled) ──
  console.log("Journey A — booking lifecycle + calendar + invoice");
  {
    const b = await insertBooking({ guest_id: GUEST_UID });
    check("A1 booking created (pending)", b.status === "pending");

    // Completed payment so the invoice marks paid + refund calc has total_paid.
    const { data: pay } = await db
      .from("payments")
      .insert({
        booking_id: b.id,
        amount: 3500,
        currency: "ZAR",
        method: "paystack",
        status: "completed",
        captured_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (pay) created.payments.push(pay.id);

    await db.rpc("snapshot_booking_policies", {
      p_booking_id: b.id,
      p_listing_id: LISTING_A,
    });

    // Confirm → on_booking_confirmed blocks dates; invoice trigger fires.
    await db
      .from("bookings")
      .update({ status: "confirmed", payment_status: "completed" })
      .eq("id", b.id);

    const { count: blocks } = await db
      .from("blocked_dates")
      .select("date", { count: "exact", head: true })
      .eq("booking_id", b.id);
    check("A2 confirm blocks 3 nights", blocks === 3, `got ${blocks}`);

    const { data: inv } = await db
      .from("invoices")
      .select("id, total_amount, status")
      .eq("booking_id", b.id)
      .maybeSingle();
    check("A3 invoice auto-created", !!inv);
    check(
      "A4 invoice total = booking total",
      inv && Number(inv.total_amount) === 3500,
      inv ? `got ${inv.total_amount}` : "no invoice",
    );

    // Availability now false for those dates.
    const { data: avail } = await db.rpc("listing_is_available_whole", {
      p_listing_id: LISTING_A,
      p_check_in: b.check_in ?? isoPlus(0),
      p_check_out: isoPlus(3),
    });
    check("A5 dates unavailable while confirmed", avail === false);

    // Cancel → on_booking_cancelled releases blocked_dates.
    await db
      .from("bookings")
      .update({
        status: "cancelled_by_host",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "host",
      })
      .eq("id", b.id);

    const { count: afterBlocks } = await db
      .from("blocked_dates")
      .select("date", { count: "exact", head: true })
      .eq("booking_id", b.id);
    check("A6 cancel releases the calendar", afterBlocks === 0, `got ${afterBlocks}`);

    const { data: avail2 } = await db.rpc("listing_is_available_whole", {
      p_listing_id: LISTING_A,
      p_check_in: isoPlus(0),
      p_check_out: isoPlus(3),
    });
    check("A7 dates available again after cancel", avail2 === true);
  }

  // ── Journey B: policy refund calc ──
  console.log("\nJourney B — policy refund calculation");
  {
    const b = await insertBooking({ guest_id: GUEST_UID });
    const { data: pay } = await db
      .from("payments")
      .insert({
        booking_id: b.id,
        amount: 3500,
        currency: "ZAR",
        method: "paystack",
        status: "completed",
        captured_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (pay) created.payments.push(pay.id);
    await db.rpc("snapshot_booking_policies", {
      p_booking_id: b.id,
      p_listing_id: LISTING_A,
    });

    const { data: refund, error } = await db.rpc(
      "calculate_policy_refund_amount",
      { p_booking_id: b.id },
    );
    check("B1 refund calc returns without error", !error, error?.message);
    const amt = Number(refund?.refund_amount ?? -1);
    check("B2 refund amount is 0..total", amt >= 0 && amt <= 3500, `got ${amt}`);
  }

  // ── Journey C: refund_request sync triggers ──
  console.log("\nJourney C — refund request opens/closes on the booking");
  {
    const b = await insertBooking({ guest_id: GUEST_UID });
    const { data: pay } = await db
      .from("payments")
      .insert({
        booking_id: b.id,
        amount: 3500,
        currency: "ZAR",
        method: "paystack",
        status: "completed",
        captured_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (pay) created.payments.push(pay.id);

    const { data: rr, error: rrErr } = await db
      .from("refund_requests")
      .insert({
        booking_id: b.id,
        payment_id: pay.id,
        host_id: HOST_ID,
        guest_id: GUEST_UID,
        requested_amount: 1000,
        currency: "ZAR",
        reason: "Test flow",
        initiated_by: "guest",
        status: "pending",
      })
      .select("id")
      .single();
    check("C1 refund_request inserts (admin)", !rrErr, rrErr?.message);
    if (rr) created.refunds.push(rr.id);

    const { data: bk } = await db
      .from("bookings")
      .select("has_open_refund")
      .eq("id", b.id)
      .maybeSingle();
    check("C2 booking.has_open_refund flips true", bk?.has_open_refund === true);

    if (rr) {
      await db
        .from("refund_requests")
        .update({
          status: "completed",
          approved_amount: 1000,
          actioned_at: new Date().toISOString(),
        })
        .eq("id", rr.id);
      const { data: bk2 } = await db
        .from("bookings")
        .select("has_open_refund, refund_total")
        .eq("id", b.id)
        .maybeSingle();
      check("C3 has_open_refund clears on completion", bk2?.has_open_refund === false);
      check(
        "C4 refund_total reflects completed refund",
        Number(bk2?.refund_total ?? 0) === 1000,
        `got ${bk2?.refund_total}`,
      );
    }
  }

  // ── Journey D: coupon redemption + cap ──
  console.log("\nJourney D — coupon redemption + per-coupon cap");
  {
    const code = `TESTC${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: coupon } = await db
      .from("coupons")
      .insert({
        host_id: HOST_ID,
        code,
        discount_type: "percent",
        discount_value: 10,
        scope: "order",
        max_redemptions: 1,
        is_active: true,
      })
      .select("id")
      .single();
    if (coupon) created.coupons.push(coupon.id);

    const b = await insertBooking({ guest_id: GUEST_UID });

    const { data: first } = await db.rpc("redeem_coupon", {
      p_coupon_id: coupon.id,
      p_booking_id: b.id,
      p_guest_id: GUEST_UID,
      p_amount: 350,
      p_currency: "ZAR",
    });
    check("D1 first redemption succeeds", first === true);

    const { data: cpn } = await db
      .from("coupons")
      .select("redeemed_count")
      .eq("id", coupon.id)
      .maybeSingle();
    check("D2 redeemed_count incremented", cpn?.redeemed_count === 1, `got ${cpn?.redeemed_count}`);

    const b2 = await insertBooking({ guest_id: GUEST_UID });
    const { data: second } = await db.rpc("redeem_coupon", {
      p_coupon_id: coupon.id,
      p_booking_id: b2.id,
      p_guest_id: GUEST_UID,
      p_amount: 350,
      p_currency: "ZAR",
    });
    check("D3 cap blocks a 2nd redemption", second === false);
  }

  // ── Journey F: rooms-scope booking blocks each booked room ──
  console.log("\nJourney F — rooms-scope booking blocks the room");
  {
    const { data: room } = await db
      .from("listing_rooms")
      .select("id, base_price, cleaning_fee")
      .eq("listing_id", LISTING_B)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!room) {
      check("F0 demo room available", false, "no active room on LISTING_B");
    } else {
      const ref = `TESTFLOW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const { data: b } = await db
        .from("bookings")
        .insert({
          listing_id: LISTING_B,
          host_id: HOST_ID,
          guest_id: GUEST_UID,
          reference: ref,
          check_in: isoPlus(40),
          check_out: isoPlus(42),
          guests_count: 2,
          base_amount: 2000,
          cleaning_fee: 300,
          total_amount: 2300,
          currency: "ZAR",
          status: "pending",
          payment_status: "pending",
          payment_method: "paystack",
          scope: "rooms",
        })
        .select("id")
        .single();
      created.bookings.push(b.id);
      await db.from("booking_rooms").insert({
        booking_id: b.id,
        room_id: room.id,
        base_amount: 2000,
        cleaning_fee: 300,
      });

      await db.from("bookings").update({ status: "confirmed" }).eq("id", b.id);
      const { data: blocks } = await db
        .from("blocked_dates")
        .select("room_id")
        .eq("booking_id", b.id);
      check("F1 rooms confirm blocks 2 nights", (blocks?.length ?? 0) === 2, `got ${blocks?.length}`);
      check(
        "F2 blocks are scoped to the booked room",
        (blocks ?? []).every((r) => r.room_id === room.id),
      );
      const { data: avail } = await db.rpc("room_is_available", {
        p_listing_id: LISTING_B,
        p_room_id: room.id,
        p_check_in: isoPlus(40),
        p_check_out: isoPlus(42),
      });
      check("F3 room unavailable while booked", avail === false);

      await db
        .from("bookings")
        .update({ status: "cancelled_by_guest", cancelled_by: "guest" })
        .eq("id", b.id);
      const { count: after } = await db
        .from("blocked_dates")
        .select("date", { count: "exact", head: true })
        .eq("booking_id", b.id);
      check("F4 cancel frees the room", after === 0, `got ${after}`);
    }
  }

  // ── Journey E: SQL price function (seasonal/weekend cross-check) ──
  console.log("\nJourney E — calculate_booking_price (DB cross-check)");
  {
    const { data: price, error } = await db.rpc("calculate_booking_price", {
      p_listing_id: LISTING_A,
      p_check_in: isoPlus(0),
      p_check_out: isoPlus(3),
    });
    check("E1 price function returns", !error && !!price, error?.message);
    check("E2 nights = 3", price?.nights === 3, `got ${price?.nights}`);
    check("E3 total = base_total + cleaning", price && Number(price.total) === Number(price.base_total) + Number(price.cleaning_fee));
  }

  console.log(
    `\n${failed === 0 ? "\x1b[32m" : "\x1b[31m"}${passed} passed, ${failed} failed\x1b[0m`,
  );
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  • ${f}`);
  }
}

main()
  .catch((e) => {
    console.error("\n✗ Harness error:", e.message);
    failed++;
  })
  .finally(async () => {
    await cleanup();
    console.log("\n🧹 cleaned up test rows");
    process.exit(failed === 0 ? 0 : 1);
  });
