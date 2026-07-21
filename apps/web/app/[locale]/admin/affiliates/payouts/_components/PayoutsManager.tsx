"use client";

import { Check, ExternalLink, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminStatBand,
  type AdminStat,
} from "@/app/[locale]/admin/_components/AdminStatBand";
import {
  AdminTable,
  type AdminColumn,
} from "@/app/[locale]/admin/_components/AdminTable";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

import { settleAffiliatePayoutAction } from "../../actions";

// Payout management. The campaign picker scopes the COMMISSION figures; payout
// requests are per-partner by design (a payout settles a partner's whole cleared
// balance), so those are labelled rather than silently filtered.

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

const STATUS_STYLE: Record<string, string> = {
  requested: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-sky-200 bg-sky-50 text-sky-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-600",
  failed: "border-rose-200 bg-rose-50 text-rose-600",
};

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

  const stats: AdminStat[] = [
    {
      label: "Payable now",
      value: formatMoney(totals.available, totals.currency),
      sub: "cleared, not yet in a payout",
      tone: totals.available > 0 ? "primary" : "default",
    },
    {
      label: "On hold",
      value: formatMoney(totals.pending, totals.currency),
      sub: "inside the refund window",
    },
    {
      label: "In flight",
      value: formatMoney(totals.inPayout, totals.currency),
      sub: "attached to an open payout",
    },
    {
      label: "Paid to date",
      value: formatMoney(totals.paid, totals.currency),
    },
    {
      label: "Lifetime earned",
      value: formatMoney(totals.lifetime, totals.currency),
      sub: "net of clawbacks",
    },
  ];

  const partnerColumns: AdminColumn<PartnerRow>[] = [
    {
      header: "Partner",
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/admin/affiliates/${r.id}`}
            className="truncate font-medium text-brand-ink hover:text-brand-primary hover:underline"
          >
            {r.name}
          </Link>
          <div className="truncate font-mono text-[11px] text-brand-mute">
            /r/{r.slug}
          </div>
        </div>
      ),
    },
    {
      header: "Entries",
      align: "right",
      cell: (r) => <span className="num text-brand-mute">{r.entries}</span>,
    },
    {
      header: "On hold",
      align: "right",
      cell: (r) => (
        <span className="num text-brand-mute">
          {formatMoney(r.pending, r.currency)}
        </span>
      ),
    },
    {
      header: "Payable now",
      align: "right",
      cell: (r) => (
        <span
          className={`num font-semibold ${r.available > 0 ? "text-brand-primary" : "text-brand-mute"}`}
        >
          {formatMoney(r.available, r.currency)}
        </span>
      ),
    },
    {
      header: "Paid",
      align: "right",
      cell: (r) => (
        <span className="num text-brand-ink">
          {formatMoney(r.paid, r.currency)}
        </span>
      ),
    },
  ];

  const historyColumns: AdminColumn<PayoutRow>[] = [
    { header: "Partner", cell: (p) => <span>{p.name}</span> },
    {
      header: "Requested",
      cell: (p) => (
        <span className="text-brand-mute">{fmtDate(p.requestedAt)}</span>
      ),
    },
    {
      header: "Method",
      cell: (p) => <span className="capitalize">{p.method}</span>,
    },
    {
      header: "Net",
      align: "right",
      cell: (p) => (
        <span className="num font-medium">
          {formatMoney(p.net, p.currency)}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (p) => (
        <span
          className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-semibold capitalize ${
            STATUS_STYLE[p.status] ??
            "border-brand-line bg-brand-light text-brand-mute"
          }`}
        >
          {p.status}
        </span>
      ),
    },
    {
      header: "Reference",
      cell: (p) => (
        <span className="font-mono text-[11px] text-brand-mute">
          {p.reference ?? p.failureReason ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Campaign filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          Campaign
        </span>
        <Chip
          href="/admin/affiliates/payouts?campaign=all"
          active={selected === "all"}
        >
          All commission
        </Chip>
        {campaigns.map((c) => (
          <Chip
            key={c.id}
            href={`/admin/affiliates/payouts?campaign=${c.id}`}
            active={selected === c.id}
          >
            {c.name}
            {c.status !== "active" ? (
              <span className="ml-1 text-[10px] opacity-70">({c.status})</span>
            ) : null}
          </Chip>
        ))}
        <Chip
          href="/admin/affiliates/payouts?campaign=none"
          active={selected === "none"}
        >
          Outside any campaign
        </Chip>
      </div>

      <AdminStatBand stats={stats} cols={5} />

      {/* Open payout requests */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-ink">
              Payout requests to action
            </h2>
            <p className="text-[12.5px] text-brand-mute">
              A payout settles a partner&apos;s whole cleared balance, not one
              campaign&apos;s share — the amounts below may include commission
              earned outside the campaign you picked.
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
          <div className="rounded-card border border-brand-line bg-white p-8 text-center text-[13px] text-brand-mute shadow-card">
            No payouts awaiting action.
          </div>
        ) : (
          <div className="space-y-3">
            {openPayouts.map((p) => (
              <div
                key={p.id}
                className="rounded-card border border-brand-line bg-white p-4 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-brand-ink">{p.name}</span>
                  <span
                    className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                      STATUS_STYLE[p.status] ?? ""
                    }`}
                  >
                    {p.status}
                  </span>
                  <span className="text-[12.5px] capitalize text-brand-mute">
                    {p.method} · requested {fmtDate(p.requestedAt)}
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
                    className="w-56 rounded-[10px] border border-brand-line px-3 py-1.5 text-[13px] outline-none focus:border-brand-primary"
                  />
                  {p.status === "requested" ? (
                    <button
                      type="button"
                      onClick={() => settle(p.id, "approve")}
                      disabled={pending}
                      className="rounded-pill border border-brand-line px-4 py-1.5 text-[13px] font-medium text-brand-ink hover:bg-brand-light disabled:opacity-50"
                    >
                      Approve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => settle(p.id, "paid")}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-secondary disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Mark paid
                  </button>
                  <button
                    type="button"
                    onClick={() => settle(p.id, "reject")}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-brand-line px-4 py-1.5 text-[13px] font-medium text-status-cancelled hover:bg-brand-light disabled:opacity-50"
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
            ))}
          </div>
        )}
      </section>

      {/* Per-partner commission in the selected scope */}
      <section>
        <h2 className="mb-1 font-display text-lg font-semibold text-brand-ink">
          Commission by partner
        </h2>
        <p className="mb-3 text-[12.5px] text-brand-mute">
          {selected === "all"
            ? "Every commission entry on the platform."
            : selected === "none"
              ? "Commission earned outside any campaign."
              : "Commission earned in this campaign only."}
        </p>
        <AdminTable
          columns={partnerColumns}
          rows={partners}
          getKey={(r) => r.id}
          empty="No commission recorded for this selection yet."
        />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-ink">
          Payout history
        </h2>
        <AdminTable
          columns={historyColumns}
          rows={historyPayouts}
          getKey={(p) => p.id}
          empty="No settled payouts yet."
        />
      </section>
    </div>
  );
}

function Chip({
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
          ? "rounded-pill bg-brand-primary px-3 py-1.5 text-[12.5px] font-semibold text-white"
          : "rounded-pill border border-brand-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-mute hover:border-brand-primary/40"
      }
    >
      {children}
    </Link>
  );
}
