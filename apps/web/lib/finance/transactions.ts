import "server-only";

import { gkeyForEmail, gkeyForGuest } from "@/lib/guests/gkey";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// The ONE transaction model for the whole host account. Every money event —
// charges (invoices, incl. add-ons), payments (deposit/balance/extra/applied
// credit), manual credit notes, and refunds — normalised into a single entry
// shape with its document + its effect on the guest's running balance. The
// account-wide Ledger, the per-guest Finances view and the per-booking Payments
// view are all just filtered reads of this list, so the numbers always agree.

export type TxnType =
  | "charge"
  | "payment"
  | "deposit"
  | "credit_applied"
  | "credit"
  | "refund";

// What the money was *for* (independent of the money movement above) — drives
// the "For" pill so a row reads e.g. "Charge · Booking" or "Payment · Add-on".
export type TxnCategory = "booking" | "addon" | "credit" | "refund";

export type TxnDoc = {
  kind: "invoice" | "receipt" | "credit_note" | "refund";
  number: string;
  /** Public record page path (token), or null if none. */
  viewPath: string | null;
  /** PDF download path, or null. */
  pdfPath: string | null;
};

export type Txn = {
  id: string;
  date: string;
  type: TxnType;
  label: string;
  amount: number;
  currency: string;
  guestKey: string | null;
  guestName: string | null;
  bookingId: string | null;
  bookingRef: string | null;
  method: string | null;
  note: string | null;
  doc: TxnDoc | null;
  /** Running balance the guest owes the host AFTER this entry (+owes / −credit). */
  balance: number;
  /** Effect on what the guest owes: +1 charge, −1 payment/credit, 0 neutral. */
  owedEffect: number;
  /** Effect on cash collected: +1 in, −1 out, 0 none. */
  cashEffect: number;
  /** True for a not-yet-settled payment (only surfaced when includePending). */
  pending?: boolean;
  /** Raw payments.id — lets the booking tab drive per-row settle/refund/credit. */
  paymentId?: string | null;
  /** Raw payments.kind (deposit/balance/addon/payment/credit). */
  kind?: string | null;
  /** Raw payments.status (completed/pending). */
  status?: string | null;
  /** Provider/EFT reference — Paystack/PayPal transaction id or EFT ref. */
  reference?: string | null;
  /** What the transaction was for — booking/add-on/credit/refund. */
  category: TxnCategory;
  /** Voided (kept for audit, hidden from the live ledger; zero effect). */
  voided?: boolean;
  voidReason?: string | null;
};

export type TxnStats = {
  outstanding: number;
  owingGuests: number;
  collected: number;
  refunded: number;
  credits: number;
  net: number;
};

/** Directional money flows over a set of transactions (no balance maths). Pass a
 * date-filtered slice for "this period", or the whole list for lifetime. */
export type TxnFlows = {
  /** Cash received (completed inbound payments). */
  collected: number;
  /** Cash refunded to guests. */
  refunded: number;
  /** Store credit granted via credit notes. */
  credits: number;
  /** Total billed (booking + add-on invoices). */
  charged: number;
};

const CASH_KINDS = ["deposit", "balance", "addon", "payment"];

// Dead bookings owe nothing — no synthesised charge (mirrors the guest-record
// outstanding rule + scripts/verify-guest-ledger.mjs).
const DEAD_BOOKING_STATUSES = new Set([
  "cancelled_by_host",
  "cancelled_by_guest",
  "declined",
  "expired",
  "no_show",
]);

type Filter = {
  hostId: string;
  gkey?: string;
  bookingId?: string;
  /** Include pending (not-yet-settled) payments — the booking Payments tab needs
   * them to offer "mark received". They carry zero balance/cash effect until
   * completed, so they never distort the running balance or collected total. */
  includePending?: boolean;
  /** Include voided transactions (for the ledger's "Voided" filter). They're
   * flagged `voided` and carry zero balance/cash effect, so the audit view never
   * affects live totals. Excluded by default. */
  includeVoided?: boolean;
};

