import { Plus } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";
import { createAdminClient } from "@/lib/supabase/admin";

import { SubsTabs } from "../_SubsTabs";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data: services } = await service
    .from("platform_services")
    .select(
      "id, name, description, billing_type, price, currency, billing_cycle, is_active, sort_order",
    )
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Paid services
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Wielo&apos;s own paid add-ons sold to hosts (e.g. premium support,
            priority placement). Purchases land in the Wielo revenue ledger.
          </p>
        </div>
        <Link
          href="/admin/subscriptions/services/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-primary px-4 text-[13px] font-semibold text-white hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" /> New service
        </Link>
      </header>

      <SubsTabs />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(services ?? []).map((s) => (
          <Link
            key={s.id}
            href={`/admin/subscriptions/services/${s.id}`}
            className="flex flex-col rounded-card border border-brand-line bg-white p-5 shadow-card transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-base font-semibold text-brand-ink">
                {s.name}
              </div>
              {!s.is_active ? (
                <span className="inline-flex items-center rounded-pill border border-status-cancelled/30 bg-status-cancelled/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-status-cancelled">
                  Hidden
                </span>
              ) : null}
            </div>
            {s.description ? (
              <p className="mt-2 line-clamp-2 text-[12.5px] text-brand-mute">
                {s.description}
              </p>
            ) : null}
            <div className="mt-3 font-display text-lg font-bold text-brand-ink">
              {formatZar(Number(s.price))}
              <span className="ml-1.5 text-[11px] font-medium text-brand-mute">
                {s.billing_type === "recurring"
                  ? `/ ${s.billing_cycle === "annual" ? "yr" : "mo"}`
                  : "one-time"}
              </span>
            </div>
          </Link>
        ))}
        {(services ?? []).length === 0 ? (
          <div className="col-span-full rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center text-sm text-brand-mute">
            No services yet. Create one to start selling Wielo add-ons to hosts.
          </div>
        ) : null}
      </div>
    </div>
  );
}
