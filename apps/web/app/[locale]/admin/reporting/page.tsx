import { requirePermission } from "@/lib/admin";
import { fetchViloLedger, viloLedgerStats } from "@/lib/billing/vilo-ledger";
import { getAllPlans } from "@/lib/plans/getPlans";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";

export const dynamic = "force-dynamic";

const REVENUE_BOOKING_STATUSES = ["confirmed", "checked_in", "completed"];

export default async function AdminReportingPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    plans,
    { data: subs },
    viloRows,
    { data: profiles },
    { data: bookingRows },
  ] = await Promise.all([
    getAllPlans(),
    service.from("subscriptions").select("plan, billing_cycle, status"),
    fetchViloLedger(service, { limit: 5000 }),
    service
      .from("user_profiles")
      .select("role, created_at")
      .is("deleted_at", null),
    service
      .from("bookings")
      .select("total_amount, status")
      .in("status", REVENUE_BOOKING_STATUSES),
  ]);

  // ── Revenue (Vilo's own) ──
  const priceMap = new Map(plans.map((p) => [p.key, p]));
  let mrr = 0;
  let payingHosts = 0;
  let trials = 0;
  let churned = 0;
  const planDist: Record<string, number> = {};
  for (const p of plans) planDist[p.key] = 0;
  for (const s of subs ?? []) {
    if (s.plan) planDist[s.plan] = (planDist[s.plan] ?? 0) + 1;
    if (s.status === "trialing") trials += 1;
    if (s.status === "cancelled" || s.status === "expired") churned += 1;
    if (s.status === "active") {
      const pd = priceMap.get(s.plan as string);
      if (pd && !pd.isFree) {
        mrr += s.billing_cycle === "annual" ? pd.annual / 12 : pd.monthly;
        payingHosts += 1;
      }
    }
  }
  const arr = mrr * 12;
  const stats = viloLedgerStats(viloRows);

  // ── Growth (users) ──
  let totalUsers = 0;
  let hosts = 0;
  let guests = 0;
  let newUsers30 = 0;
  for (const u of profiles ?? []) {
    totalUsers += 1;
    if (u.role === "host") hosts += 1;
    else if (u.role === "guest") guests += 1;
    if (u.created_at && u.created_at >= since30) newUsers30 += 1;
  }

  // ── Operations (booking volume processed through the platform) ──
  const gmv = (bookingRows ?? []).reduce(
    (s, b) => s + Number(b.total_amount ?? 0),
    0,
  );
  const bookingCount = bookingRows?.length ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Business reporting
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Vilo as a business — recurring revenue, growth, and platform volume.
        </p>
      </header>

      <Group title="Revenue (Vilo's own)">
        <Kpi label="MRR" value={formatZar(Math.round(mrr))} />
        <Kpi label="ARR" value={formatZar(Math.round(arr))} />
        <Kpi
          label="Collected (all-time)"
          value={formatZar(Math.round(stats.collected))}
        />
        <Kpi label="Paying hosts" value={payingHosts} />
        <Kpi label="On trial" value={trials} />
        <Kpi label="Churned" value={churned} />
      </Group>

      <Group title="Growth (users)">
        <Kpi label="Total users" value={totalUsers} />
        <Kpi label="Hosts" value={hosts} />
        <Kpi label="Guests" value={guests} />
        <Kpi label="New (30 days)" value={newUsers30} />
      </Group>

      <Group title="Platform volume">
        <Kpi label="GMV processed" value={formatZar(Math.round(gmv))} />
        <Kpi label="Revenue bookings" value={bookingCount} />
        <span className="col-span-full text-[11px] text-brand-mute">
          GMV = booking value flowing host↔guest
          (confirmed/checked-in/completed). Vilo never holds this — it&apos;s a
          platform-scale metric, not Vilo income.
        </span>
      </Group>

      <section>
        <h2 className="mb-3 font-display text-base font-bold text-brand-ink">
          Plan distribution
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <Kpi key={p.key} label={p.name} value={planDist[p.key] ?? 0} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-bold text-brand-ink">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {children}
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
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