/** Fetch + normalise every transaction for a host (optionally one guest/booking). */
export async function fetchHostTransactions(
  admin: Admin,
  filter: Filter,
): Promise<Txn[]> {
  const { hostId } = filter;
  const live = !filter.includeVoided; // exclude voided unless explicitly asked

  let invoicesQ = admin
    .from("invoices")
    .select(
      "id, invoice_number, kind, total_amount, currency, issued_at, booking_id, hosted_token, guest_id, guest_snapshot, voided_at, void_reason, booking:bookings ( reference, guest_name, guest_email )",
    )
    .eq("host_id", hostId);
  let paymentsQ = admin
    .from("payments")
    .select(
      "id, amount, currency, kind, status, method, note, provider_reference, captured_at, created_at, receipt_token, receipt_number, booking_id, voided_at, void_reason, booking:bookings!inner ( host_id, reference, guest_id, guest_name, guest_email )",
    )
    .eq("booking.host_id", hostId)
    .in(
      "status",
      filter.includePending ? ["completed", "pending"] : ["completed"],
    );
  let creditNotesQ = admin
    .from("credit_notes")
    .select(
      "id, credit_note_number, total_amount, currency, issued_at, booking_id, hosted_token, origin, status, guest_id, guest_snapshot, voided_at, void_reason, booking:bookings ( reference, guest_name, guest_email )",
    )
    .eq("host_id", hostId)
    .eq("origin", "manual")
    .neq("status", "cancelled");
  let refundsQ = admin
    .from("refund_requests")
    .select(
      "id, requested_amount, approved_amount, currency, created_at, booking_id, status, refund_number, refund_method, provider_refund_id, guest_id, voided_at, void_reason, booking:bookings ( reference, guest_name, guest_email )",
    )
    .eq("host_id", hostId)
    .in("status", ["approved", "processing", "completed"]);

  // Live bookings — the obligation behind the ledger. A booking that hasn't been
  // invoiced yet (still pending / pending_eft, before the confirm trigger mints
  // the invoice) carries no invoice "charge", so the ledger would show nothing
  // owed while the guest genuinely owes the full amount. We synthesise a
  // "Booking charge" for every non-cancelled, non-invoiced booking so the
  // ledger's running balance equals the real outstanding everywhere.
  const bookingsQ = admin
    .from("bookings")
    .select(
      "id, reference, status, total_amount, currency, created_at, guest_id, guest_name, guest_email",
    )
    .eq("host_id", hostId)
    .is("deleted_at", null);

  if (live) {
    invoicesQ = invoicesQ.is("voided_at", null);
    paymentsQ = paymentsQ.is("voided_at", null);
    creditNotesQ = creditNotesQ.is("voided_at", null);
    refundsQ = refundsQ.is("voided_at", null);
  }

  const [
    { data: invoices },
    { data: payments },
    { data: creditNotes },
    { data: refunds },
    { data: liveBookings },
  ] = await Promise.all([
    invoicesQ,
    paymentsQ,
    creditNotesQ,
    refundsQ,
    bookingsQ,
  ]);

  const one = <T>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  // ── Canonical guest key (email = identity) ────────────────────────────
  // A money row may carry a guest_id (→ u_<id>) or only an email. Older
  // invoices/credit-notes were stored with a NULL guest_id even though the
  // booking is now linked to an account — so the SAME person would split into a
  // u_<id> group (payments) and an e_<email> group (invoices), showing as two
  // ledger guests with the same name. Resolve every email to its registered
  // account (mirrors the directory RPC's email-merge) so one person = one group.
  const refEmails = new Set<string>();
  const collect = (
    rows: { guest_snapshot?: { email?: string } | null }[] | null,
    bookingEmailRows: { booking?: unknown }[] | null,
  ) => {
    for (const r of rows ?? []) {
      const e = r.guest_snapshot?.email;
      if (e) refEmails.add(e.trim().toLowerCase());
    }
    for (const r of bookingEmailRows ?? []) {
      const b = one(r.booking) as { guest_email?: string } | null;
      if (b?.guest_email) refEmails.add(b.guest_email.trim().toLowerCase());
    }
  };
  collect(invoices ?? [], invoices ?? []);
  collect(creditNotes ?? [], creditNotes ?? []);
  collect(null, payments ?? []);
  collect(null, refunds ?? []);
  for (const bk of liveBookings ?? []) {
    if (bk.guest_email) refEmails.add(bk.guest_email.trim().toLowerCase());
  }

  const acctByEmail = new Map<string, string>();
  if (refEmails.size > 0) {
    const { data: accts } = await admin
      .from("user_profiles")
      .select("id, email")
      .in("email", [...refEmails]);
    for (const a of accts ?? []) {
      const k = (a.email ?? "").trim().toLowerCase();
      if (k && !acctByEmail.has(k)) acctByEmail.set(k, a.id as string);
    }
  }
  // guest_id wins; else fold an email that matches a registered account into
  // that account's u_ key; else the plain e_<email> key.
  const resolveKey = (
    guestId: string | null | undefined,
    email: string | null | undefined,
  ): string | null => {
    if (guestId) return gkeyForGuest(guestId);
    const lower = email?.trim().toLowerCase();
    if (lower && acctByEmail.has(lower))
      return gkeyForGuest(acctByEmail.get(lower)!);
    return lower ? gkeyForEmail(lower) : null;
  };

  const entries: Txn[] = [];

  for (const inv of invoices ?? []) {
    const b = one(inv.booking) as {
      reference?: string;
      guest_name?: string;
      guest_email?: string;
    } | null;
    const snap = (inv.guest_snapshot ?? {}) as {
      name?: string;
      email?: string;
    };
    const email = snap.email ?? b?.guest_email ?? null;
    const voided = Boolean(inv.voided_at);
    entries.push({
      id: `inv_${inv.id}`,
      date: inv.issued_at as string,
      type: "charge",
      label: inv.kind === "addon" ? "Add-on" : "Charge",
      amount: Number(inv.total_amount),
      currency: inv.currency,
      guestKey: resolveKey(inv.guest_id, email),
      guestName: snap.name ?? b?.guest_name ?? null,
      bookingId: inv.booking_id,
      bookingRef: b?.reference ?? null,
      method: null,
      note: inv.kind === "addon" ? "Add-on charge" : "Stay charge",
      doc: {
        kind: "invoice",
        number: inv.invoice_number,
        viewPath: inv.hosted_token ? `/invoice/${inv.hosted_token}` : null,
        pdfPath: inv.hosted_token ? `/invoice/${inv.hosted_token}/pdf` : null,
      },
      balance: 0,
      owedEffect: voided ? 0 : 1,
      cashEffect: 0,
      category: inv.kind === "addon" ? "addon" : "booking",
      voided,
      voidReason: (inv.void_reason as string) ?? null,
    });
  }

  // Synthesised charge for live, non-invoiced bookings (see bookingsQ note).
  // owedEffect +1 so the running balance reflects the obligation; no doc (there's
  // no invoice yet) so txnFlows() never counts it as "billed".
  const invoicedBookingIds = new Set(
    (invoices ?? []).map((i) => i.booking_id).filter(Boolean),
  );
  for (const bk of liveBookings ?? []) {
    if (invoicedBookingIds.has(bk.id)) continue;
    if (DEAD_BOOKING_STATUSES.has(bk.status as string)) continue;
    entries.push({
      id: `bkchg_${bk.id}`,
      date: bk.created_at as string,
      type: "charge",
      label: "Booking charge",
      amount: Number(bk.total_amount),
      currency: bk.currency,
      guestKey: resolveKey(bk.guest_id, bk.guest_email),
      guestName: bk.guest_name ?? null,
      bookingId: bk.id,
      bookingRef: bk.reference ?? null,
      method: null,
      note: "Awaiting invoice",
      doc: null,
      balance: 0,
      owedEffect: 1,
      cashEffect: 0,
      category: "booking",
      voided: false,
      voidReason: null,
    });
  }

  for (const p of payments ?? []) {
    const b = one(p.booking) as {
      reference?: string;
      guest_id?: string | null;
      guest_name?: string;
      guest_email?: string;
    } | null;
    const isCredit = p.kind === "credit";
    const isCash = CASH_KINDS.includes(p.kind as string);
    const isPending = p.status !== "completed";
    const voided = Boolean(p.voided_at);
    entries.push({
      id: `pay_${p.id}`,
      date: (p.captured_at ?? p.created_at) as string,
      type:
        p.kind === "deposit"
          ? "deposit"
          : isCredit
            ? "credit_applied"
            : "payment",
      label:
        p.kind === "deposit"
          ? "Deposit"
          : isCredit
            ? "Credit applied"
            : p.kind === "balance"
              ? "Balance"
              : p.kind === "addon"
                ? "Add-on payment"
                : "Payment",
      amount: Number(p.amount),
      currency: p.currency,
      guestKey: resolveKey(b?.guest_id ?? null, b?.guest_email ?? null),
      guestName: b?.guest_name ?? null,
      bookingId: p.booking_id,
      bookingRef: b?.reference ?? null,
      method: (p.method as string) ?? null,
      note: (p.note as string) ?? null,
      doc:
        !isPending && p.receipt_token
          ? {
              kind: "receipt",
              number: (p.receipt_number as string) ?? "Receipt",
              viewPath: `/receipt/${p.receipt_token}`,
              pdfPath: `/receipt/${p.receipt_token}/pdf`,
            }
          : null,
      balance: 0,
      // Pending or voided payments are informational only — no effect on the
      // running balance or collected cash.
      owedEffect: voided || isPending ? 0 : isCredit ? 0 : -1,
      cashEffect: voided || isPending ? 0 : isCash ? 1 : 0,
      pending: isPending,
      paymentId: p.id as string,
      kind: (p.kind as string) ?? null,
      status: (p.status as string) ?? null,
      reference: (p.provider_reference as string) ?? null,
      category: p.kind === "addon" ? "addon" : isCredit ? "credit" : "booking",
      voided,
      voidReason: (p.void_reason as string) ?? null,
    });
  }

  for (const cn of creditNotes ?? []) {
    const b = one(cn.booking) as {
      reference?: string;
      guest_name?: string;
      guest_email?: string;
    } | null;
    const snap = (cn.guest_snapshot ?? {}) as { name?: string; email?: string };
    const email = snap.email ?? b?.guest_email ?? null;
    const voided = Boolean(cn.voided_at);
    entries.push({
      id: `cn_${cn.id}`,
      date: cn.issued_at as string,
      type: "credit",
      label: "Credit note",
      amount: Number(cn.total_amount),
      currency: cn.currency,
      guestKey: resolveKey(cn.guest_id, email),
      guestName: snap.name ?? b?.guest_name ?? null,
      bookingId: cn.booking_id,
      bookingRef: b?.reference ?? null,
      method: null,
      note: "Store credit granted",
      doc: {
        kind: "credit_note",
        number: cn.credit_note_number,
        viewPath: cn.hosted_token ? `/credit-note/${cn.hosted_token}` : null,
        pdfPath: cn.hosted_token ? `/credit-note/${cn.hosted_token}/pdf` : null,
      },
      balance: 0,
      owedEffect: voided ? 0 : -1,
      cashEffect: 0,
      category: "credit",
      voided,
      voidReason: (cn.void_reason as string) ?? null,
    });
  }

  for (const rf of refunds ?? []) {
    const b = one(rf.booking) as {
      reference?: string;
      guest_name?: string;
      guest_email?: string;
    } | null;
    const voided = Boolean(rf.voided_at);
    entries.push({
      id: `rf_${rf.id}`,
      date: rf.created_at as string,
      type: "refund",
      label: "Refund",
      amount: Number(rf.approved_amount ?? rf.requested_amount),
      currency: rf.currency,
      guestKey: resolveKey(rf.guest_id, b?.guest_email ?? null),
      guestName: b?.guest_name ?? null,
      bookingId: rf.booking_id,
      bookingRef: b?.reference ?? null,
      method: (rf.refund_method as string) ?? null,
      reference: (rf.provider_refund_id as string) ?? null,
      note: "Refund to guest",
      doc: rf.refund_number
        ? {
            kind: "refund",
            number: rf.refund_number as string,
            viewPath: null,
            pdfPath: null,
          }
        : null,
      balance: 0,
      owedEffect: voided ? 0 : 1,
      cashEffect: voided ? 0 : -1,
      category: "refund",
      voided,
      voidReason: (rf.void_reason as string) ?? null,
    });
  }

  // Filter to one guest/booking if requested.
  let list = entries;
  if (filter.gkey) list = list.filter((e) => e.guestKey === filter.gkey);
  if (filter.bookingId)
    list = list.filter((e) => e.bookingId === filter.bookingId);

  // Running per-guest balance (oldest → newest).
  const asc = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const byGuest: Record<string, number> = {};
  for (const e of asc) {
    const key = e.guestKey ?? "_";
    const run = (byGuest[key] ?? 0) + e.owedEffect * e.amount;
    byGuest[key] = run;
    e.balance = Math.round(run * 100) / 100;
  }

  // Newest first for display.
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Directional money flows over a transaction list — the ONE place that defines
 * what "collected / refunded / credits / charged" mean. Pass a date-filtered
 * slice for period totals, or the full list for lifetime. Voided entries never
 * count. {@link txnStats} builds on this so every money view agrees.
 */
export function txnFlows(entries: Txn[]): TxnFlows {
  let collected = 0;
  let refunded = 0;
  let credits = 0;
  let charged = 0;
  for (const e of entries) {
    if (e.voided) continue; // voided entries never count toward totals
    if (e.cashEffect > 0) collected += e.amount;
    if (e.type === "refund") refunded += e.amount;
    if (e.type === "credit") credits += e.amount;
    // "charged" = actually billed → real invoices only, not synthesised
    // (doc-less) booking charges for not-yet-invoiced bookings.
    if (e.type === "charge" && e.doc) charged += e.amount;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    collected: r2(collected),
    refunded: r2(refunded),
    credits: r2(credits),
    charged: r2(charged),
  };
}

/** Account-wide KPIs from a transaction list. */
export function txnStats(entries: Txn[]): TxnStats {
  // Flows (collected / refunded / credits) come from the canonical aggregator.
  const { collected, refunded, credits } = txnFlows(entries);
  // Outstanding = sum of positive final balances per guest.
  const finalByGuest: Record<string, number> = {};
  for (const e of entries) {
    const key = e.guestKey ?? "_";
    // entries are newest-first; the first time we see a guest is their latest balance
    if (!(key in finalByGuest)) finalByGuest[key] = e.balance;
  }
  let outstanding = 0;
  let owingGuests = 0;
  for (const v of Object.values(finalByGuest)) {
    if (v > 0.5) {
      outstanding += v;
      owingGuests += 1;
    }
  }
  return {
    outstanding: Math.round(outstanding * 100) / 100,
    owingGuests,
    collected: Math.round(collected * 100) / 100,
    refunded: Math.round(refunded * 100) / 100,
    credits: Math.round(credits * 100) / 100,
    net: Math.round((collected - refunded) * 100) / 100,
  };
}
