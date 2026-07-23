"use client";

import { Check, ExternalLink, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

import { settleAffiliatePayoutAction } from "../../actions";

// Payout management, styled to the affiliate-manager design system. The campaign
// picker scopes the COMMISSION figures; payout requests are per-partner by design
// (a payout settles a partner's whole cleared balance), so those are labelled
// rather than silently filtered.

type Balance = {
  pending: number;
  available: number;
  inPayout: number;
  paid: number;
  lifetime: number;
  currency: string;
};

type PartnerRow = Balance & {
  id: string;
  name: string;
  email: string | null;
  slug: string;
  entries: number;
};

type PayoutRow = {
  id: string;
  affiliateId: string;
  name: string;
  method: string;
  status: string;
  gross: number;
  fee: number;
  net: number;
  currency: string;
  requestedAt: string;
  processedAt: string | null;
  reference: string | null;
  failureReason: string | null;
  inSelectedCampaign: boolean;
};

function payoutTag(status: string): { cls: string; label: string } {
  switch (status) {
    case "paid":
      return { cls: "green", label: "Paid" };
    case "approved":
      return { cls: "sky", label: "Approved" };
    case "processing":
      return { cls: "indigo", label: "Processing" };
    case "rejected":
      return { cls: "red", label: "Rejected" };
    case "failed":
      return { cls: "red", label: "Failed" };
    case "cancelled":
      return { cls: "gray", label: "Cancelled" };
    default:
      return { cls: "amber", label: "Requested" };
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PayoutsManager({
  campaigns,
  selected,
  totals,
  partners,
  payouts,
}: {
  campaigns: { id: string; name: string; status: string }[];
  selected: string;
  totals: Balance;
  partners: PartnerRow[];
  payouts: PayoutRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [onlyThisCampaign, setOnlyThisCampaign] = useState(true);
  const [reference, setReference] = useState<Record<string, string>>({});

  const scoped = selected !== "all";
  const visiblePayouts =
    scoped && onlyThisCampaign
      ? payouts.filter((p) => p.inSelectedCampaign)
      : payouts;
  const openPayouts = visiblePayouts.filter(
    (p) => p.status === "requested" || p.status === "approved",
  );
  const historyPayouts = visiblePayouts.filter(
    (p) => p.status !== "requested" && p.status !== "approved",
  );

  function settle(payoutId: string, action: "approve" | "paid" | "reject") {
    startTransition(async () => {
      const res = await settleAffiliatePayoutAction({
        payoutId,
        action,
        reference: reference[payoutId] || undefined,
      });
      if (res.ok) {
        toast.success(
          action === "paid"
            ? "Marked paid — the partner has been notified."
            : action === "approve"
              ? "Payout approved."
              : "Payout rejected.",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* CAMPAIGN FILTER */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="smallcaps mr-1">Campaign</span>
        <FilterChip
          href="/admin/affiliates/payouts?campaign=all"
          active={selected === "all"}
        >
          All commission
        </FilterChip>
        {campaigns.map((c) => (
          <FilterChip
            key={c.id}
            href={`/admin/affiliates/payouts?campaign=${c.id}`}
            active={selected === c.id}
          >
            {c.name}
            {c.status !== "active" ? (
              <span className="ml-1 text-[10px] opacity-70">({c.status})</span>
            ) : null}
          </FilterChip>
        ))}
        <FilterChip
          href="/admin/affiliates/payouts?campaign=none"
          active={selected === "none"}
        >
          Outside any campaign
        </FilterChip>
      </div>

      {/* BALANCE BAND */}
      <section className="fade grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line md:grid-cols-5">
        <div className="bg-brand-secondary p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Payable now
          </div>
          <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-white">
            {formatMoney(totals.available, totals.currency)}
          </div>
          <div className="mt-1 text-[11px] text-brand-accent">
            Cleared, not yet in a payout
          </div>
        </div>
        <BandCell
          label="On hold"
          value={formatMoney(totals.pending, totals.currency)}
          sub="Inside the refund window"
        />
        <BandCell
          label="In flight"
          value={formatMoney(totals.inPayout, totals.currency)}
          sub="Attached to an open payout"
        />
        <BandCell
          label="Paid to date"
          value={formatMoney(totals.paid, totals.currency)}
          sub="Settled to partners"
        />
        <BandCell
          label="Lifetime earned"
          value={formatMoney(totals.lifetime, totals.currency)}
          sub="Net of clawbacks"
        />
      </section>

      {/* OPEN PAYOUT REQUESTS */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[17px] font-bold text-brand-ink">
              Payout requests to action
            </h2>
            <p className="mt-0.5 text-[12.5px] text-brand-mute">
              A payout settles a partner&apos;s whole cleared balance, not one
              campaign&apos;s share.
            </p>
          </div>
          {scoped ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-brand-ink">
              <input
                type="checkbox"
                checked={onlyThisCampaign}
                onChange={(e) => setOnlyThisCampaign(e.target.checked)}
                className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
              />
              Only partners in this campaign
            </label>
          ) : null}
        </div>

        {openPayouts.length === 0 ? (
          <div className="am-card px-5 py-8 text-center text-[13px] text-brand-mute">
            No payouts awaiting action.
          </div>
        ) : (
          openPayouts.map((p) => {
            const tag = payoutTag(p.status);
            return (
              <div key={p.id} className="am-card fade p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[14px] font-semibold text-brand-ink">
                    {p.name}
                  </span>
                  <span className={`tag ${tag.cls}`}>
                    <span className="d" />
                    {tag.label}
                  </span>
                  <span className="text-[12.5px] uppercase text-brand-mute">
                    {p.method}
                  </span>
                  <span className="text-[12.5px] text-brand-mute">
                    requested {fmtDate(p.requestedAt)}
                  </span>
                  <span className="ml-auto text-right">
                    <span className="num font-display text-[18px] font-bold text-brand-ink">
                      {formatMoney(p.net, p.currency)}
                    </span>
                    <span className="ml-1.5 text-[11px] text-brand-mute">
                      net ({formatMoney(p.gross, p.currency)} −{" "}
                      {formatMoney(p.fee, p.currency)} fee)
                    </span>
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
                  <input
                    value={reference[p.id] ?? ""}
                    onChange={(e) =>
                      setReference((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                    placeholder="Bank / PayPal reference"
                    className="fld h-9 w-56"
                  />
                  {p.status === "requested" ? (
                    <button
                      type="button"
                      onClick={() => settle(p.id, "approve")}
                      disabled={pending}
                      className="btn-sec h-9"
                    >
                      Approve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => settle(p.id, "paid")}
                    disabled={pending}
                    className="btn-pri h-9"
                  >
                    <Check className="h-4 w-4" />
                    Mark paid
                  </button>
                  <button
                    type="button"
                    onClick={() => settle(p.id, "reject")}
                    disabled={pending}
                    className="btn-danger h-9"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                  <Link
                    href={`/admin/affiliates/${p.affiliateId}`}
                    className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-primary hover:underline"
                  >
                    Partner record
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* COMMISSION BY PARTNER */}
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Commission by partner</div>
          <p className="mt-0.5 text-[11.5px] text-brand-mute">
            {selected === "all"
              ? "Every commission entry on the platform."
              : selected === "none"
                ? "Commission earned outside any campaign."
                : "Commission earned in this campaign only."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Partner</th>
                <th className="r">Entries</th>
                <th className="r">On hold</th>
                <th className="r">Payable now</th>
                <th className="r">Paid</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-brand-mute">
                    No commission recorded for this selection yet.
                  </td>
                </tr>
              ) : (
                partners.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/admin/affiliates/${r.id}`}
                        className="min-w-0"
                      >
                        <span className="block truncate text-[13.5px] font-semibold text-brand-ink hover:text-brand-primary">
                          {r.name}
                        </span>
                        <span className="mono block truncate text-[11px] text-brand-mute">
                          /r/{r.slug}
                        </span>
                      </Link>
                    </td>
                    <td className="num r text-brand-mute">{r.entries}</td>
                    <td className="num r text-brand-mute">
                      {formatMoney(r.pending, r.currency)}
                    </td>
                    <td
                      className={`num r font-semibold ${r.available > 0 ? "text-brand-primary" : "text-brand-mute"}`}
                    >
                      {formatMoney(r.available, r.currency)}
                    </td>
                    <td className="num r text-brand-ink">
                      {formatMoney(r.paid, r.currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PAYOUT HISTORY */}
      <section className="am-card overflow-hidden">
        <div className="border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Payout history</div>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Requested</th>
                <th>Method</th>
                <th className="r">Net</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {historyPayouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-brand-mute">
                    No settled payouts yet.
                  </td>
                </tr>
              ) : (
                historyPayouts.map((p) => {
                  const tag = payoutTag(p.status);
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold text-brand-ink">{p.name}</td>
                      <td className="num text-brand-mute">
                        {fmtDate(p.requestedAt)}
                      </td>
                      <td className="uppercase text-brand-mute">{p.method}</td>
                      <td className="num r font-medium">
                        {formatMoney(p.net, p.currency)}
                      </td>
                      <td>
                        <span className={`tag ${tag.cls}`}>
                          <span className="d" />
                          {tag.label}
                        </span>
                      </td>
                      <td className="mono text-[11px] text-brand-mute">
                        {p.reference ?? p.failureReason ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BandCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="smallcaps">{label}</div>
      <div className="num mt-1.5 font-display text-[18px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-brand-mute">{sub}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-pill bg-brand-secondary px-3 py-1.5 text-[12.5px] font-semibold text-white"
          : "rounded-pill border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
      }
    >
      {children}
    </Link>
  );
}
