"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

import { deletePromo, togglePromoActive } from "./actions";

export type PromoRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  productName: string | null;
  productType: string | null;
  currency: string;
  minSpend: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  perUserLimit: number | null;
  redeemedCount: number;
  totalDiscounted: number;
  isActive: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  membership: "Memberships",
  service: "Services",
  product: "Once-off products",
  wielo_credits: "Credit packages",
};

type Status = { label: string; cls: string };

// The code's REAL state, not just its is_active flag — a code can be on and
// still unusable (scheduled, expired, used up), and an admin needs to see which.
function statusOf(r: PromoRow): Status {
  const now = new Date().toISOString();
  if (!r.isActive) {
    return { label: "Off", cls: "bg-brand-line/60 text-brand-mute" };
  }
  if (r.startsAt && now < r.startsAt) {
    return {
      label: "Scheduled",
      cls: "bg-status-pending/10 text-status-pending",
    };
  }
  if (r.endsAt && now > r.endsAt) {
    return { label: "Expired", cls: "bg-brand-line/60 text-brand-mute" };
  }
  if (r.maxRedemptions != null && r.redeemedCount >= r.maxRedemptions) {
    return { label: "Used up", cls: "bg-brand-line/60 text-brand-mute" };
  }
  return {
    label: "Active",
    cls: "bg-status-confirmed/10 text-status-confirmed",
  };
}

export function PromoCodesManager({ rows }: { rows: PromoRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle(r: PromoRow) {
    start(async () => {
      const res = await togglePromoActive({ id: r.id, isActive: !r.isActive });
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(r: PromoRow) {
    if (!confirm(`Delete ${r.code}? This can't be undone.`)) return;
    start(async () => {
      const res = await deletePromo({ id: r.id });
      if (res.ok) {
        toast.success(`${r.code} deleted.`);
        router.refresh();
      } else {
        // Redeemed codes are protected server-side — surface why.
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-brand-line bg-brand-light/40 text-left text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Applies to</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3 text-right">Redeemed</th>
              <th className="px-4 py-3 text-right">Discounted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {rows.map((r) => {
              const s = statusOf(r);
              return (
                <tr key={r.id} className="hover:bg-brand-light/30">
                  <td className="px-4 py-3">
                    <div className="font-mono text-[13px] font-semibold uppercase tracking-wide text-brand-ink">
                      {r.code}
                    </div>
                    {r.description ? (
                      <div className="mt-0.5 max-w-[220px] truncate text-[11px] text-brand-mute">
                        {r.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-ink">
                    {r.discountType === "percent"
                      ? `${r.discountValue}%`
                      : formatMoney(r.discountValue, r.currency)}
                    {r.minSpend ? (
                      <div className="text-[11px] font-normal text-brand-mute">
                        min {formatMoney(r.minSpend, r.currency)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-brand-mute">
                    {r.productName ??
                      (r.productType
                        ? (TYPE_LABEL[r.productType] ?? r.productType)
                        : "Every product")}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-brand-mute">
                    {r.startsAt || r.endsAt
                      ? `${r.startsAt?.slice(0, 10) ?? "—"} → ${
                          r.endsAt?.slice(0, 10) ?? "—"
                        }`
                      : "Always"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-ink">
                    {r.redeemedCount}
                    {r.maxRedemptions != null ? (
                      <span className="text-brand-mute">
                        /{r.maxRedemptions}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-ink">
                    {r.totalDiscounted > 0
                      ? formatMoney(r.totalDiscounted, r.currency)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-pill px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => toggle(r)}
                        disabled={pending}
                        className="rounded-pill border border-brand-line px-2.5 py-1 text-[11px] font-medium text-brand-mute transition hover:text-brand-ink disabled:opacity-50"
                      >
                        {r.isActive ? "Turn off" : "Turn on"}
                      </button>
                      <Link
                        href={`/admin/promo-codes/${r.id}/edit`}
                        aria-label={`Edit ${r.code}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        disabled={pending}
                        aria-label={`Delete ${r.code}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-mute transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
