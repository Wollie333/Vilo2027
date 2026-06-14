import { requirePermission } from "@/lib/admin";
import { fetchViloLedger, viloLedgerStats } from "@/lib/billing/vilo-ledger";
import { getAllPlans } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";

import { SubsTabs } from "../_SubsTabs";
import { ManualEntryForm } from "./ManualEntryForm";

export const dynamic = "force-dynamic";

const TYPE_TONE: Record<string, string> = {
  charge:
    "bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30",
  refund:
    "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/30",
  credit: "bg-amber-100 text-amber-800 border-amber-300",
  adjustment: "bg-brand-light text-brand-mute border-brand-line",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminRevenuePage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const [rows, plans, { data: subs }] = await Promise.all([
    fetchViloLedger(service, { limit: 1000 }),
    getAllPlans(),
    service.from("subscriptions").select("plan, billing_cycle, status"),
  ]);

  const stats = viloLedgerStats(rows);

  // MRR from active, paying subscriptions × plan price (annual normalised /12).
  const priceMap = new Map(plans.map((p) => [p.key, p]));
  let mrr = 0;
  let payingHosts = 0;
  for (const s of subs ?? []) {
    if (s.status !== "active") continue;
    const pd = priceMap.get(s.plan as string);
    if (!pd || pd.isFree) continue;
    mrr += s.billing_cycle === "annual" ? pd.annual / 12 : pd.monthly;
    payingHosts += 1;
  }
  const arr = mrr * 12;

  const recent = rows.slice(0, 100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Vilo revenue ledger
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Every transaction between a user and Vilo — subscriptions, services,
          refunds and manual adjustments. (Booking money goes directly to hosts
          and is not shown here.)
        </p>
      </header>

      <SubsTabs />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="MRR" value={formatZar(Math.round(mrr))} />
        <Kpi label="ARR" value={formatZar(Math.round(arr))} />
        <Kpi label="Collected" value={formatZar(Math.round(stats.collected))} />
        <Kpi label="Refunded" value={formatZar(Math.round(stats.refunded))} />
        <Kpi label="Net to Vilo" value={formatZar(Math.round(stats.net))} />
        <Kpi label="Paying hosts" value={String(payingHosts)} />
      </section>

      {/* Manual entry */}
      <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-base font-bold text-brand-ink">
          Post a manual entry
        </h2>
        <p className="mb-4 mt-1 text-[13px] text-brand-mute">
          Record a goodwill credit, write-off, off-platform charge or correction
          against a host&apos;s Vilo account. Audited.
        </p>
        <ManualEntryForm />
      </section>

      {/* Ledger list */}
      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        {recent.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {recent.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
              >
                <span
                  className={`inline-flex w-20 justify-center rounded-pill border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    TYPE_TONE[t.type] ?? TYPE_TONE.adjustment
                  }`}
                >
                  {t.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-brand-ink">
                    {t.userName || t.userEmail || "—"}
                    {t.hostHandle ? (
                      <span className="ml-1.5 font-mono text-[11px] text-brand-mute">
                        @{t.hostHandle}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-[11px] text-brand-mute">
                    {fmtDate(t.date)}
                    {t.plan ? ` · ${t.plan}` : ""}
                    {t.billingCycle ? ` · ${t.billingCycle}` : ""}
                    {t.provider ? ` · ${t.provider}` : ""}
                    {t.status !== "completed" ? ` · ${t.status}` : ""}
                    {t.reason ? ` · ${t.reason}` : ""}
                  </div>
                </div>
                <div
                  className={`num shrink-0 font-mono text-sm font-semibold ${
                    t.amount < 0 ? "text-status-cancelled" : "text-brand-ink"
                  }`}
                >
                  {t.amount < 0 ? "−" : ""}
                  {formatZar(Math.abs(t.amount))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-brand-mute">
            No Vilo transactions yet. Subscription purchases will appear here
            once live billing is connected; you can also post manual entries
            above.
          </p>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-lg font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}
