import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";

import { getAffiliateBalance } from "@/lib/affiliate/balance";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import type { PayoutFeeConfig, PayoutMethod } from "@/lib/affiliate/fees";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { PayoutPanel } from "../_components/PayoutPanel";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const metadata: Metadata = { title: "Affiliate payouts" };
export const dynamic = "force-dynamic";

export default async function AffiliatePayoutsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);
  if (!account) return null;

  const [
    balance,
    { data: methods },
    { data: payouts },
    { data: commissions },
    { data: feeRows },
    { data: settings },
  ] = await Promise.all([
    getAffiliateBalance(admin, account.id),
    admin
      .from("affiliate_payout_methods")
      .select(
        "id, method, is_default, bank_name, account_name, account_number, branch_code, paystack_recipient_code, paypal_email",
      )
      .eq("affiliate_id", account.id),
    admin
      .from("affiliate_payouts")
      .select(
        "id, method, status, gross_amount, fee_amount, net_amount, requested_at, processed_at",
      )
      .eq("affiliate_id", account.id)
      .order("requested_at", { ascending: false })
      .limit(25),
    admin
      .from("affiliate_commissions")
      .select(
        "id, status, kind, entry_type, commission_amount, created_at, cleared_at",
      )
      .eq("affiliate_id", account.id)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("affiliate_payout_fees")
      .select("method, fixed_fee, percent_fee, cap_fee"),
    admin
      .from("affiliate_settings")
      .select("min_payout_threshold")
      .eq("id", true)
      .maybeSingle(),
  ]);

  const fees: Record<PayoutMethod, PayoutFeeConfig> = {
    eft: { fixed_fee: 0, percent_fee: 0, cap_fee: null },
    paystack: { fixed_fee: 0, percent_fee: 0, cap_fee: null },
    paypal: { fixed_fee: 0, percent_fee: 0, cap_fee: null },
  };
  for (const f of feeRows ?? []) {
    fees[f.method as PayoutMethod] = {
      fixed_fee: Number(f.fixed_fee),
      percent_fee: Number(f.percent_fee),
      cap_fee: f.cap_fee != null ? Number(f.cap_fee) : null,
    };
  }

  const last4 = (n: string | null) =>
    n && n.length >= 4 ? `••••${n.slice(-4)}` : (n ?? "");

  const methodRows = (methods ?? []).map((m) => ({
    id: m.id,
    method: m.method as PayoutMethod,
    isDefault: m.is_default,
    label:
      m.method === "eft"
        ? m.bank_name || "Bank account"
        : m.method === "paypal"
          ? "PayPal"
          : "Paystack",
    detail:
      m.method === "eft"
        ? `${m.account_name ?? ""} · ${last4(m.account_number)}`
        : m.method === "paypal"
          ? (m.paypal_email ?? "")
          : (m.paystack_recipient_code ?? ""),
  }));

  const minThreshold = Number(settings?.min_payout_threshold ?? 0);
  const threshold = account.payout_threshold ?? minThreshold;

  // Monthly statements — one downloadable PDF per month the affiliate earned in.
  const { data: allComms } = await admin
    .from("affiliate_commissions")
    .select("commission_amount, created_at")
    .eq("affiliate_id", account.id)
    .neq("status", "voided")
    .order("created_at", { ascending: false });
  const monthTotals = new Map<string, number>();
  for (const c of allComms ?? []) {
    const d = new Date(c.created_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthTotals.set(
      key,
      (monthTotals.get(key) ?? 0) + Number(c.commission_amount),
    );
  }
  const statements = [...monthTotals.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, total]) => {
      const [y, m] = period.split("-").map(Number);
      return {
        period,
        label: `${MONTH_LABELS[m - 1]} ${y}`,
        total: Math.round(total * 100) / 100,
        href: `/wielo-commission/period_${account.id}_${period}/pdf`,
      };
    });

  return (
    <div className="space-y-6">
      <PayoutPanel
        currency={account.currency}
        balance={{
          available: balance.available,
          pending: balance.pending,
          cleared: balance.cleared,
          paid: balance.paid,
          lifetime: balance.lifetime,
        }}
        methods={methodRows}
        fees={fees}
        threshold={threshold}
        minThreshold={minThreshold}
        payouts={(payouts ?? []).map((p) => ({
          id: p.id,
          method: p.method,
          status: p.status,
          gross: Number(p.gross_amount),
          fee: Number(p.fee_amount),
          net: Number(p.net_amount),
          requestedAt: p.requested_at,
          processedAt: p.processed_at,
        }))}
        commissions={(commissions ?? []).map((c) => ({
          id: c.id,
          status: c.status,
          kind: c.kind,
          entryType: c.entry_type,
          amount: Number(c.commission_amount),
          createdAt: c.created_at,
        }))}
      />

      {statements.length > 0 ? (
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
            <FileText className="h-3.5 w-3.5 text-brand-primary" />
            Monthly statements
          </div>
          <p className="mt-1.5 text-[13px] text-brand-mute">
            A downloadable PDF of everything you earned each month.
          </p>
          <div className="mt-4 divide-y divide-brand-line">
            {statements.map((s) => (
              <div
                key={s.period}
                className="flex items-center justify-between py-2.5"
              >
                <div>
                  <div className="text-[13.5px] font-semibold text-brand-ink">
                    {s.label}
                  </div>
                  <div className="num text-[12px] text-brand-mute">
                    {formatMoney(s.total, account.currency)} earned
                  </div>
                </div>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
