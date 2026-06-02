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
const created = {
  bookings: [],
  payments: [],
  refunds: [],
  coupons: [],
  quotes: [],
};

async function cleanup() {
  // blocked_dates / invoices / booking_addons / booking_rooms cascade or are
  // cleared by booking delete; refund_requests + payments reference bookings.
  for (const id of created.refunds)
    await db.from("refund_requests").delete().eq("id", id);
  for (const id of created.bookings) {
    await db.from("blocked_dates").delete().eq("booking_id", id);
    await db.from("credit_notes").delete().eq("booking_id", id);
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
  for (const id of created.quotes) {
    await db.from("blocked_dates").delete().eq("quote_id", id);
    await db.from("quote_rooms").delete().eq("quote_id", id);
    await db.from("quote_addons").delete().eq("quote_id", id);
    await db.from("quotes").delete().eq("id", id);
  }
}

async function insertQuote(over = {}) {
  const { data: qn } = await db.rpc("next_quote_number", {
    p_host_id: HOST_ID,
  });
  const { data, error } = await db
    .from("quotes")
    .insert({
      host_id: HOST_ID,
      listing_id: LISTING_A,
      quote_number: qn,
      guest_name: "Quote Tester",
      guest_email: GUEST_EMAIL,
      check_in: isoPlus(80),
      check_out: isoPlus(83),
      headcount: 2,
      scope: "whole_listing",
      base_amount: 3000,
      cleaning_fee: 500,
      total_amount: 3500,
      currency: "ZAR",
      status: "draft",
      ...over,
    })
    .select("id, status")
    .single();
  if (error) throw new Error(`insertQuote: ${error.message}`);
  created.quotes.push(data.id);
  return data;
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

  // ── Journey G: refund completion auto-creates a credit note ──
  console.log("\nJourney G — refund completion mints a credit note");
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
    // Confirm → invoice auto-created (the credit note credits against it).
    await db
      .from("bookings")
      .update({ status: "confirmed", payment_status: "completed" })
      .eq("id", b.id);
    const { data: inv } = await db
      .from("invoices")
      .select("id")
      .eq("booking_id", b.id)
      .maybeSingle();
    check("G1 invoice exists to credit against", !!inv);

    const { data: rr } = await db
      .from("refund_requests")
      .insert({
        booking_id: b.id,
        payment_id: pay.id,
        host_id: HOST_ID,
        guest_id: GUEST_UID,
        requested_amount: 1200,
        currency: "ZAR",
        reason: "Test flow credit note",
        initiated_by: "host",
        status: "approved",
      })
      .select("id")
      .single();
    if (rr) created.refunds.push(rr.id);

    // Complete the refund → on_refund_completed_create_credit_note fires.
    await db
      .from("refund_requests")
      .update({
        status: "completed",
        approved_amount: 1200,
        actioned_at: new Date().toISOString(),
      })
      .eq("id", rr.id);

    const { data: cn } = await db
      .from("credit_notes")
      .select(
        "id, credit_note_number, invoice_id, booking_id, total_amount, origin, status",
      )
      .eq("refund_request_id", rr.id)
      .maybeSingle();
    check("G2 credit note auto-created on completion", !!cn);
    check(
      "G3 credit note has a number",
      !!cn && typeof cn.credit_note_number === "string" && cn.credit_note_number.startsWith("CR-"),
      cn ? cn.credit_note_number : "no note",
    );
    check(
      "G4 credit note links to booking + invoice",
      !!cn && cn.booking_id === b.id && cn.invoice_id === (inv && inv.id),
    );
    check(
      "G5 credit amount = approved refund",
      !!cn && Number(cn.total_amount) === 1200,
      cn ? `got ${cn.total_amount}` : "no note",
    );
    check(
      "G6 origin=refund_auto, status=issued",
      !!cn && cn.origin === "refund_auto" && cn.status === "issued",
    );
  }

  // ── Journey H: invoice flips to paid when payment completes later ──
  console.log("\nJourney H — invoice paid-sync when payment lands after confirm");
  {
    // EFT-style: confirm while still unpaid, pay later.
    const b = await insertBooking({
      guest_id: GUEST_UID,
      payment_method: "eft",
      check_in: isoPlus(60),
      check_out: isoPlus(63),
    });
    await db.rpc("snapshot_booking_policies", {
      p_booking_id: b.id,
      p_listing_id: LISTING_A,
    });
    await db
      .from("bookings")
      .update({ status: "confirmed" }) // payment_status stays 'pending'
      .eq("id", b.id);

    const { data: inv1 } = await db
      .from("invoices")
      .select("id, status")
      .eq("booking_id", b.id)
      .maybeSingle();
    check("H1 invoice created on confirm", !!inv1);
    check("H2 invoice not yet paid", !!inv1 && inv1.status !== "paid", inv1 ? inv1.status : "none");

    // Payment completes → on_payment_completed_mark_invoice_paid flips it.
    await db
      .from("bookings")
      .update({ payment_status: "completed" })
      .eq("id", b.id);

    const { data: inv2 } = await db
      .from("invoices")
      .select("status, paid_at")
      .eq("booking_id", b.id)
      .maybeSingle();
    check("H3 invoice flips to paid", inv2?.status === "paid", inv2 ? inv2.status : "none");
    check("H4 paid_at stamped", !!inv2?.paid_at);
  }

  // ── Journey I: confirm must fire via UPDATE (the convert-quote fix) ──
  // The invoice + calendar-block triggers are AFTER UPDATE OF status. A booking
  // inserted *already* confirmed skips them — which is exactly the bug the quote
  // converter had. This journey pins the contract both ways.
  console.log("\nJourney I — confirm fires triggers only via status UPDATE");
  {
    // I-a: inserted straight as confirmed → NO invoice, NO blocks.
    const direct = await insertBooking({
      guest_id: GUEST_UID,
      status: "confirmed",
      payment_status: "completed",
      confirmed_at: new Date().toISOString(),
      check_in: isoPlus(90),
      check_out: isoPlus(93),
    });
    const { data: invDirect } = await db
      .from("invoices")
      .select("id")
      .eq("booking_id", direct.id)
      .maybeSingle();
    check("I1 insert-as-confirmed creates NO invoice (proves the bug)", !invDirect);
    const { count: blkDirect } = await db
      .from("blocked_dates")
      .select("date", { count: "exact", head: true })
      .eq("booking_id", direct.id);
    check("I2 insert-as-confirmed lays NO calendar block", blkDirect === 0, `got ${blkDirect}`);

    // I-b: the converter's path — insert pending, snapshot, UPDATE → confirmed.
    const conv = await insertBooking({
      guest_id: GUEST_UID,
      origin: "quote_converted",
      payment_status: "completed",
      check_in: isoPlus(94),
      check_out: isoPlus(97),
    });
    const { error: snapErr } = await db.rpc("snapshot_booking_policies", {
      p_booking_id: conv.id,
      p_listing_id: LISTING_A,
    });
    await db
      .from("bookings")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", conv.id);
    const { data: invConv } = await db
      .from("invoices")
      .select("id, status")
      .eq("booking_id", conv.id)
      .maybeSingle();
    check("I3 pending→confirm mints the invoice", !!invConv);
    check("I4 converted invoice is paid (payment completed)", invConv?.status === "paid", invConv?.status);
    const { count: blkConv } = await db
      .from("blocked_dates")
      .select("date", { count: "exact", head: true })
      .eq("booking_id", conv.id);
    check("I5 pending→confirm blocks the calendar", blkConv === 3, `got ${blkConv}`);
    // The convert path calls snapshot_booking_policies (best-effort). Row count
    // depends on whether the listing has assigned policies in listing_policies;
    // the demo listing carries a cancellation_policy enum but no join rows, so we
    // assert the snapshot call itself succeeds rather than a specific row count.
    check("I6 convert snapshots policies without error", !snapErr, snapErr?.message);
  }

  // ── Journey J: quote soft-hold lifecycle ──
  console.log("\nJourney J — quote send soft-holds dates, convert clears them");
  {
    const q = await insertQuote({ check_in: isoPlus(120), check_out: isoPlus(123) });
    // draft → sent lays per-night holds tagged with the quote id.
    await db
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", q.id);
    const { count: holds } = await db
      .from("blocked_dates")
      .select("date", { count: "exact", head: true })
      .eq("quote_id", q.id);
    check("J1 sending a quote soft-holds 3 nights", holds === 3, `got ${holds}`);
    // Those dates now read unavailable.
    const { data: avail } = await db.rpc("listing_is_available_whole", {
      p_listing_id: LISTING_A,
      p_check_in: isoPlus(120),
      p_check_out: isoPlus(123),
    });
    check("J2 held dates read unavailable", avail === false);
    // converted → holds clear (the real booking lays its own block).
    await db
      .from("quotes")
      .update({ status: "converted", converted_at: new Date().toISOString() })
      .eq("id", q.id);
    const { count: afterHolds } = await db
      .from("blocked_dates")
      .select("date", { count: "exact", head: true })
      .eq("quote_id", q.id);
    check("J3 converting clears the soft hold", afterHolds === 0, `got ${afterHolds}`);
  }

  // ── Journey K: double-booking guard (break-it) ──
  console.log("\nJourney K — a confirmed stay blocks every overlapping range");
  {
    const b = await insertBooking({
      guest_id: GUEST_UID,
      check_in: isoPlus(130),
      check_out: isoPlus(135),
    });
    await db.from("bookings").update({ status: "confirmed" }).eq("id", b.id);
    // Exact, partial-overlap, and inner ranges must all be unavailable.
    const cases = [
      ["exact", isoPlus(130), isoPlus(135)],
      ["overlap-left", isoPlus(128), isoPlus(132)],
      ["overlap-right", isoPlus(133), isoPlus(137)],
      ["inner", isoPlus(131), isoPlus(133)],
    ];
    for (const [name, ci, co] of cases) {
      const { data: a } = await db.rpc("listing_is_available_whole", {
        p_listing_id: LISTING_A,
        p_check_in: ci,
        p_check_out: co,
      });
      check(`K1 overlapping (${name}) is unavailable`, a === false);
    }
    // A non-overlapping range stays available.
    const { data: free } = await db.rpc("listing_is_available_whole", {
      p_listing_id: LISTING_A,
      p_check_in: isoPlus(135),
      p_check_out: isoPlus(137),
    });
    check("K2 the night of checkout is bookable again", free === true);
  }

  // ── Journey L: credit note never exceeds the invoice (break-it) ──
  console.log("\nJourney L — a credit note can't exceed its invoice total");
  {
    const b = await insertBooking({ guest_id: GUEST_UID, check_in: isoPlus(140), check_out: isoPlus(143) });
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
    await db
      .from("bookings")
      .update({ status: "confirmed", payment_status: "completed" })
      .eq("id", b.id);
    const { data: inv } = await db
      .from("invoices")
      .select("id, total_amount")
      .eq("booking_id", b.id)
      .maybeSingle();

    // Over-refund: approve MORE than the invoice total and complete it.
    const { data: rr } = await db
      .from("refund_requests")
      .insert({
        booking_id: b.id,
        payment_id: pay.id,
        host_id: HOST_ID,
        guest_id: GUEST_UID,
        requested_amount: 9999,
        currency: "ZAR",
        reason: "Over-refund probe",
        initiated_by: "host",
        status: "approved",
      })
      .select("id")
      .single();
    if (rr) created.refunds.push(rr.id);
    await db
      .from("refund_requests")
      .update({ status: "completed", approved_amount: 9999, actioned_at: new Date().toISOString() })
      .eq("id", rr.id);
    const { data: cn } = await db
      .from("credit_notes")
      .select("total_amount")
      .eq("refund_request_id", rr.id)
      .maybeSingle();
    check("L1 over-refund still mints a credit note", !!cn);
    check(
      "L2 credit note is capped at the invoice total",
      !!cn && !!inv && Number(cn.total_amount) <= Number(inv.total_amount),
      cn && inv ? `note ${cn.total_amount} vs invoice ${inv.total_amount}` : "missing",
    );
  }

  // ── Journey M: standardised document numbering ──
  console.log("\nJourney M — Q-/INV-/CR-/RF-/BK- numbering convention");
  {
    // Booking WITHOUT an explicit reference → trigger mints BK-{LISTING}-{ID5}-NNNN.
    const { data: b } = await db
      .from("bookings")
      .insert({
        listing_id: LISTING_A,
        host_id: HOST_ID,
        guest_id: GUEST_UID,
        check_in: isoPlus(150),
        check_out: isoPlus(152),
        guests_count: 2,
        base_amount: 2000,
        cleaning_fee: 300,
        total_amount: 2300,
        currency: "ZAR",
        status: "pending",
        payment_status: "pending",
        payment_method: "paystack",
        scope: "whole_listing",
      })
      .select("id, reference")
      .single();
    created.bookings.push(b.id);
    check("M1 booking ref is BK-{LISTING}-{id}-NNNN", /^BK-[A-Z0-9]+-[A-Z0-9]{5}-\d{4}$/.test(b.reference ?? ""), b.reference);

    const { data: pay } = await db
      .from("payments")
      .insert({ booking_id: b.id, amount: 2300, currency: "ZAR", method: "paystack", status: "completed", captured_at: new Date().toISOString() })
      .select("id")
      .single();
    if (pay) created.payments.push(pay.id);
    await db.from("bookings").update({ status: "confirmed", payment_status: "completed" }).eq("id", b.id);

    const { data: inv } = await db
      .from("invoices")
      .select("invoice_number")
      .eq("booking_id", b.id)
      .maybeSingle();
    check("M2 invoice number is INV-{BIZ}-{id}-NNNN", /^INV-[A-Z0-9]+-[A-Z0-9]{5}-\d{5}$/.test(inv?.invoice_number ?? ""), inv?.invoice_number);

    // Refund → RF- reference + CR- credit note.
    const { data: rr } = await db
      .from("refund_requests")
      .insert({ booking_id: b.id, payment_id: pay.id, host_id: HOST_ID, guest_id: GUEST_UID, requested_amount: 500, currency: "ZAR", reason: "Numbering probe", initiated_by: "host", status: "approved" })
      .select("id, reference")
      .single();
    if (rr) created.refunds.push(rr.id);
    check("M3 refund ref is RF-{BIZ}-{id}-NNNN", /^RF-[A-Z0-9]+-[A-Z0-9]{5}-\d{5}$/.test(rr?.reference ?? ""), rr?.reference);

    await db.from("refund_requests").update({ status: "completed", approved_amount: 500, actioned_at: new Date().toISOString() }).eq("id", rr.id);
    const { data: cn } = await db
      .from("credit_notes")
      .select("credit_note_number")
      .eq("refund_request_id", rr.id)
      .maybeSingle();
    check("M4 credit note number is CR-{BIZ}-{id}-NNNN", /^CR-[A-Z0-9]+-[A-Z0-9]{5}-\d{5}$/.test(cn?.credit_note_number ?? ""), cn?.credit_note_number);

    // Quote → Q-{BIZ}-{id}-NNNNNN.
    const q = await insertQuote();
    const { data: qrow } = await db.from("quotes").select("quote_number").eq("id", q.id).maybeSingle();
    check("M5 quote number is Q-{BIZ}-{id}-NNNNNN", /^Q-[A-Z0-9]+-[A-Z0-9]{5}-\d{6}$/.test(qrow?.quote_number ?? ""), qrow?.quote_number);
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
