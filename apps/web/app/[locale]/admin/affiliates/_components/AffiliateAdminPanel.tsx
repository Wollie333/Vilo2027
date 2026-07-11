"use client";

import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

import {
  setAffiliateStatusAction,
  settleAffiliatePayoutAction,
} from "../actions";

type Affiliate = {
  id: string;
  userId: string;
  slug: string;
  status: "active" | "suspended";
  currency: string;
  name: string;
  email: string | null;
  referrals: number;
  lifetime: number;
  available: number;
  pending: number;
};
type Payout = {
  id: string;
  affiliateName: string;
  method: string;
  status: string;
  gross: number;
  fee: number;
  net: number;
  currency: string;
  requestedAt: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AffiliateAdminPanel({
  affiliates,
  payouts,
}: {
  affiliates: Affiliate[];
  payouts: Payout[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleStatus(a: Affiliate) {
    const next = a.status === "active" ? "suspended" : "active";
    const reason =
      next === "suspended"
        ? "Suspended from the admin affiliates panel."
        : "Reactivated from the admin affiliates panel.";
    startTransition(async () => {
      const res = await setAffiliateStatusAction({
        affiliateId: a.id,
        status: next,
        reason,
      });
      if (res.ok) {
        toast.success(
          next === "suspended"
            ? "Affiliate suspended."
            : "Affiliate reactivated.",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function settle(p: Payout, action: "approve" | "paid" | "reject") {
    startTransition(async () => {
      const res = await settleAffiliatePayoutAction({ payoutId: p.id, action });
      if (res.ok) {
        toast.success(
          action === "paid"
            ? "Payout marked as paid."
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
    <div className="space-y-8">
      {/* Payout queue */}
      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
          Payout queue
          {payouts.length > 0 ? (
            <span className="ml-2 rounded-pill bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {payouts.length} awaiting
            </span>
          ) : null}
        </h2>
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          {payouts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-brand-mute">
              No payouts awaiting action.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
                  <tr>
                    <th className="px-4 py-2.5">Affiliate</th>
                    <th className="px-4 py-2.5">Requested</th>
                    <th className="px-4 py-2.5">Method</th>
                    <th className="px-4 py-2.5 text-right">Gross</th>
                    <th className="px-4 py-2.5 text-right">Net</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-line">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F8FCF9]">
                      <td className="px-4 py-3 font-medium text-brand-ink">
                        {p.affiliateName}
                      </td>
                      <td className="px-4 py-3 text-brand-mute">
                        {fmtDate(p.requestedAt)}
                      </td>
                      <td className="px-4 py-3 capitalize text-brand-mute">
                        {p.method}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(p.gross, p.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatMoney(p.net, p.currency)}
                      </td>
                      <td className="px-4 py-3 capitalize text-brand-mute">
                        {p.status}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {p.status === "requested" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => settle(p, "approve")}
                            >
                              Approve
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() => settle(p, "paid")}
                          >
                            Mark paid
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => settle(p, "reject")}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Affiliate list */}
      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-brand-ink">
          All affiliates ({affiliates.length})
        </h2>
        <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
          {affiliates.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-brand-mute">
              No affiliates yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-brand-line text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8AA89C]">
                  <tr>
                    <th className="px-4 py-2.5">Affiliate</th>
                    <th className="px-4 py-2.5">Link</th>
                    <th className="px-4 py-2.5 text-right">Referrals</th>
                    <th className="px-4 py-2.5 text-right">Lifetime</th>
                    <th className="px-4 py-2.5 text-right">Available</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-line">
                  {affiliates.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F8FCF9]">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/affiliates/${a.id}`}
                          className="font-medium text-brand-ink hover:text-brand-primary"
                        >
                          {a.name}
                        </Link>
                        {a.email ? (
                          <div className="text-xs text-brand-mute">
                            {a.email}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-brand-mute">
                        /r/{a.slug}
                      </td>
                      <td className="px-4 py-3 text-right">{a.referrals}</td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(a.lifetime, a.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatMoney(a.available, a.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            a.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }
                        >
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={a.status === "active" ? "ghost" : "outline"}
                          disabled={pending}
                          onClick={() => toggleStatus(a)}
                        >
                          {a.status === "active" ? "Suspend" : "Reactivate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
