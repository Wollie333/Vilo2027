import { Download, ReceiptText } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { createServerClient } from "@/lib/supabase/server";

// Wielo platform transaction history for the SIGNED-IN user (host or guest).
// Single source of truth for both the host settings tab and the guest portal
// tab. Reads platform_ledger + vilo_invoices, both scoped to auth.uid() by RLS
// (platform_ledger_own_read / vilo_invoices_own_read) — a user only ever sees
// their own purchases from Wielo, with downloadable invoices.

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function ViloTransactionHistory({
  heading = "Transaction history",
  description = "Your payments for subscriptions and products, with downloadable invoices.",
}: {
  heading?: string;
  description?: string;
}) {
  const supabase = createServerClient();
  const [{ data: ledger }, { data: invoices }] = await Promise.all([
    supabase
      .from("platform_ledger")
      .select(
        "id, created_at, type, status, amount, currency, environment, reason, plan, billing_cycle",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("vilo_invoices")
      .select("ledger_id, hosted_token, invoice_number")
      .limit(200),
  ]);

  const invByLedger = new Map<
    string,
    { hosted_token: string; invoice_number: string }
  >();
  for (const inv of invoices ?? []) {
    if (inv.ledger_id) {
      invByLedger.set(inv.ledger_id, {
        hosted_token: inv.hosted_token,
        invoice_number: inv.invoice_number,
      });
    }
  }

  const rows = (ledger ?? []) as LedgerRow[];

  const describe = (r: LedgerRow): string => {
    if (r.plan)
      return `${r.plan}${r.billing_cycle ? ` · ${r.billing_cycle}` : ""}`;
    return r.reason ?? "Purchase";
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
                <th className="px-4 py-3 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inv = invByLedger.get(r.id);
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
                    <td className="num whitespace-nowrap px-4 py-3 text-right font-medium text-brand-ink">
                      {formatMoney(r.amount, r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {inv ? (
                        <a
                          href={`/vilo-invoice/${inv.hosted_token}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-secondary hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" /> Invoice
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
