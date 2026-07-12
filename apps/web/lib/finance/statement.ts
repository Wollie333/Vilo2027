import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchHostTransactions, type Txn } from "@/lib/finance/transactions";
import { getHostParty } from "@/lib/finance/doc-party";
import { fetchWieloLedger, type WieloTxn } from "@/lib/billing/wielo-ledger";
import { isAffiliateTxn } from "@/lib/billing/wielo-ledger";
import {
  getWieloBusinessProfile,
  wieloIssuerLines,
} from "@/lib/billing/wielo-invoice";
import type { StatementToken } from "@/lib/finance/statement-token";

// Builds the data behind a Statement of Account (F4) — a bank-style running
// ledger between two parties over a period. It is a pure VIEW: every figure is
// re-derived from the live ledger (host↔guest via fetchHostTransactions, or
// Wielo↔host via fetchWieloLedger); nothing is stored and no doc number is
// minted. Each line is a single signed movement (+ charge / − payment) with the
// running balance after it — opening "brought forward", closing "carried
// forward", plus period charge/payment subtotals and a VAT summary.

type Admin = ReturnType<typeof createAdminClient>;

export type StatementLine = {
  date: string;
  /** Main label, e.g. "Booking BK-0037" / "Subscription — Beta". */
  title: string;
  /** Secondary line: document ref / method / status. */
  sub: string | null;
  /** Signed movement: + increases what the recipient owes, − reduces it. */
  amount: number;
  /** Running balance owed AFTER this line (+ owes, − in credit). */
  balance: number;
};

export type StatementParty = { name: string; lines: string[] };

