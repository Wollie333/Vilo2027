import type { Metadata } from "next";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  History,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import { getPlans } from "@/lib/plans/getPlans";
import { getSubscriptionProducts } from "@/lib/products/getProducts";
import { pickCurrentMembershipIndex } from "@/lib/subscriptions/currentMembership";
import { createServerClient } from "@/lib/supabase/server";

import { CancelButton } from "./CancelButton";
import { PlanPicker } from "./PlanPicker";
import { findPlan, formatZar, type PlanKey } from "./plans";

export const metadata: Metadata = {
  title: "Subscription · Settings",
};

export const dynamic = "force-dynamic";

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysBetween(now: Date, future: string | null): number | null {
  if (!future) return null;
  const ms = new Date(future).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const EVENT_LABEL: Record<string, string> = {
  created: "Subscription created",
  plan_change: "Plan switched",
  status_active: "Activated",
  status_trialing: "Trial started",
  status_cancelled: "Cancelled",
  status_expired: "Expired",
  status_past_due: "Payment past due",
  status_restricted: "Account restricted",
  cancel_scheduled: "Cancellation scheduled",
  cancel_reverted: "Cancellation reverted",
  billing_cycle_change: "Billing cycle changed",
};

function eventLabel(event: string): string {
  return EVENT_LABEL[event] ?? event.replace(/_/g, " ");
}

export default async function SettingsSubscriptionPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <EmptyState
        title="Sign in to manage your subscription"
        body="You need to be logged in to a host account to change your plan."
      />
    );
  }

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return (
      <EmptyState
        title="Create your host profile first"
        body="Finish host onboarding to unlock subscription management."
        ctaLabel="Finish onboarding"
        ctaHref="/signup/host"
      />
    );
  }

  const [
    { data: subRaw },
    { data: historyRaw },
    plans,
    products,
    { data: billingRaw },
    { data: wieloInvoices },
  ] = await Promise.all([
    // A host may hold 1 membership + N services; this page manages the MEMBERSHIP.
    // Fetch all rows (+ product_type) and pick the membership below.
    supabase
      .from("subscriptions")
      .select(
        "id, plan, product_id, billing_cycle, status, created_at, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, cancellation_reason, product:products ( product_type )",
      )
      .eq("host_id", host.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("subscription_history")
      .select(
        "id, event, from_plan, to_plan, from_status, to_status, notes, created_at",
      )
      .eq("host_id", host.id)
      .order("created_at", { ascending: false })
      .limit(10),
    getPlans(),
    getSubscriptionProducts(),
    // The host's own Wielo billing rows (own-row RLS). Shows what they've paid
    // Wielo for their subscription/services.
    supabase
      .from("platform_ledger")
      .select("id, type, status, amount, currency, reason, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    // Downloadable invoice per purchase (own-row RLS). Matched to a ledger row
    // by ledger_id so each billing line can link to its Wielo invoice PDF.
    supabase.from("wielo_invoices").select("ledger_id, hosted_token").limit(50),
  ]);

  const invoiceByLedger = new Map<string, string>();
  for (const inv of wieloInvoices ?? []) {
    if (inv.ledger_id && inv.hosted_token) {
      invoiceByLedger.set(inv.ledger_id, inv.hosted_token);
    }
  }

  type SubRow = {
    id: string;
    plan: PlanKey;
    product_id: string | null;
    billing_cycle: "monthly" | "annual" | null;
    status: string;
    created_at: string | null;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    product:
      | { product_type: string | null }
      | { product_type: string | null }[]
      | null;
  };
  const subRows = (subRaw as SubRow[] | null) ?? [];
  const pt = (r: SubRow): string | null => {
    const p = Array.isArray(r.product) ? r.product[0] : r.product;
    return p?.product_type ?? null;
  };
  // The MEMBERSHIP row this page manages — the host's CURRENT (live) membership,
  // preferring an active/trialing one over an older cancelled row; falls back to
  // the most recent membership, then any sub.
  const memIdx = pickCurrentMembershipIndex(subRows, (r) => ({
    status: r.status,
    productType: pt(r),
    createdAt: r.created_at,
  }));
  const sub: SubRow | null =
    memIdx >= 0 ? subRows[memIdx] : (subRows[0] ?? null);

  const currentPlan: PlanKey = sub?.plan ?? "free";
  const currentCycle: "monthly" | "annual" | null = sub?.billing_cycle ?? null;
  const planDef = findPlan(plans, currentPlan);
  // The product the host is on (the catalog they see). Falls back to the plan
  // tier's name for any legacy sub not yet linked to a product.
  const currentProduct = products.find((p) => p.id === sub?.product_id) ?? null;
  const currentName = currentProduct?.name ?? planDef?.name ?? "Free";
  const currentIsFree = currentProduct
    ? currentProduct.isFree
    : (planDef?.isFree ?? true);
  const now = new Date();
  const trialDaysLeft =
    sub?.status === "trialing" ? daysBetween(now, sub.trial_ends_at) : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
          Subscription
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Pick the plan that fits how you host. Switch any time — features
          re-evaluate immediately.
        </p>
      </header>

      {/* ─── Current plan card ───────────────────────────────────── */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Crown className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-display text-lg font-semibold text-brand-ink">
                {currentName}
              </div>
              <StatusPill status={sub?.status ?? "active"} />
              {sub?.cancel_at_period_end ? (
                <span className="inline-flex items-center gap-1 rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[11px] font-medium text-status-cancelled">
                  <AlertTriangle className="h-3 w-3" />
                  Cancels at period end
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-brand-mute">
              {currentProduct?.description ?? planDef?.tagline}
            </p>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Billing">
                {currentIsFree
                  ? "No charges"
                  : `${formatZar(currentProduct?.price ?? planDef?.monthly ?? 0)} / ${
                      (currentProduct?.billingCycle ?? currentCycle) ===
                      "annual"
                        ? "year"
                        : "month"
                    }`}
              </Detail>
              {sub?.status === "trialing" ? (
                <Detail label="Trial ends">
                  {formatDate(sub.trial_ends_at) ?? "—"}
                  {trialDaysLeft != null ? (
                    <span className="ml-1 text-brand-mute">
                      ({trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left)
                    </span>
                  ) : null}
                </Detail>
              ) : (
                <Detail label="Renews">
                  {formatDate(sub?.current_period_end) ??
                    (currentIsFree ? "Never (free)" : "—")}
                </Detail>
              )}
              <Detail label="Cycle">
                {currentIsFree
                  ? "—"
                  : (currentProduct?.billingCycle ?? currentCycle) === "annual"
                    ? "Annual"
                    : "Monthly"}
              </Detail>
            </dl>

            {sub?.cancel_at_period_end && sub.current_period_end ? (
              <div className="mt-4 flex items-start gap-2 rounded border border-status-cancelled/30 bg-status-cancelled/5 px-3 py-2.5 text-[13px] text-brand-dark">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-status-cancelled" />
                <div>
                  Your subscription is scheduled to cancel on{" "}
                  <span className="font-medium">
                    {formatDate(sub.current_period_end)}
                  </span>
                  . You&apos;ll keep all paid features until then.
                </div>
              </div>
            ) : null}

            {sub && !currentIsFree ? (
              <div className="mt-5">
                <CancelButton
                  status={sub.status}
                  scheduledForCancel={sub.cancel_at_period_end}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ─── Plan picker (the admin PRODUCTS catalog) ────────────── */}
      <PlanPicker
        products={products}
        currentProductId={sub?.product_id ?? null}
      />

      {/* ─── Audit feed ──────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-brand-mute" />
          <h2 className="font-display text-base font-bold text-brand-ink">
            Recent activity
          </h2>
        </div>
        <div className="rounded-card border border-brand-line bg-white shadow-card">
          {historyRaw && historyRaw.length > 0 ? (
            <ul className="divide-y divide-brand-line">
              {historyRaw.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-primary" />
                  <span className="font-medium text-brand-ink">
                    {eventLabel(row.event)}
                  </span>
                  {row.to_plan &&
                  row.from_plan &&
                  row.from_plan !== row.to_plan ? (
                    <span className="text-brand-mute">
                      {row.from_plan} → {row.to_plan}
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono text-xs text-brand-mute">
                    {new Intl.DateTimeFormat("en-ZA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(row.created_at))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-brand-mute">
              No subscription activity yet.
            </p>
          )}
        </div>
      </section>

      {/* ─── Wielo billing history ────────────────────────────────── */}
      {billingRaw && billingRaw.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-base font-bold text-brand-ink">
            Billing history
          </h2>
          <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <ul className="divide-y divide-brand-line">
              {billingRaw.map((b) => {
                const amt = Number(b.amount);
                const invoiceToken = invoiceByLedger.get(b.id);
                return (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm"
                  >
                    <span className="font-medium capitalize text-brand-ink">
                      {b.type}
                    </span>
                    <span className="text-brand-mute">
                      {b.reason ?? ""}
                      {b.status !== "completed" ? ` · ${b.status}` : ""}
                    </span>
                    <span
                      className={`num ml-auto font-mono ${
                        amt < 0 ? "text-status-cancelled" : "text-brand-ink"
                      }`}
                    >
                      {amt < 0 ? "−" : ""}
                      {formatZar(Math.abs(amt))}
                    </span>
                    <span className="font-mono text-[11px] text-brand-mute">
                      {new Date(b.created_at).toLocaleDateString("en-ZA")}
                    </span>
                    {invoiceToken ? (
                      <a
                        href={`/wielo-invoice/${invoiceToken}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-secondary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Invoice
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <p className="text-[12px] text-brand-mute">
        Need a custom arrangement? Email{" "}
        <a
          href="mailto:hello@wieloplatform.com"
          className="text-brand-primary underline-offset-2 hover:underline"
        >
          hello@wieloplatform.com
        </a>
        .
      </p>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-brand-ink">{children}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:
      "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
    trialing: "bg-brand-accent text-brand-primary border-brand-primary/20",
    past_due:
      "bg-status-pending/10 text-status-pending border-status-pending/30",
    restricted:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
    paused: "bg-status-pending/10 text-status-pending border-status-pending/30",
    cancelled: "bg-brand-light text-brand-mute border-brand-line",
    expired: "bg-brand-light text-brand-mute border-brand-line",
  };
  const cls = map[status] ?? map.active;
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function EmptyState({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="mx-auto max-w-md rounded-card border border-dashed border-brand-line bg-white p-8 text-center shadow-card">
      <h2 className="font-display text-lg font-bold text-brand-ink">{title}</h2>
      {body ? <p className="mt-2 text-sm text-brand-mute">{body}</p> : null}
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center justify-center rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
