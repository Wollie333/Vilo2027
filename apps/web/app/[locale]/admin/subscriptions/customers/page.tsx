import { ArrowUpRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import {
  AdminTable,
  type AdminColumn,
} from "@/app/[locale]/admin/_components/AdminTable";
import { requirePermission } from "@/lib/admin";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

import { SubsTabs } from "../_SubsTabs";

export const dynamic = "force-dynamic";

// Customers = everyone who has bought ANYTHING from Wielo (a subscription, a
// service, or a once-off product). Every purchase posts a completed 'charge' to
// the platform ledger, so aggregating those by payer gives the full customer
// list with what they've spent — regardless of how they paid or what they bought.
export default async function AdminCustomersPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data: charges } = await service
    .from("platform_ledger")
    .select("user_id, amount, currency, created_at")
    .eq("type", "charge")
    .eq("status", "completed")
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  // Aggregate per customer.
  type Cust = {
    userId: string;
    purchases: number;
    total: number;
    currency: string;
    lastAt: string;
    name: string | null;
    email: string | null;
  };
  const byUser = new Map<string, Cust>();
  for (const c of charges ?? []) {
    const uid = c.user_id as string;
    const cur = byUser.get(uid);
    if (cur) {
      cur.purchases += 1;
      cur.total += Number(c.amount ?? 0);
      if (c.created_at > cur.lastAt) cur.lastAt = c.created_at;
    } else {
      byUser.set(uid, {
        userId: uid,
        purchases: 1,
        total: Number(c.amount ?? 0),
        currency: c.currency ?? "ZAR",
        lastAt: c.created_at,
        name: null,
        email: null,
      });
    }
  }

  const ids = [...byUser.keys()];
  if (ids.length) {
    const { data: profiles } = await service
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", ids);
    for (const p of profiles ?? []) {
      const c = byUser.get(p.id);
      if (c) {
        c.name = p.full_name;
        c.email = p.email;
      }
    }
  }

  const list = [...byUser.values()].sort((a, b) => b.total - a.total);

  const columns: AdminColumn<Cust>[] = [
    {
      header: "Customer",
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">
            {c.name || c.email || "—"}
          </div>
          {c.email ? (
            <div className="truncate text-[11px] text-brand-mute">
              {c.email}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Purchases",
      cell: (c) => <span className="num text-brand-ink">{c.purchases}</span>,
    },
    {
      header: "Total spent",
      cell: (c) => (
        <span className="num font-medium text-brand-ink">
          {formatMoney(c.total, c.currency)}
        </span>
      ),
    },
    {
      header: "Last purchase",
      cell: (c) => (
        <span className="text-[12px] text-brand-mute">
          {new Date(c.lastAt).toLocaleDateString("en-ZA")}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (c) => (
        <Link
          href={`/admin/users/${c.userId}`}
          className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
        >
          Open <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Customers
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Everyone who has bought anything from Wielo — subscriptions, services
          or products — with what they&apos;ve spent.
        </p>
      </header>

      <SubsTabs />

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(c) => c.userId}
        empty="No customers yet."
      />
    </div>
  );
}
