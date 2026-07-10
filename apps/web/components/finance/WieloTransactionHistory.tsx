import { Download, ReceiptText } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";

// Wielo platform transaction history for the SIGNED-IN user (host or guest).
// Single source of truth for both the host settings tab and the guest portal
// tab. Reads platform_ledger + wielo_invoices + wielo_credit_notes, all scoped
// to auth.uid() by RLS (platform_ledger_own_read / wielo_invoices_own_read /
// wielo_credit_notes_own_read) — a user only ever sees their own transactions
// with Wielo, with the matching downloadable document per row: a charge → its
// invoice, a refund / credit / adjustment → its credit note. Pending purchases
// (unpaid pay-links / EFT intents) already post a pending ledger row, so they
// appear here as "pending" until they settle. Mirrors the admin per-user Wielo
// ledger's Document column (lib/billing/wielo-ledger.ts), scoped by RLS.

type LedgerRow = {
  id: string;
  created_at: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  environment: string;
  reason: string | null;
  plan: string | null;
  billing_cycle: string | null;
};

// The one downloadable document behind a ledger row: an invoice for a charge, a
// credit note / refund / adjustment for the rest. Minted by DB triggers keyed on
// ledger_id, so we join on that.
type LedgerDoc = {
  label: string;
  href: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function WieloTransactionHistory({
  heading = "Transaction history",
  description = "Your payments for subscriptions and products, with downloadable invoices and credit notes.",
}: {
  heading?: string;
  description?: string;
}) {
  const supabase = createServerClient();
  const [
    { data: ledger },
    { data: invoices },
    { data: notes },
    { data: productRows },
  ] = await Promise.all([
    supabase
      .from("platform_ledger")
      .select(
        "id, created_at, type, status, amount, currency, environment, reason, plan, billing_cycle",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("wielo_invoices")
      .select("ledger_id, hosted_token, invoice_number")
      .limit(200),
    supabase
      .from("wielo_credit_notes")
      .select("ledger_id, hosted_token, credit_note_number, kind")
      .limit(200),
    supabase.from("products").select("name, plan_key, slug"),
  ]);

  // Map a plan tier → its product name so a row reads "Starter", not "pro".
  const productByTier = new Map<string, string>();
  for (const p of productRows ?? []) {
    const key = (p.plan_key ?? p.slug) as string | null;
    if (key && !productByTier.has(key)) {
      productByTier.set(key, p.name as string);
    }
  }

  // One document per ledger row: a charge → its invoice, a refund / credit /
  // adjustment → its credit note. Invoices win if a row somehow has both.
  const docByLedger = new Map<string, LedgerDoc>();
  for (const cn of notes ?? []) {
    if (!cn.ledger_id || !cn.hosted_token) continue;
    const label =
      cn.kind === "refund"
        ? "Refund"
        : cn.kind === "adjustment"
          ? "Adjustment"
          : "Credit note";
    docByLedger.set(cn.ledger_id, {
      label,
      href: `/wielo-credit-note/${cn.hosted_token}/pdf`,
    });
  }
  for (const inv of invoices ?? []) {
    if (!inv.ledger_id || !inv.hosted_token) continue;
    docByLedger.set(inv.ledger_id, {
      label: "Invoice",
      href: `/wielo-invoice/${inv.hosted_token}/pdf`,
    });
  }

  const rows = (ledger ?? []) as LedgerRow[];

  const describe = (r: LedgerRow): string => {
    if (r.plan) {
      const name = productByTier.get(r.plan) ?? r.plan;
      return `${name}${r.billing_cycle ? ` · ${r.billing_cycle}` : ""}`;
    }
    if (r.reason) return r.reason;
    // Non-charge rows without a stored reason fall back to a type label.
    if (r.type === "refund") return "Refund";
    if (r.type === "credit") return "Credit";
    if (r.type === "adjustment") return "Adjustment";
    return "Purchase";
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold text-brand-ink">
          {heading}
        </h1>
        <p className="mt-1 text-sm text-brand-mute">{description}</p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-card border border-brand-line bg-white p-8 text-center shadow-card">
          <ReceiptText className="mx-auto h-7 w-7 text-brand-mute" />
          <p className="mt-2 text-sm text-brand-mute">
            No transactions yet. Your purchases will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line bg-brand-light/50 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Document</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const doc = docByLedger.get(r.id);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-brand-line last:border-0"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-brand-mute">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-brand-ink">
                        {describe(r)}
                      </span>
                      {r.environment === "test" ? (
                        <span className="ml-2 inline-flex items-center rounded-pill border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700">
                          Test
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`num whitespace-nowrap px-4 py-3 text-right font-medium ${
                        r.amount < 0 ? "text-emerald-600" : "text-brand-ink"
                      }`}
                    >
                      {formatMoney(r.amount, r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {doc ? (
                        <a
                          href={doc.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-secondary hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" /> {doc.label}
                        </a>
                      ) : (
                        <span className="text-[12px] text-brand-mute">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    pending:
      "bg-status-pending/10 text-status-pending border-status-pending/30",
    failed:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  };
  const cls = map[status] ?? "bg-brand-light text-brand-mute border-brand-line";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
