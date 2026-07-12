// Deep financial sweep — re-derives every money invariant against the live DB.
// Read-only. The single audit that asserts the maths the app persists:
//
//   1. Invoice invariant  — Σ(non-voided invoices) == bookings.total_amount for
//      every ALIVE booking (catches the add-on double-charge). DEAD bookings
//      (cancelled/declined/expired/no_show) should carry NO live invoice.
//   2. Refund reconciliation — Σ(counted refund_requests) == Σ(payments.refunded_amount)
//      per booking (catches duplicate/phantom refunds double-counted in the ledger).
//   3. balance_due drift — stored vs (alive: total − netPaid ; dead: 0), where
//      netPaid = Σ(amount − refunded_amount) over inbound completed/part/refunded rows.
//   4. payment_status sanity vs the ledger-owned states.
//   5. Doc-number integrity — the unified INV/RPT/REF/CN/Q/BK/FRF sequence has no
//      duplicate numbers.
//
//   cd apps/web && node --env-file=.env.local scripts/verify-financial-sweep.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing SUPABASE env"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });
const r2 = (n) => Math.round(Number(n) * 100) / 100;

const INBOUND = ["deposit", "balance", "addon", "payment", "credit"];
const PAID_ST = ["completed", "partially_refunded", "refunded"];
const TERMINAL = ["refunded", "partially_refunded", "voided", "failed", "forfeited"];
const isDead = (s) => s.startsWith("cancelled") || ["declined", "expired", "no_show"].includes(s);

const [{ data: bookings }, { data: payments }, { data: invoices }, { data: refunds }, { data: cns }, { data: forfeits }] =
  await Promise.all([
    sb.from("bookings").select("id, reference, host_id, status, payment_status, total_amount, balance_due, deleted_at").is("deleted_at", null),
    sb.from("payments").select("booking_id, amount, refunded_amount, kind, status, voided_at, receipt_number"),
    sb.from("invoices").select("booking_id, invoice_number, kind, total_amount, voided_at"),
    sb.from("refund_requests").select("booking_id, refund_number, requested_amount, approved_amount, status, voided_at"),
    sb.from("credit_notes").select("booking_id, credit_note_number, total_amount, origin, status, voided_at"),
    sb.from("forfeit_statements").select("booking_id, statement_number, amount_forfeited"),
  ]);

const bref = new Map((bookings ?? []).map((b) => [b.id, b.reference]));

// ── Per-booking rollups ────────────────────────────────────────────────────
const netPaid = new Map();       // Σ(amount − refunded) over counted rows
const refundedActual = new Map();// Σ payments.refunded_amount
for (const p of payments ?? []) {
  if (p.voided_at == null && PAID_ST.includes(p.status ?? "") && INBOUND.includes(p.kind ?? "")) {
    netPaid.set(p.booking_id, r2((netPaid.get(p.booking_id) ?? 0) + Number(p.amount) - Number(p.refunded_amount ?? 0)));
  }
  if (p.voided_at == null && Number(p.refunded_amount ?? 0) > 0) {
    refundedActual.set(p.booking_id, r2((refundedActual.get(p.booking_id) ?? 0) + Number(p.refunded_amount)));
  }
}
const liveInvTotal = new Map();  // Σ non-voided invoice totals
const liveInvCount = new Map();
for (const i of invoices ?? []) {
  if (i.voided_at != null) continue;
  liveInvTotal.set(i.booking_id, r2((liveInvTotal.get(i.booking_id) ?? 0) + Number(i.total_amount)));
  liveInvCount.set(i.booking_id, (liveInvCount.get(i.booking_id) ?? 0) + 1);
}
const refundCounted = new Map(); // Σ refund_requests the ledger counts as cash-out
for (const r of refunds ?? []) {
  if (r.voided_at != null) continue;
  // Only COMPLETED refunds move money / hit the ledger (matches the fixed
  // fetchHostTransactions — approved/processing are shown pending, zero effect).
  if (r.status !== "completed") continue;
  refundCounted.set(r.booking_id, r2((refundCounted.get(r.booking_id) ?? 0) + Number(r.approved_amount ?? r.requested_amount)));
}

// Cancellation credit notes reverse a cancelled booking's receivable; the chosen
// refund is the sum of its live (non-declined) refund_requests.
const cnCancel = new Map();
for (const c of cns ?? []) {
  if (c.voided_at != null || c.status === "cancelled") continue;
  if (c.origin !== "cancellation") continue;
  cnCancel.set(c.booking_id, r2((cnCancel.get(c.booking_id) ?? 0) + Number(c.total_amount)));
}
const refundChosen = new Map();
for (const r of refunds ?? []) {
  if (r.voided_at != null || r.status === "declined") continue;
  refundChosen.set(r.booking_id, r2((refundChosen.get(r.booking_id) ?? 0) + Number(r.approved_amount ?? r.requested_amount)));
}

