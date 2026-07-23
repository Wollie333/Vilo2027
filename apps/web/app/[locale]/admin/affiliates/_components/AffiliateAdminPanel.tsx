"use client";

import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { formatMoney } from "@/lib/format";

import {
  activateAffiliateAction,
  setAffiliateStatusAction,
  settleAffiliatePayoutAction,
} from "../actions";

type Affiliate = {
  id: string;
  userId: string;
  slug: string;
  status: "pending" | "active" | "suspended";
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

function zar0(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

// Deterministic avatar colour (av-1…av-7) + initials from a display name.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avClass(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `av-${(h % 7) + 1}`;
}

const AFFILIATE_STATUS: Record<
  Affiliate["status"],
  { cls: string; label: string }
> = {
  active: { cls: "green", label: "Active" },
  pending: { cls: "amber", label: "Awaiting setup" },
  suspended: { cls: "red", label: "Suspended" },
};

function payoutTag(status: string): { cls: string; label: string } {
  switch (status) {
    case "approved":
      return { cls: "sky", label: "Approved" };
    case "processing":
      return { cls: "indigo", label: "Processing" };
    default:
      return { cls: "amber", label: "Requested" };
  }
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

  // Manual activation for a partner stuck in `pending` — typically because a
  // confirmation email never arrived. Deliberately separate from the
  // suspend/reactivate toggle: this one BYPASSES the self-serve gates, and the
  // action records which gates were unmet so the override is never invisible.
  function activate(a: Affiliate) {
    startTransition(async () => {
      const res = await activateAffiliateAction({
        affiliateId: a.id,
        reason: "Activated by hand from the admin affiliates panel.",
      });
      if (res.ok) {
        toast.success("Partner activated.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

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

  const activeCount = affiliates.filter((a) => a.status === "active").length;
  const pendingCount = affiliates.filter((a) => a.status === "pending").length;
  const totalReferrals = affiliates.reduce((s, a) => s + a.referrals, 0);
  const totalOwed = affiliates.reduce((s, a) => s + a.available, 0);
  const awaitingTotal = payouts.reduce((s, p) => s + p.net, 0);

  return (
    <div className="space-y-6">
      {/* SUMMARY BAND */}
      <section className="fade grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-4">
        <div className="bg-brand-secondary p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Partners
          </div>
          <div className="num mt-1.5 font-display text-[22px] font-bold leading-none text-white">
            {affiliates.length}
          </div>
          <div className="mt-1 text-[11px] text-brand-accent">
            {activeCount} active · {pendingCount} pending
          </div>
        </div>
        <div className="bg-[#FAFCFB] p-4">
          <div className="smallcaps">Referrals</div>
          <div className="num mt-1.5 font-display text-[20px] font-bold leading-none text-brand-ink">
            {totalReferrals}
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            Hosts brought in
          </div>
        </div>
        <div className="bg-[#FAFCFB] p-4">
          <div className="smallcaps">Awaiting payout</div>
          <div className="num mt-1.5 font-display text-[20px] font-bold leading-none text-brand-ink">
            {zar0(awaitingTotal)}
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            {payouts.length} in the queue
          </div>
        </div>
        <div className="bg-[#FAFCFB] p-4">
          <div className="smallcaps">Cleared &amp; owed</div>
          <div className="num mt-1.5 font-display text-[20px] font-bold leading-none text-brand-ink">
            {zar0(totalOwed)}
          </div>
          <div className="mt-1 text-[11px] text-brand-mute">
            Withdrawable by partners
          </div>
        </div>
      </section>

      {/* PAYOUT QUEUE */}
      <section className="am-card fade overflow-hidden">
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">Payout queue</div>
          {payouts.length > 0 ? (
            <span className="tag amber">
              <span className="d" />
              {payouts.length} awaiting
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Affiliate</th>
                <th>Requested</th>
                <th>Method</th>
                <th className="r">Gross</th>
                <th className="r">Fee</th>
                <th className="r">Net</th>
                <th>Status</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-brand-mute">
                    No payouts awaiting action.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => {
                  const tag = payoutTag(p.status);
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold text-brand-ink">
                        {p.affiliateName}
                      </td>
                      <td className="num text-brand-mute">
                        {fmtDate(p.requestedAt)}
                      </td>
                      <td className="uppercase text-brand-mute">{p.method}</td>
                      <td className="num r">
                        {formatMoney(p.gross, p.currency)}
                      </td>
                      <td className="num r text-brand-mute">
                        {formatMoney(p.fee, p.currency)}
                      </td>
                      <td className="num r font-semibold">
                        {formatMoney(p.net, p.currency)}
                      </td>
                      <td>
                        <span className={`tag ${tag.cls}`}>
                          <span className="d" />
                          {tag.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {p.status === "requested" ? (
                            <button
                              type="button"
                              className="btn-ghost h-8"
                              disabled={pending}
                              onClick={() => settle(p, "approve")}
                            >
                              Approve
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn-pri h-8"
                            disabled={pending}
                            onClick={() => settle(p, "paid")}
                          >
                            Mark paid
                          </button>
                          <button
                            type="button"
                            className="btn-danger h-8"
                            disabled={pending}
                            onClick={() => settle(p, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ALL PARTNERS */}
      <section className="am-card fade overflow-hidden">
        <div className="flex items-center justify-between border-b border-brand-line px-5 py-3.5">
          <div className="smallcaps">All partners</div>
          <span className="num text-[11.5px] text-brand-mute">
            {affiliates.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="ttable">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Link</th>
                <th className="r">Referrals</th>
                <th className="r">Lifetime</th>
                <th className="r">Available</th>
                <th>Status</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-brand-mute">
                    No affiliates yet.
                  </td>
                </tr>
              ) : (
                affiliates.map((a) => {
                  const st = AFFILIATE_STATUS[a.status];
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link
                          href={`/admin/affiliates/${a.id}`}
                          className="group flex items-center gap-3"
                        >
                          <span
                            className={`av ${avClass(a.id)} h-9 w-9 shrink-0 rounded-full text-[12px]`}
                          >
                            {initials(a.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] font-semibold text-brand-ink group-hover:text-brand-primary">
                              {a.name}
                            </span>
                            {a.email ? (
                              <span className="block truncate text-[11.5px] text-brand-mute">
                                {a.email}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </td>
                      <td className="mono text-[12px] text-brand-mute">
                        /r/{a.slug}
                      </td>
                      <td className="num r">{a.referrals}</td>
                      <td className="num r">
                        {formatMoney(a.lifetime, a.currency)}
                      </td>
                      <td className="num r font-semibold">
                        {formatMoney(a.available, a.currency)}
                      </td>
                      <td>
                        <span className={`tag ${st.cls}`}>
                          <span className="d" />
                          {st.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {a.status === "pending" ? (
                            <button
                              type="button"
                              className="btn-pri h-8"
                              disabled={pending}
                              onClick={() => activate(a)}
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={
                                a.status === "active"
                                  ? "btn-ghost h-8"
                                  : "btn-sec h-8"
                              }
                              disabled={pending}
                              onClick={() => toggleStatus(a)}
                            >
                              {a.status === "active" ? "Suspend" : "Reactivate"}
                            </button>
                          )}
                        </div>
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
