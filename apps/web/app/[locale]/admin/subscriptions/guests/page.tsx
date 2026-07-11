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

const PAGE_SIZE = 50;

// Guests = people who bought a Wielo product (product_orders) — the buyer side of
// the guest-first commerce model. A buyer may later be provisioned as a host.
export default async function AdminSubsGuestsPage() {
  await requirePermission("subscriptions.edit");
  const service = createAdminClient();

  const { data: orders } = await service
    .from("product_orders")
    .select(
      "id, product_name, payer_email, payer_user_id, amount, currency, status, method, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const list = orders ?? [];
  const buyerIds = [
    ...new Set(list.map((o) => o.payer_user_id).filter(Boolean)),
  ] as string[];
  const { data: profiles } = buyerIds.length
    ? await service
        .from("user_profiles")
        .select("id, full_name")
        .in("id", buyerIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  type Row = (typeof list)[number];
  const columns: AdminColumn<Row>[] = [
    {
      header: "Guest",
      cell: (o) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">
            {(o.payer_user_id ? nameById.get(o.payer_user_id) : null) ||
              o.payer_email ||
              "—"}
          </div>
          {o.payer_email ? (
            <div className="truncate text-[11px] text-brand-mute">
              {o.payer_email}
            </div>
          ) : null}
        </div>
      ),
    },
    { header: "Product", cell: (o) => o.product_name ?? "—" },
    {
      header: "Amount",
      cell: (o) => (
        <span className="num font-medium text-brand-ink">
          {formatMoney(Number(o.amount ?? 0), o.currency ?? "ZAR")}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (o) => (
        <span className="inline-flex items-center rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium capitalize text-brand-mute">
          {o.status}
        </span>
      ),
    },
    {
      header: "Date",
      cell: (o) => (
        <span className="text-[12px] text-brand-mute">
          {new Date(o.created_at).toLocaleDateString("en-ZA")}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (o) =>
        o.payer_user_id ? (
          <Link
            href={`/admin/users/${o.payer_user_id}`}
            className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
          >
            Open <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          Guests
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          People who bought a Wielo product. Buyers can be provisioned as hosts.
        </p>
      </header>

      <SubsTabs />

      <AdminTable
        columns={columns}
        rows={list}
        getKey={(o) => o.id}
        empty="No product purchases yet."
      />
    </div>
  );
}
