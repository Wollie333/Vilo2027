import { Plus } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { getAllPlans } from "@/lib/plans/getPlans";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";

import { SubsTabs } from "../_SubsTabs";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  await requirePermission("subscriptions.edit");
  const plans = await getAllPlans();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Plans &amp; pricing
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Name plans, set monthly/annual prices, trial length and what they
            unlock. Changes apply everywhere immediately — no redeploy.
          </p>
        </div>
        <Link
          href="/admin/subscriptions/plans/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" /> New plan
        </Link>
      </header>

      <SubsTabs />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <Link
            key={p.key}
            href={`/admin/subscriptions/plans/${p.key}`}
            className={`flex flex-col rounded-card border bg-white p-5 shadow-card transition-shadow hover:shadow-md ${
              p.recommended
                ? "border-brand-primary ring-1 ring-brand-primary/30"
                : "border-brand-line"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-base font-semibold text-brand-ink">
                {p.name}
              </div>
              <div className="flex items-center gap-1.5">
                {p.isFree ? <Badge tone="muted">Free</Badge> : null}
                {p.recommended ? <Badge tone="primary">Popular</Badge> : null}
                {!p.isActive ? <Badge tone="off">Hidden</Badge> : null}
              </div>
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-brand-mute">
              {p.key}
            </div>
            <p className="mt-2 text-[12.5px] text-brand-mute">{p.tagline}</p>
            <div className="mt-3 font-display text-lg font-bold text-brand-ink">
              {p.isFree ? "Free" : `${formatZar(p.monthly)} / mo`}
              {!p.isFree ? (
                <span className="ml-1.5 text-[11px] font-medium text-brand-mute">
                  · {formatZar(p.annual)} / yr
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-[11px] text-brand-mute">
              {p.trialDays > 0 ? `${p.trialDays}-day trial` : "No trial"} ·{" "}
              {p.bullets.length} selling point
              {p.bullets.length === 1 ? "" : "s"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "muted" | "off";
}) {
  const cls =
    tone === "primary"
      ? "bg-brand-accent text-brand-primary border-brand-primary/20"
      : tone === "off"
        ? "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30"
        : "bg-brand-light text-brand-mute border-brand-line";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}
