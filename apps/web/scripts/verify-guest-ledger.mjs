// Live-DB audit of every guest's historical bookings + payment ledger.
//
// The denormalised money fields on a booking (balance_due, payment_status) are
// supposed to be a pure function of its payment ledger — see
// lib/payments/ledger.ts → recomputeBookingPaymentState. This probe recomputes
// that function against the real DB and flags any booking whose stored fields
// have drifted, so the Guests directory / record / Finances tab never show a
// wrong "due" amount or balance.
//
// It also checks ledger COVERAGE: a realised (confirmed/checked_in/completed)
// booking should carry a booking invoice (the "charge" the Finances ledger
// renders), and a fully-paid booking shouldn't still have an 'issued' invoice.
//
// Read-only by default. Pass --fix to heal drift (pre-MVP only — direct writes):
//   node --env-file=.env.local scripts/verify-guest-ledger.mjs
//   node --env-file=.env.local scripts/verify-guest-ledger.mjs --fix
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const FIX = process.argv.includes("--fix");
const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Mirror of lib/payments/ledger.ts (kept in sync deliberately — the probe must
// assert the SAME maths the app persists).
const INBOUND_KINDS = ["deposit", "balance", "addon", "payment", "credit"];
const TERMINAL = ["refunded", "partially_refunded", "voided", "failed"];
const REALISED = ["confirmed", "checked_in", "completed"];
const r2 = (n) => Math.round(n * 100) / 100;

// A dead booking (cancelled / declined / expired / no_show) owes nothing — its
// balance_due is zeroed and it's excluded from the guest's outstanding. Mirrors
// the guest-record outstanding rule + the reconcile migration.
const isDead = (status) =>
  status.startsWith("cancelled") ||
  ["declined", "expired", "no_show"].includes(status);

function expectedState(status, total, paid) {
  if (isDead(status)) return { balance: 0, status: null };
  const balance = r2(Math.max(0, total - paid));
  let payStatus;
  if (paid <= 0) payStatus = "pending";
  else if (paid + 0.001 < total) payStatus = "partial";
  else payStatus = "completed";
  return { balance, status: payStatus };
}

// ── Pull everything in bulk (cheaper + avoids N+1 against the cloud) ──────
const { data: bookings, error: bErr } = await sb
  .from("bookings")
  .select(
    "id, reference, host_id, status, total_amount, balance_due, payment_status, deleted_at",
  )
  .is("deleted_at", null);
if (bErr) {
  console.error("bookings read failed:", bErr.message);
  process.exit(1);
}

const { data: payments, error: pErr } = await sb
  .from("payments")
  .select("booking_id, amount, kind, status, voided_at");
if (pErr) {
  console.error("payments read failed:", pErr.message);
  process.exit(1);
}

const { data: invoices, error: iErr } = await sb
  .from("invoices")
  .select("booking_id, kind, status, voided_at, total_amount");
if (iErr) {
  console.error("invoices read failed:", iErr.message);
  process.exit(1);
}

// paid-sum per booking (completed, non-voided, inbound kinds)
const paidByBooking = new Map();
for (const p of payments ?? []) {
  if (
    p.status === "completed" &&
    p.voided_at == null &&
    INBOUND_KINDS.includes(p.kind ?? "")
  ) {
    paidByBooking.set(
      p.booking_id,
      r2((paidByBooking.get(p.booking_id) ?? 0) + Number(p.amount)),
    );
  }
}

// invoice coverage per booking (live, non-voided)
const liveBookingInvoice = new Set();
const liveIssuedInvoice = new Set();
for (const inv of invoices ?? []) {
  if (inv.voided_at != null) continue;
  if (inv.kind !== "addon") liveBookingInvoice.add(inv.booking_id);
  if (inv.status === "issued") liveIssuedInvoice.add(inv.booking_id);
}

const balanceDrift = [];
const statusDrift = [];
const missingCharge = [];
const staleIssued = [];

for (const b of bookings ?? []) {
  const total = r2(Number(b.total_amount));
  const paid = paidByBooking.get(b.id) ?? 0;
  const exp = expectedState(b.status, total, paid);
  const storedBal = r2(Number(b.balance_due ?? 0));

  if (Math.abs(storedBal - exp.balance) > 0.005) {
    balanceDrift.push({
      ref: b.reference,
      id: b.id,
      stored: storedBal,
      expected: exp.balance,
      total,
      paid,
    });
  }
  // payment_status only owned by the ledger when NOT in a terminal money state,
  // and not on a dead booking (exp.status null = don't assert).
  if (
    exp.status !== null &&
    !TERMINAL.includes(b.payment_status) &&
    b.payment_status !== exp.status
  ) {
    statusDrift.push({
      ref: b.reference,
      id: b.id,
      stored: b.payment_status,
      expected: exp.status,
    });
  }
  // A realised booking should have a (charge) invoice for the Finances ledger.
  if (REALISED.includes(b.status) && !liveBookingInvoice.has(b.id)) {
    missingCharge.push({ ref: b.reference, id: b.id, status: b.status });
  }
  // Fully paid but still flagged 'issued' → ledger/booking disagree on settled.
  if (paid + 0.001 >= total && total > 0 && liveIssuedInvoice.has(b.id)) {
    staleIssued.push({ ref: b.reference, id: b.id });
  }
}

const report = (title, rows, fmt) => {
  console.log(`\n${rows.length === 0 ? "✓" : "✗"} ${title}: ${rows.length}`);
  for (const row of rows.slice(0, 25)) console.log("   " + fmt(row));
  if (rows.length > 25) console.log(`   …and ${rows.length - 25} more`);
};

console.log(`Audited ${bookings?.length ?? 0} live bookings.`);
report("balance_due drift", balanceDrift, (d) =>
  `${d.ref}: stored ${d.stored} → expected ${d.expected} (total ${d.total}, paid ${d.paid})`,
);
report("payment_status drift", statusDrift, (d) =>
  `${d.ref}: stored "${d.stored}" → expected "${d.expected}"`,
);
report("realised booking with no charge invoice", missingCharge, (d) =>
  `${d.ref} (${d.status})`,
);
report("fully paid but invoice still 'issued'", staleIssued, (d) => d.ref);

const totalDrift =
  balanceDrift.length + statusDrift.length + staleIssued.length;

if (FIX && totalDrift > 0) {
  console.log(`\nHealing ${totalDrift} drifted booking field(s)…`);
  let healed = 0;
  // balance_due + payment_status (skip status write on terminal states).
  const byId = new Map();
  for (const d of balanceDrift)
    byId.set(d.id, { ...(byId.get(d.id) ?? {}), balance_due: d.expected });
  for (const d of statusDrift)
    byId.set(d.id, { ...(byId.get(d.id) ?? {}), payment_status: d.expected });
  for (const [id, patch] of byId) {
    const { error } = await sb.from("bookings").update(patch).eq("id", id);
    if (error) console.error(`   ✗ ${id}: ${error.message}`);
    else healed++;
  }
  // settle stale 'issued' invoices on fully-paid bookings.
  for (const d of staleIssued) {
    const { error } = await sb
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("booking_id", d.id)
      .eq("status", "issued");
    if (error) console.error(`   ✗ inv ${d.ref}: ${error.message}`);
  }
  console.log(`Healed ${healed} booking row(s).`);
}

const failures =
  balanceDrift.length +
  statusDrift.length +
  missingCharge.length +
  staleIssued.length;
console.log(
  failures === 0
    ? "\nAll guest booking + ledger data is consistent. ✓"
    : `\n${failures} inconsistencies found${FIX ? " (fix attempted above)" : " — re-run with --fix to heal"}.`,
);
process.exit(failures === 0 || FIX ? 0 : 1);
