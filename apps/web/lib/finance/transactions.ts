import "server-only";

import { gkeyFor } from "@/lib/guests/gkey";
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
};

export type TxnStats = {
  outstanding: number;
  owingGuests: number;
  collected: number;
  refunded: number;
  credits: number;
  net: number;
};

const CASH_KINDS = ["deposit", "balance", "addon", "payment"];

type Filter = { hostId: string; gkey?: string; bookingId?: string };

/** Fetch + normalise every transaction for a host (optionally one guest/booking). */
export async function fetchHostTransactions(
  admin: Admin,
  filter: Filter,
): Promise<Txn[]> {
  const { hostId } = filter;

  const [
    { data: invoices },
    { data: payments },
    { data: creditNotes },
    { data: refunds },
  ] = await Promise.all([
    admin
      .from("invoices")
      .select(
        "id, invoice_number, kind, total_amount, currency, issued_at, booking_id, hosted_token, guest_id, guest_snapshot, booking:bookings ( reference, guest_name, guest_email )",
      )
      .eq("host_id", hostId),
    admin
      .from("payments")
      .select(
        "id, amount, currency, kind, status, method, note, captured_at, created_at, receipt_token, receipt_number, booking_id, booking:bookings!inner ( host_id, reference, guest_id, guest_name, guest_email )",
      )
      .eq("booking.host_id", hostId)
      .eq("status", "completed"),
    admin
      .from("credit_notes")
      .select(
        "id, credit_note_number, total_amount, currency, issued_at, booking_id, hosted_token, origin, status, guest_id, guest_snapshot, booking:bookings ( reference, guest_name, guest_email )",
      )
      .eq("host_id", hostId)
      .eq("origin", "manual")
      .neq("status", "cancelled"),
    admin
      .from("refund_requests")
      .select(
        "id, requested_amount, approved_amount, currency, created_at, booking_id, status, refund_number, guest_id, booking:bookings ( reference, guest_name, guest_email )",
      )
      .eq("host_id", hostId)
      .in("status", ["approved", "processing", "completed"]),
  ]);

  const one = <T>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

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
    entries.push({
      id: `inv_${inv.id}`,
      date: inv.issued_at as string,
      type: "charge",
      label: inv.kind === "addon" ? "Add-on" : "Charge",
      amount: Number(inv.total_amount),
      currency: inv.currency,
      guestKey: gkeyFor(inv.guest_id, email),
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
      owedEffect: 1,
      cashEffect: 0,
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
      guestKey: gkeyFor(b?.guest_id ?? null, b?.guest_email ?? null),
      guestName: b?.guest_name ?? null,
      bookingId: p.booking_id,
      bookingRef: b?.reference ?? null,
      method: (p.method as string) ?? null,
      note: (p.note as string) ?? null,
      doc: p.receipt_token
        ? {
            kind: "receipt",
            number: (p.receipt_number as string) ?? "Receipt",
            viewPath: `/receipt/${p.receipt_token}`,
            pdfPath: `/receipt/${p.receipt_token}/pdf`,
          }
        : null,
      balance: 0,
      owedEffect: isCredit ? 0 : -1,
      cashEffect: isCash ? 1 : 0,
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
    entries.push({
      id: `cn_${cn.id}`,
      date: cn.issued_at as string,
      type: "credit",
      label: "Credit note",
      amount: Number(cn.total_amount),
      currency: cn.currency,
      guestKey: gkeyFor(cn.guest_id, email),
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
      owedEffect: -1,
      cashEffect: 0,
    });
  }

  for (const rf of refunds ?? []) {
    const b = one(rf.booking) as {
      reference?: string;
      guest_name?: string;
      guest_email?: string;
    } | null;
    entries.push({
      id: `rf_${rf.id}`,
      date: rf.created_at as string,
      type: "refund",
      label: "Refund",
      amount: Number(rf.approved_amount ?? rf.requested_amount),
      currency: rf.currency,
      guestKey: gkeyFor(rf.guest_id, b?.guest_email ?? null),
      guestName: b?.guest_name ?? null,
      bookingId: rf.booking_id,
      bookingRef: b?.reference ?? null,
      method: null,
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
      owedEffect: 1,
      cashEffect: -1,
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

/** Account-wide KPIs from a transaction list. */
export function txnStats(entries: Txn[]): TxnStats {
  let collected = 0;
  let refunded = 0;
  let credits = 0;
  for (const e of entries) {
    if (e.cashEffect > 0) collected += e.amount;
    if (e.type === "refund") refunded += e.amount;
    if (e.type === "credit") credits += e.amount;
  }
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
