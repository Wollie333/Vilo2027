// Seed the demo host's report so NO metric card reads zero.
//
// Fills the gaps left by the base demo seed: completed refunds, add-on
// payments, coupon redemptions, a Wielo-credit wallet + ledger, and a batch
// of quotes (sent + converted). Everything is dated inside the YTD window the
// Reports page defaults to, and attached to the SAME demo host the image shows.
//
// Idempotent: re-running deletes the rows it previously inserted (tagged via
// stable ids / a `[reports-seed]` marker) before re-inserting.
//
// Usage:
//   node --env-file=.env.local scripts/seed-reports-nonzero.mjs

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
const LISTING = "0a222222-2222-4222-8222-222222222221";
const GUEST = "71e59e50-964e-42c5-9424-1aa83d445114"; // has bookings on this host

const die = (label, error) => {
  if (error) {
    console.error(`✗ ${label}:`, error.message ?? error);
    process.exit(1);
  }
};

async function main() {
  console.log("🌱 Seeding non-zero report data for Cape Coast Retreats…\n");

  // ── 1. Refunds ────────────────────────────────────────────────────────────
  // Two refund_requests already exist for this host in a 'pending' state, both
  // created in-period. Flip them to 'completed' with an approved amount ≤ the
  // linked payment (the payment-refunded trigger enforces that) so they land in
  // the ledger's Refunded total + the Refund-rate KPI + Refunds/Cancellations.
  const { data: pendingRefunds, error: rErr } = await admin
    .from("refund_requests")
    .select("id, requested_amount, payment_id, created_at")
    .eq("host_id", HOST)
    .eq("status", "pending")
    .is("deleted_at", null);
  die("read pending refunds", rErr);

  for (const rf of pendingRefunds ?? []) {
    // Clamp the approved amount to the linked payment's amount just in case.
    const { data: pay } = await admin
      .from("payments")
      .select("amount")
      .eq("id", rf.payment_id)
      .maybeSingle();
    const cap = Number(pay?.amount ?? rf.requested_amount);
    const approved = Math.min(Number(rf.requested_amount), cap);
    const actioned = new Date(
      new Date(rf.created_at).getTime() + 2 * 24 * 3600 * 1000,
    ).toISOString();
    const { error } = await admin
      .from("refund_requests")
      .update({
        status: "completed",
        approved_amount: approved,
        refund_method: "eft",
        actioned_at: actioned,
        host_note: "[reports-seed] approved for reporting demo",
      })
      .eq("id", rf.id);
    die(`complete refund ${rf.id}`, error);
    console.log(`  ✓ refund completed: R${approved}`);
  }

  // ── 2. Add-on payments ─────────────────────────────────────────────────────
  // The RevenueBreakdown "Add-ons collected" sums completed payments of kind
  // 'addon'. Attach a few to in-period bookings so it (and the payment-method
  // split) shows real money.
  const addonPlan = [
    { ref: "BK-0087", amount: 650, method: "paystack", when: "2026-05-11" },
    { ref: "BK-0086", amount: 450, method: "eft", when: "2026-06-21" },
    { ref: "BK-0105", amount: 350, method: "paystack", when: "2026-07-19" },
  ];
  // Clear any prior seed add-ons (tagged by note) to stay idempotent.
  await admin
    .from("payments")
    .delete()
    .eq("kind", "addon")
    .eq("note", "[reports-seed] add-on");
  for (const p of addonPlan) {
    const { data: bk } = await admin
      .from("bookings")
      .select("id, currency")
      .eq("host_id", HOST)
      .eq("reference", p.ref)
      .maybeSingle();
    if (!bk) {
      console.log(`  – skip add-on for ${p.ref} (not found)`);
      continue;
    }
    const captured = new Date(`${p.when}T10:00:00Z`).toISOString();
    const { error } = await admin.from("payments").insert({
      booking_id: bk.id,
      amount: p.amount,
      currency: bk.currency ?? "ZAR",
      method: p.method,
      status: "completed",
      kind: "addon",
      captured_at: captured,
      created_at: captured,
      note: "[reports-seed] add-on",
    });
    die(`add-on payment ${p.ref}`, error);
    console.log(`  ✓ add-on R${p.amount} on ${p.ref} (${p.method})`);
  }

  // ── 3. Coupon redemptions ──────────────────────────────────────────────────
  // RevenueBreakdown "Coupons redeemed" counts in-period revenue bookings whose
  // coupon_id is set. Attach an existing host coupon + a discount to a few.
  const { data: coupon } = await admin
    .from("coupons")
    .select("id, code")
    .eq("host_id", HOST)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (coupon) {
    const couponPlan = [
      { ref: "BK-0090", discount: 300 },
      { ref: "BK-0092", discount: 250 },
      { ref: "BK-0087", discount: 400 },
    ];
    for (const c of couponPlan) {
      const { error } = await admin
        .from("bookings")
        .update({ coupon_id: coupon.id, coupon_discount: c.discount })
        .eq("host_id", HOST)
        .eq("reference", c.ref);
      die(`attach coupon ${c.ref}`, error);
      console.log(`  ✓ coupon ${coupon.code} → ${c.ref} (−R${c.discount})`);
    }
  } else {
    console.log("  – no coupon found to attach");
  }

  // ── 4. Wielo credits ───────────────────────────────────────────────────────
  // Wallet balance + in-period ledger movement (granted / purchased / spent).
  await admin.from("wielo_credit_ledger").delete().eq("host_id", HOST);
  await admin
    .from("wielo_credit_wallet")
    .upsert(
      { host_id: HOST, purpose: "quote", balance: 120 },
      { onConflict: "host_id,purpose" },
    );
  const ledgerRows = [
    { delta: 50, kind: "grant", balance_after: 50, reason: "Welcome credits", created_at: "2026-02-01T09:00:00Z" },
    { delta: 100, kind: "purchase", balance_after: 150, reason: "Credit top-up", created_at: "2026-04-15T09:00:00Z" },
    { delta: -30, kind: "debit", balance_after: 120, reason: "Quote unlock", created_at: "2026-06-10T09:00:00Z" },
  ].map((r) => ({ host_id: HOST, purpose: "quote", ...r }));
  const { error: ledErr } = await admin
    .from("wielo_credit_ledger")
    .insert(ledgerRows);
  die("credit ledger", ledErr);
  console.log("  ✓ credits: balance 120 · 150 added · 30 spent");

  // ── 5. Quotes (sent + converted) ───────────────────────────────────────────
  // SecondaryMetrics "Quotes sent / accepted" counts quotes created in-period;
  // accepted == status 'converted'. Also feeds the conversion funnel.
  await admin
    .from("quotes")
    .delete()
    .eq("host_id", HOST)
    .like("quote_number", "Q-RPT-%");
  const quoteNames = [
    "Thandeka Mbeki", "Johan Pretorius", "Lerato Moloi", "Emma Wilson",
    "Kabelo Ndlovu", "Sarah Botha", "Daniel Smit", "Zanele Khoza",
  ];
  const quoteRows = quoteNames.map((name, i) => {
    // 3 converted (accepted), 5 sent. Spread created_at across the year.
    const converted = i < 3;
    const month = String(2 + i).padStart(2, "0"); // Feb..Sep
    const created = `2026-${month}-08T10:00:00Z`;
    const base = 3000 + i * 500;
    return {
      host_id: HOST,
      property_id: LISTING,
      quote_number: `Q-RPT-${String(i + 1).padStart(3, "0")}`,
      guest_name: name,
      guest_email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      check_in: `2026-${month}-20`,
      check_out: `2026-${month}-23`,
      headcount: 2,
      base_amount: base,
      total_amount: base,
      currency: "ZAR",
      status: converted ? "converted" : "sent",
      sent_at: created,
      accepted_at: converted ? created : null,
      converted_at: converted ? created : null,
      created_at: created,
    };
  });
  const { error: qErr } = await admin.from("quotes").insert(quoteRows);
  die("quotes", qErr);
  console.log(`  ✓ quotes: ${quoteRows.length} sent · 3 converted`);

  // ── 6. Customer journey (time-to-book) ─────────────────────────────────────
  // fetch_time_to_book only counts a booking if the SAME guest (user_id =
  // guest_id) has property_view_events on that property BEFORE the booking's
  // created_at. The base demo created bookings + anonymous views at the same
  // instant, so nothing links → the panel is empty. Seed per-guest views dated
  // a spread of days before each booking so all five timeframe buckets fill.
  //
  // Bookings sharing a guest+property all resolve to that guest's EARLIEST view
  // (MIN), so they land in one bucket together. We use the 4 distinct-guest
  // bookings to populate four buckets cleanly and let the big shared-guest
  // cluster fill the fifth.
  await admin
    .from("property_view_events")
    .delete()
    .like("session_id", "rpt-journey-%");

  // reference → { leadDays: first-view days before created_at, touchpoints }
  const journeyPlan = {
    "BK-0091": { leadDays: 0.25, touchpoints: 2 }, // same day
    "BK-0092": { leadDays: 2, touchpoints: 2 }, // 1-3 days
    "BK-0093": { leadDays: 5, touchpoints: 3 }, // 3-7 days
    "BK-0090": { leadDays: 18, touchpoints: 3 }, // 14+ days
    // Shared guest (71e59e50) — a single early view links ALL its in-period
    // bookings; 10 days lands the whole cluster in the 7-14 bucket.
    "BK-0089": { leadDays: 10, touchpoints: 3 }, // 7-14 days (+ cluster)
  };
  const devices = ["mobile", "desktop", "tablet"];
  const viewRows = [];
  for (const [ref, plan] of Object.entries(journeyPlan)) {
    const { data: bk } = await admin
      .from("bookings")
      .select("id, guest_id, property_id, created_at")
      .eq("host_id", HOST)
      .eq("reference", ref)
      .maybeSingle();
    if (!bk) {
      console.log(`  – skip journey for ${ref} (not found)`);
      continue;
    }
    const createdMs = new Date(bk.created_at).getTime();
    for (let t = 0; t < plan.touchpoints; t++) {
      // First touchpoint at leadDays; later ones progressively closer to booking.
      const lead = plan.leadDays * (1 - t / (plan.touchpoints + 1));
      const viewedAt = new Date(
        createdMs - lead * 24 * 3600 * 1000,
      ).toISOString();
      viewRows.push({
        property_id: bk.property_id,
        user_id: bk.guest_id,
        session_id: `rpt-journey-${ref}-${t}`,
        duration_seconds: 90 + t * 45 + Math.round(plan.leadDays) * 3,
        device: devices[(t + ref.length) % devices.length],
        referrer: "google",
        country: "ZA",
        viewed_at: viewedAt,
        created_at: viewedAt,
      });
    }
  }
  const { error: vErr } = await admin
    .from("property_view_events")
    .insert(viewRows);
  die("journey view events", vErr);
  console.log(
    `  ✓ customer journey: ${viewRows.length} pre-booking views across 5 buckets`,
  );

  console.log("\n✅ Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
