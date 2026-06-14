import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Hourglass, RotateCcw, Wallet } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { throwOnError } from "@/lib/supabase/query";
import { createServerClient } from "@/lib/supabase/server";

import { RefundActions } from "./RefundActions";

export const metadata: Metadata = {
  title: "Refunds",
};

export const dynamic = "force-dynamic";

type Tab = "pending" | "approved" | "declined" | "all";

type SearchParams = {
  tab?: string;
};

const TAB_FILTERS: Record<Tab, string[] | null> = {
  pending: ["pending"],
  approved: ["approved", "processing", "completed"],
  declined: ["declined", "failed", "cancelled"],
  all: null,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  processing: "Processing",
  completed: "Completed",
  declined: "Declined",
  failed: "Failed",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

const REFUND_METHOD_LABELS: Record<string, string> = {
  paystack: "Paystack (card)",
  paypal: "PayPal",
  eft: "EFT / bank transfer",
  manual: "Manual / other",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-status-pending/10 text-status-pending border-status-pending/30",
  approved:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  processing: "bg-brand-accent text-brand-primary border-brand-primary/20",
  completed:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  declined:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  failed:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  cancelled: "bg-brand-light text-brand-mute border-brand-line",
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function RefundsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const tabParam = (searchParams?.tab ?? "pending").trim();
  const tab: Tab = (
    ["pending", "approved", "declined", "all"].includes(tabParam)
      ? tabParam
      : "pending"
  ) as Tab;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <EmptyShell title="Sign in to manage refunds" />;

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!host)
    return (
      <EmptyShell
        title="No host profile"
        body="Finish onboarding to start managing refunds."
      />
    );

  const baseQuery = () =>
    supabase
      .from("refund_requests")
      .select("id", { count: "exact", head: true })
      .eq("host_id", host.id);

  const [
    { count: pendingCount },
    { count: approvedCount },
    { count: declinedCount },
    { count: allCount },
  ] = await Promise.all([
    baseQuery().in("status", TAB_FILTERS.pending!),
    baseQuery().in("status", TAB_FILTERS.approved!),
    baseQuery().in("status", TAB_FILTERS.declined!),
    baseQuery(),
  ]);

  let feedQuery = supabase
    .from("refund_requests")
    .select(
      `
      id, status, requested_amount, approved_amount, currency, reason,
      reason_detail, host_note, decline_reason, created_at, actioned_at,
      initiated_by, is_manual, policy_entitlement, refund_method,
      booking:bookings ( id, reference, check_in, check_out, listing:listings ( name ) ),
      guest:user_profiles!refund_requests_guest_id_fkey ( full_name, email ),
      payment:payments!refund_requests_payment_id_fkey ( method )
    `,
    )
    .eq("host_id", host.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (TAB_FILTERS[tab]) {
    feedQuery = feedQuery.in("status", TAB_FILTERS[tab]!);
  }

  const rows = await throwOnError(feedQuery, "dashboard/refunds");

  type Row = {
    id: string;
    status: string;
    requested_amount: number;
    approved_amount: number | null;
    currency: string;
    reason: string;
    reason_detail: string | null;
    host_note: string | null;
    decline_reason: string | null;
    created_at: string;
    actioned_at: string | null;
    initiated_by: string;
    is_manual: boolean;
    policy_entitlement: number | null;
    refund_method: string | null;
    payment: { method: string | null } | { method: string | null }[] | null;
    booking:
      | {
          id: string;
          reference: string;
          check_in: string | null;
          check_out: string | null;
          listing: { name: string } | { name: string }[] | null;
        }
      | {
          id: string;
          reference: string;
          check_in: string | null;
          check_out: string | null;
          listing: { name: string } | { name: string }[] | null;
        }[]
      | null;
    guest:
      | { full_name: string | null; email: string | null }
      | { full_name: string | null; email: string | null }[]
      | null;
  };

  const list = (rows as Row[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
            Refunds
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Approve, decline, and track refunds across all your bookings.
          </p>
        </div>
        <div className="text-[12px] text-brand-mute">
          <span className="num font-semibold text-brand-ink">
            {pendingCount ?? 0}
          </span>{" "}
          awaiting decision
        </div>
      </header>

      {/* KPI tiles */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi
          icon={Hourglass}
          label="Pending"
          value={pendingCount ?? 0}
          tone="pending"
        />
        <Kpi
          icon={Wallet}
          label="Refunded"
          value={approvedCount ?? 0}
          tone="confirmed"
        />
        <Kpi
          icon={RotateCcw}
          label="Declined"
          value={declinedCount ?? 0}
          tone="cancelled"
        />
      </section>

      {/* Tabs */}
      <section className="flex flex-wrap items-center gap-2">
        <TabLink tab="pending" current={tab} count={pendingCount ?? 0}>
          Pending
        </TabLink>
        <TabLink tab="approved" current={tab} count={approvedCount ?? 0}>
          Approved
        </TabLink>
        <TabLink tab="declined" current={tab} count={declinedCount ?? 0}>
          Declined
        </TabLink>
        <TabLink tab="all" current={tab} count={allCount ?? 0}>
          All
        </TabLink>
      </section>

      {/* Feed */}
      <section className="space-y-3">
        {list.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <RotateCcw className="h-5 w-5" />
            </div>
            <p className="font-display text-base font-bold text-brand-ink">
              {tab === "pending"
                ? "Nothing waiting on you"
                : "No refunds match this filter"}
            </p>
            <p className="mt-1 text-sm text-brand-mute">
              {tab === "pending"
                ? "Refund requests from guests will land here for your decision."
                : "Try a different tab."}
            </p>
          </div>
        ) : (
          list.map((row) => {
            const booking = Array.isArray(row.booking)
              ? row.booking[0]
              : row.booking;
            const guest = Array.isArray(row.guest) ? row.guest[0] : row.guest;
            const payment = Array.isArray(row.payment)
              ? row.payment[0]
              : row.payment;
            const defaultMethod = (
              ["paystack", "paypal", "eft", "manual"].includes(
                payment?.method ?? "",
              )
                ? payment!.method
                : "eft"
            ) as "paystack" | "paypal" | "eft" | "manual";
            const listing = booking
              ? Array.isArray(booking.listing)
                ? booking.listing[0]
                : booking.listing
              : null;
            const isPending = row.status === "pending";
            return (
              <article
                key={row.id}
                className="rounded-card border border-brand-line bg-white p-5 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[row.status] ?? STATUS_STYLES.pending
                        }`}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                      <span className="text-[12px] text-brand-mute">
                        {row.initiated_by === "host"
                          ? "Host-initiated"
                          : row.initiated_by === "admin"
                            ? "Admin-initiated"
                            : "Guest request"}
                      </span>
                      <span className="text-[12px] text-brand-mute">
                        · {fmtDate(row.created_at)}
                      </span>
                    </div>
                    <div className="mt-2 font-display text-base font-semibold text-brand-ink">
                      {listing?.name ?? "Listing"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[12px] text-brand-mute">
                      <span className="font-mono">{booking?.reference}</span>
                      {guest?.full_name ? (
                        <>
                          <span>·</span>
                          <span>{guest.full_name}</span>
                        </>
                      ) : null}
                      {booking?.id ? (
                        <Link
                          href={`/dashboard/bookings/${booking.id}`}
                          className="ml-1 inline-flex items-center gap-0.5 font-medium text-brand-primary hover:underline"
                        >
                          View booking
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="font-display text-xl font-bold text-brand-ink">
                      {formatMoney(
                        Number(row.approved_amount ?? row.requested_amount),
                        row.currency,
                      )}
                    </div>
                    {row.approved_amount != null &&
                    Number(row.approved_amount) <
                      Number(row.requested_amount) ? (
                      <div className="text-[11px] text-brand-mute">
                        of{" "}
                        {formatMoney(
                          Number(row.requested_amount),
                          row.currency,
                        )}{" "}
                        requested
                      </div>
                    ) : null}
                    {row.policy_entitlement != null ? (
                      <div className="text-[11px] text-brand-mute">
                        Policy says{" "}
                        {formatMoney(
                          Number(row.policy_entitlement),
                          row.currency,
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 rounded border border-brand-line bg-brand-light/40 p-3 text-sm text-brand-dark">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                    Reason
                  </div>
                  <div className="mt-1 font-medium">{row.reason}</div>
                  {row.reason_detail ? (
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-brand-mute">
                      {row.reason_detail}
                    </p>
                  ) : null}
                </div>

                {row.refund_method ? (
                  <div className="mt-3 text-[12px] text-brand-mute">
                    Refunded via{" "}
                    <span className="font-medium text-brand-ink">
                      {REFUND_METHOD_LABELS[row.refund_method] ??
                        row.refund_method}
                    </span>
                  </div>
                ) : null}

                {row.host_note ? (
                  <div className="mt-3 text-sm text-brand-dark">
                    <span className="text-brand-mute">Your note:</span>{" "}
                    {row.host_note}
                  </div>
                ) : null}

                {isPending ? (
                  <div className="mt-4">
                    <RefundActions
                      refundId={row.id}
                      requestedAmount={Number(row.requested_amount)}
                      currency={row.currency}
                      defaultMethod={defaultMethod}
                    />
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function TabLink({
  tab,
  current,
  count,
  children,
}: {
  tab: Tab;
  current: Tab;
  count: number;
  children: React.ReactNode;
}) {
  const active = tab === current;
  return (
    <Link
      href={
        tab === "pending"
          ? "/dashboard/refunds"
          : `/dashboard/refunds?tab=${tab}`
      }
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-brand-primary text-white shadow-sm"
          : "border border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
      }`}
    >
      {children}
      <span
        className={`num rounded-pill px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? "bg-white/25 text-white" : "bg-brand-light text-brand-mute"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Hourglass;
  label: string;
  value: number;
  tone: "pending" | "confirmed" | "cancelled";
}) {
  const toneStyles =
    tone === "pending"
      ? "text-status-pending bg-status-pending/10"
      : tone === "confirmed"
        ? "text-status-confirmed bg-status-confirmed/10"
        : "text-status-cancelled bg-status-cancelled/10";
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-card ${toneStyles}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
            {label}
          </div>
          <div className="num font-display text-xl font-bold text-brand-ink">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyShell({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-md rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <RotateCcw className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-bold text-brand-ink">{title}</h1>
      {body ? <p className="mt-2 text-sm text-brand-mute">{body}</p> : null}
    </div>
  );
}