export type StatementData = {
  context: StatementToken["ctx"];
  /** Display-only reference — NOT a sequenced doc number (statements mint none). */
  reference: string;
  kind: string; // "Statement of account"
  issuer: StatementParty;
  recipientLabel: string;
  recipient: StatementParty;
  /** ISO; null = all activity. */
  periodFrom: string | null;
  periodTo: string;
  issuedAt: string;
  currency: string;
  openingBalance: number;
  lines: StatementLine[];
  closingBalance: number;
  totalCharges: number;
  totalPayments: number;
  /** VAT included within the period's charges, or null when not applicable. */
  vatIncluded: number | null;
  vatRate: number | null;
  /** e.g. "Balance due" / "Balance carried forward". */
  balanceLabel: string;
  /** True when the recipient still owes money (closing > 0). */
  outstanding: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Host → Guest ────────────────────────────────────────────────────────
// The guest ledger already models payments as their own rows, so each Txn is a
// single signed movement (owedEffect * amount) and the running balance follows
// directly.
async function buildHostGuestStatement(
  admin: Admin,
  tok: StatementToken,
): Promise<StatementData | null> {
  if (!tok.gkey) return null;

  const txns = await fetchHostTransactions(admin, {
    hostId: tok.hostId,
    gkey: tok.gkey,
  });

  const asc = [...txns].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  let opening = 0;
  const lines: StatementLine[] = [];
  let totalCharges = 0;
  let totalPayments = 0;
  let vatIncluded = 0;
  let sawVat = false;

  for (const e of asc) {
    if (e.date > tok.to) break; // ignore anything after the as-at date
    const delta = r2(e.owedEffect * e.amount);
    running = r2(running + delta);
    if (tok.from && e.date < tok.from) {
      opening = running; // still building the brought-forward balance
      continue;
    }
    if (delta > 0) totalCharges = r2(totalCharges + delta);
    else if (delta < 0) totalPayments = r2(totalPayments - delta);
    // VAT summary from the REAL vat_amount on each row — a charge adds its VAT, a
    // cancellation credit note removes the VAT it reversed. Payments, refunds and
    // forfeits carry no VAT, so they never distort the figure (the old
    // 15/115-of-total-charges derivation wrongly taxed refunds/forfeits too).
    if (e.vatAmount) {
      if (e.type === "charge") {
        vatIncluded = r2(vatIncluded + e.vatAmount);
        sawVat = true;
      } else if (e.type === "credit" && e.category === "booking") {
        vatIncluded = r2(vatIncluded - e.vatAmount);
        sawVat = true;
      }
    }
    lines.push({
      date: e.date,
      title: describeGuestTxn(e),
      sub: guestTxnSub(e),
      amount: delta,
      balance: running,
    });
  }

  const closing = running;

  // Issuer = the host's real business identity; recipient = the guest.
  const host = await getHostParty(admin, tok.hostId);
  const { data: rec } = await admin.rpc("fetch_guest_record", {
    p_host_id: tok.hostId,
    p_gkey: tok.gkey,
  });
  const guest = rec as {
    name?: string | null;
    email?: string | null;
    error?: string;
  } | null;
  const guestName =
    (guest && !guest.error ? guest.name : null) ||
    asc.find((t) => t.guestName)?.guestName ||
    "Guest";
  const recipientLines = guest?.email ? [guest.email] : [];

  return {
    context: "host_guest",
    reference: statementRef(tok),
    kind: "Statement of account",
    issuer: { name: host.name, lines: host.lines },
    recipientLabel: "Statement for",
    recipient: { name: guestName, lines: recipientLines },
    periodFrom: tok.from,
    periodTo: tok.to,
    issuedAt: tok.issuedAt,
    currency: tok.currency,
    openingBalance: opening,
    lines,
    closingBalance: closing,
    totalCharges,
    totalPayments,
    vatIncluded: sawVat ? vatIncluded : null,
    vatRate: sawVat ? 15 : null,
    balanceLabel: closing > 0.5 ? "Balance due" : "Balance carried forward",
    outstanding: closing > 0.5,
  };
}

function describeGuestTxn(e: Txn): string {
  const ref = e.bookingRef ? ` · ${e.bookingRef}` : "";
  return `${e.label}${ref}`;
}

function guestTxnSub(e: Txn): string | null {
  const bits: string[] = [];
  if (e.doc?.number) bits.push(e.doc.number);
  if (e.method) bits.push(e.method);
  if (!bits.length && e.note) return e.note;
  return bits.length ? bits.join(" · ") : null;
}

// ── Wielo → Host ────────────────────────────────────────────────────────
// The platform ledger is AR-style: a completed charge is billed AND settled in
// one row (net zero to the balance). To read like a bank statement we emit the
// charge as a debit and, when it's paid, an offsetting "payment received"
// credit — so every movement is visible and balance = opening + Σ(charge −
// payment) still equals the ledger's authoritative outstanding balance.
async function buildWieloHostStatement(
  admin: Admin,
  tok: StatementToken,
): Promise<StatementData | null> {
  if (!tok.userId) return null;

  const all = await fetchWieloLedger(admin, {
    userId: tok.userId,
    limit: 1000,
  });
  // Host billing only — affiliate payouts/commissions are a different relationship.
  const rows = all.filter((r) => !isAffiliateTxn(r.type));
  const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  let opening = 0;
  const lines: StatementLine[] = [];
  let totalCharges = 0;
  let totalPayments = 0;
  let vatIncluded = 0;
  let sawVat = false;

  const push = (
    date: string,
    title: string,
    sub: string | null,
    delta: number,
    beforeStart: boolean,
  ) => {
    running = r2(running + delta);
    if (beforeStart) {
      opening = running;
      return;
    }
    if (delta > 0) totalCharges = r2(totalCharges + delta);
    else if (delta < 0) totalPayments = r2(totalPayments - delta);
    lines.push({ date, title, sub, amount: delta, balance: running });
  };

  for (const t of asc) {
    if (t.date > tok.to) break;
    if (t.status === "failed") continue;
    const before = Boolean(tok.from && t.date < tok.from);
    const title = describeWieloTxn(t);
    const docRef = t.doc?.number ?? null;

    if (t.type === "charge") {
      const amt = Math.abs(t.amount);
      const paid = t.status === "completed";
      if (!before && t.vatAmount != null) {
        vatIncluded = r2(vatIncluded + t.vatAmount);
        sawVat = true;
      }
      push(
        t.date,
        title,
        docRef ? `${docRef} · Charge` : "Charge",
        amt,
        before,
      );
      if (paid) {
        push(
          t.date,
          `Payment received — ${title}`,
          docRef ? `${docRef} · Paid` : "Paid",
          -amt,
          before,
        );
      }
    } else if (t.type === "credit") {
      // amount is signed negative → a credit reduces what the host owes.
      push(
        t.date,
        title,
        docRef ? `${docRef} · Credit` : "Credit",
        -Math.abs(t.amount),
        before,
      );
    } else if (t.type === "adjustment") {
      push(
        t.date,
        title,
        docRef ? `${docRef} · Adjustment` : "Adjustment",
        r2(t.amount),
        before,
      );
    } else if (t.type === "refund") {
      // A refund is cash Wielo returned; it settles against a prior credit, so it
      // leaves the owed balance unchanged (memo line, both sides shown).
      const amt = Math.abs(t.amount);
      push(
        t.date,
        title,
        docRef ? `${docRef} · Refunded` : "Refunded",
        amt,
        before,
      );
      push(t.date, `Refund paid out — ${title}`, "Cash returned", -amt, before);
    }
  }

  const closing = running;

  const snap = await getWieloBusinessProfile();
  const issuer = wieloIssuerLines(snap);
  const { data: up } = await admin
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", tok.userId)
    .maybeSingle();

  return {
    context: "wielo_host",
    reference: statementRef(tok),
    kind: "Statement of account",
    issuer,
    recipientLabel: "Statement for",
    recipient: {
      name: up?.full_name || "Host",
      lines: up?.email ? [up.email] : [],
    },
    periodFrom: tok.from,
    periodTo: tok.to,
    issuedAt: tok.issuedAt,
    currency: tok.currency,
    openingBalance: opening,
    lines,
    closingBalance: closing,
    totalCharges,
    totalPayments,
    vatIncluded: sawVat ? vatIncluded : null,
    vatRate: sawVat ? 15 : null,
    balanceLabel:
      closing > 0.5 ? "Balance due to Wielo" : "Balance carried forward",
    outstanding: closing > 0.5,
  };
}

function describeWieloTxn(t: WieloTxn): string {
  if (t.type === "charge") {
    const what = t.plan ? `Subscription — ${t.plan}` : t.reason || "Charge";
    return what;
  }
  if (t.type === "credit") return t.reason || "Credit";
  if (t.type === "adjustment") return t.reason || "Adjustment";
  if (t.type === "refund") return t.reason || "Refund";
  return t.reason || t.type;
}

function statementRef(tok: StatementToken): string {
  // Display-only, non-sequential (a statement mints no global doc number).
  const short = (tok.userId ?? tok.gkey ?? tok.hostId)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
  const day = tok.issuedAt.slice(0, 10).replace(/-/g, "");
  return `STMT-${short}-${day}`;
}

export async function loadStatement(
  tok: StatementToken,
): Promise<StatementData | null> {
  const admin = createAdminClient();
  return tok.ctx === "host_guest"
    ? buildHostGuestStatement(admin, tok)
    : buildWieloHostStatement(admin, tok);
}