// ── Checks ──────────────────────────────────────────────────────────────────
const invoiceViolations = [];  // Σ live invoices ≠ total (alive) / dead has live invoice
const refundMismatches = [];   // counted refunds ≠ actually refunded
const balanceDrift = [];
const statusDrift = [];

for (const b of bookings ?? []) {
  const total = r2(b.total_amount);
  const paid = netPaid.get(b.id) ?? 0;
  const invSum = liveInvTotal.get(b.id) ?? 0;
  const dead = isDead(b.status);

  if (dead) {
    // A cancelled/forfeited booking KEEPS its invoice and is reversed by a
    // cancellation credit note. Retained revenue = Σ(invoices) − Σ(cancellation
    // CNs) must equal net paid − chosen refund (SARS: invoice stays, CN reverses).
    const retained = r2(invSum - (cnCancel.get(b.id) ?? 0));
    const expectRetained = r2(paid - (refundChosen.get(b.id) ?? 0));
    if ((liveInvCount.get(b.id) ?? 0) > 0 && Math.abs(retained - expectRetained) > 0.02)
      invoiceViolations.push({ ref: b.reference, kind: "retained≠paid−refund", invSum, total, note: `retained ${retained} (Σinv ${invSum} − cancelCN ${cnCancel.get(b.id) ?? 0}) vs paid−refund ${expectRetained}` });
  } else if (Math.abs(invSum - total) > 0.005 && (liveInvCount.get(b.id) ?? 0) > 0) {
    invoiceViolations.push({ ref: b.reference, kind: "sum≠total", invSum, total, note: `Σ invoices ${invSum} vs total ${total} (Δ ${r2(invSum - total)})` });
  }

  const rCounted = refundCounted.get(b.id) ?? 0;
  const rActual = refundedActual.get(b.id) ?? 0;
  if (Math.abs(rCounted - rActual) > 0.005 && (rCounted > 0 || rActual > 0))
    refundMismatches.push({ ref: b.reference, counted: rCounted, actual: rActual, note: `ledger counts ${rCounted} refunded, payments show ${rActual}` });

  const expBal = dead ? 0 : r2(Math.max(0, total - paid));
  const storedBal = r2(b.balance_due ?? 0);
  if (Math.abs(storedBal - expBal) > 0.005)
    balanceDrift.push({ ref: b.reference, stored: storedBal, expected: expBal, total, paid, status: b.status });

  if (!dead && !TERMINAL.includes(b.payment_status)) {
    const exp = paid <= 0 ? "pending" : paid + 0.001 < total ? "partial" : "completed";
    if (b.payment_status !== exp)
      statusDrift.push({ ref: b.reference, stored: b.payment_status, expected: exp });
  }
}

// ── Doc-number integrity (unified sequence, no dupes) ────────────────────────
const nums = [];
for (const i of invoices ?? []) if (i.invoice_number) nums.push(i.invoice_number);
for (const p of payments ?? []) if (p.receipt_number) nums.push(p.receipt_number);
for (const c of cns ?? []) if (c.credit_note_number) nums.push(c.credit_note_number);
for (const r of refunds ?? []) if (r.refund_number) nums.push(r.refund_number);
for (const f of forfeits ?? []) if (f.statement_number) nums.push(f.statement_number);
const seen = new Set(), dupes = new Set();
for (const n of nums) { if (seen.has(n)) dupes.add(n); seen.add(n); }

// ── Report ───────────────────────────────────────────────────────────────────
const report = (title, rows, fmt) => {
  console.log(`\n${rows.length === 0 ? "✓" : "✗"} ${title}: ${rows.length}`);
  for (const r of rows) console.log("   " + fmt(r));
};
console.log(`Swept ${bookings?.length ?? 0} live bookings.`);
report("Invoice invariant Σ(invoices)==total", invoiceViolations, (v) => `${v.ref}: ${v.note}`);
report("Refund reconciliation (counted==actually refunded)", refundMismatches, (m) => `${m.ref}: ${m.note}`);
report("balance_due drift", balanceDrift, (d) => `${d.ref} [${d.status}]: stored ${d.stored} → expected ${d.expected} (total ${d.total}, netPaid ${d.paid})`);
report("payment_status drift", statusDrift, (d) => `${d.ref}: "${d.stored}" → "${d.expected}"`);
report("duplicate doc numbers", [...dupes], (n) => n);

const fail = invoiceViolations.length + refundMismatches.length + balanceDrift.length + statusDrift.length + dupes.size;
console.log(`\n${fail === 0 ? "ALL CONSISTENT ✓" : fail + " issue(s) found"}`);
process.exit(fail === 0 ? 0 : 1);
