import type { Metadata } from "next";
import { Banknote, Check, Clock3, Download, FileText } from "lucide-react";

import { getAffiliateBalance } from "@/lib/affiliate/balance";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import type { PayoutFeeConfig, PayoutMethod } from "@/lib/affiliate/fees";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { PayoutAccountCard } from "../_components/PayoutAccountCard";
import { RequestPayoutCard } from "../_components/RequestPayoutCard";

const MONTHS = [
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

function zar2(n: number): string {
  return (
    "R " +
    n
      .toLocaleString("en-ZA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      .replace(/,/g, " ")
  );
}
function zar0(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}
function dmy(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
    { data: feeRows },
    { data: settings },
    { data: allComms },
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
      .from("affiliate_payout_fees")
      .select("method, fixed_fee, percent_fee, cap_fee"),
    admin
      .from("affiliate_settings")
      .select("min_payout_threshold")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("affiliate_commissions")
      .select("commission_amount, created_at")
      .eq("affiliate_id", account.id)
      .neq("status", "voided")
      .order("created_at", { ascending: false }),
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

  const defaultMethod =
    (methods ?? []).find((m) => m.is_default) ?? (methods ?? [])[0] ?? null;
  const methodKey = (defaultMethod?.method as PayoutMethod) ?? "eft";
  const feeCfg = fees[methodKey];
  const available = balance.available;
  const rawFee = feeCfg.fixed_fee + (available * feeCfg.percent_fee) / 100;
  const fee =
    feeCfg.cap_fee != null ? Math.min(rawFee, feeCfg.cap_fee) : rawFee;
  const net = Math.max(0, available - fee);
  const minThreshold = Number(settings?.min_payout_threshold ?? 0);

  const last4 = (n: string | null) =>
    n && n.length >= 4 ? `•••• ${n.slice(-4)}` : (n ?? "");
  const accountLabel = defaultMethod
    ? defaultMethod.method === "eft"
      ? `${defaultMethod.bank_name || "Bank"} · Cheque`
      : defaultMethod.method === "paypal"
        ? "PayPal"
        : "Paystack"
    : null;
  const accountDetail = defaultMethod
    ? defaultMethod.method === "eft"
      ? `${last4(defaultMethod.account_number)} · ${defaultMethod.account_name ?? ""}`
      : defaultMethod.method === "paypal"
        ? (defaultMethod.paypal_email ?? "")
        : (defaultMethod.paystack_recipient_code ?? "")
    : null;
  const methodLabel =
    methodKey === "eft"
      ? "EFT"
      : methodKey === "paypal"
        ? "PayPal"
        : "Paystack";

  const paidCount = (payouts ?? []).filter((p) => p.status === "paid").length;

  // Monthly commission statements.
  const monthTotals = new Map<string, { total: number; count: number }>();
  for (const c of allComms ?? []) {
    const d = new Date(c.created_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const cur = monthTotals.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(c.commission_amount);
    cur.count += 1;
    monthTotals.set(key, cur);
  }
  const statements = [...monthTotals.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, { total, count }]) => {
      const [y, m] = period.split("-").map(Number);
      return {
        period,
        label: `${MONTHS[m - 1]} ${y} statement`,
        count,
        total: Math.round(total * 100) / 100,
        href: `/wielo-commission/period_${account.id}_${period}/pdf`,
      };
    });

  const statusTag = (s: string) =>
    s === "paid"
      ? { cls: "green", label: "Paid" }
      : s === "failed" || s === "cancelled"
        ? { cls: "red", label: s === "failed" ? "Failed" : "Cancelled" }
        : { cls: "amber", label: "Processing" };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      {/* LEFT */}
      <div className="min-w-0 space-y-6">
        {/* BALANCE BAND */}
        <section className="fade grid grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line">
          <div className="bg-brand-secondary p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
              Available now
            </div>
            <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-white">
              {zar0(available)}
            </div>
            <div className="mt-1 text-[11px] text-brand-accent">
              Cleared · ready to withdraw
            </div>
          </div>
          <div className="bg-[#FAFCFB] p-4">
            <div className="smallcaps">On hold</div>
            <div className="num mt-1.5 font-display text-[20px] font-bold leading-none text-brand-ink">
              {zar0(balance.pending)}
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              Clears after the hold
            </div>
          </div>
          <div className="bg-[#FAFCFB] p-4">
            <div className="smallcaps">Paid out to date</div>
            <div className="num mt-1.5 font-display text-[20px] font-bold leading-none text-brand-ink">
              {zar0(balance.paid)}
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              {paidCount} payout{paidCount === 1 ? "" : "s"}
            </div>
          </div>
        </section>

        {/* PAYOUT HISTORY */}
        <section className="am-card fade overflow-hidden">
          <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
            <div className="smallcaps">Payout history</div>
          </div>
          <div className="overflow-x-auto">
            <table className="ttable">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Reference</th>
                  <th className="r">Amount</th>
                  <th className="r">Fee</th>
                  <th className="r">Paid</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(payouts ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-brand-mute"
                    >
                      No payouts yet. Request one once your cleared balance is
                      above {zar0(minThreshold)}.
                    </td>
                  </tr>
                ) : (
                  (payouts ?? []).map((p) => {
                    const tag = statusTag(p.status as string);
                    const d = new Date(p.processed_at ?? p.requested_at);
                    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
                    return (
                      <tr key={p.id}>
                        <td className="num">{dmy(p.requested_at as string)}</td>
                        <td className="mono text-[12px]">
                          #{(p.id as string).slice(0, 8).toUpperCase()}
                        </td>
                        <td className="num r font-semibold">
                          {zar2(Number(p.gross_amount))}
                        </td>
                        <td className="num r text-brand-mute">
                          {zar2(Number(p.fee_amount))}
                        </td>
                        <td className="num r">{zar2(Number(p.net_amount))}</td>
                        <td>
                          <span className={`tag ${tag.cls}`}>
                            <span className="d" />
                            {tag.label}
                          </span>
                        </td>
                        <td className="r">
                          {p.status === "paid" ? (
                            <a
                              href={`/wielo-commission/period_${account.id}_${period}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost h-8"
                            >
                              <FileText className="h-3.5 w-3.5" /> Remittance
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* COMMISSION STATEMENTS */}
        {statements.length > 0 ? (
          <section className="am-card fade overflow-hidden">
            <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
              <div className="smallcaps">Commission statements</div>
              <span className="text-[11.5px] text-brand-mute">
                One per month · CN-numbered
              </span>
            </div>
            <div className="p-2.5">
              {statements.map((s) => (
                <div key={s.period} className="arow">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                    <FileText className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-brand-ink">
                      {s.label}
                    </div>
                    <div className="num mt-0.5 text-[12px] text-brand-mute">
                      {s.count} commission{s.count === 1 ? "" : "s"} ·{" "}
                      {zar0(s.total)} accrued
                    </div>
                  </div>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost h-8 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* RIGHT RAIL */}
      <div className="min-w-0 space-y-6">
        <RequestPayoutCard
          available={available}
          fee={fee}
          net={net}
          minThreshold={minThreshold}
          method={defaultMethod ? methodKey : null}
          methodLabel={methodLabel}
          hasMethod={!!defaultMethod}
        />

        {/* HOW MONEY MOVES */}
        <section className="am-card fade overflow-hidden">
          <div className="smallcaps border-b border-brand-line px-5 py-3.5">
            How your money moves
          </div>
          <div className="space-y-3 p-5">
            <Step
              icon={<Clock3 className="h-3.5 w-3.5" />}
              tint="border-[#FCE9B6] bg-[#FFFBEB] text-[#B45309]"
              title="Pending (hold window)"
              body="New commission holds briefly — this protects you and hosts against early refunds."
            />
            <Step
              icon={<Check className="h-3.5 w-3.5" />}
              tint="border-[#C7F0DC] bg-[#ECFDF5] text-[#047857]"
              title="Cleared"
              body={`After the hold, money is yours to withdraw any time above ${zar0(minThreshold)}.`}
            />
            <Step
              icon={<Banknote className="h-3.5 w-3.5" />}
              tint="border-[#D7DBFB] bg-[#EEF0FF] text-[#4F46E5]"
              title="Paid"
              body="We settle to your account and issue a numbered remittance for your records."
            />
          </div>
        </section>

        {/* PAYOUT ACCOUNT */}
        <PayoutAccountCard
          label={accountLabel}
          detail={accountDetail}
          hasAccount={!!defaultMethod}
        />
      </div>
    </div>
  );
}

function Step({
  icon,
  tint,
  title,
  body,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${tint}`}
      >
        {icon}
      </div>
      <div>
        <div className="text-[12.5px] font-semibold text-brand-ink">
          {title}
        </div>
        <div className="text-[11.5px] leading-relaxed text-brand-mute">
          {body}
        </div>
      </div>
    </div>
  );
}
