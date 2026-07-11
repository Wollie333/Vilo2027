import { ArrowUpRight, Plus } from "lucide-react";

import { Link } from "@/i18n/navigation";
import {
  AdminTable,
  type AdminColumn,
} from "@/app/[locale]/admin/_components/AdminTable";
import { requirePermission } from "@/lib/admin";
import { formatMoney } from "@/lib/format";
import { getInternalCatalog } from "@/lib/products/getProducts";

import { SubsTabs } from "../_SubsTabs";

export const dynamic = "force-dynamic";

// Once-off products (product_type = 'product') from the REAL catalog. Editing is
// done in the canonical Products hub (/admin/products) — this tab is the
// subscription-console view of them, so the catalog has one source of truth.
export default async function AdminSubsProductsPage() {
  await requirePermission("subscriptions.edit");

  const catalog = await getInternalCatalog();
  const products = catalog.filter((p) => p.productType === "product");

  type Row = (typeof products)[number];
  const columns: AdminColumn<Row>[] = [
    {
      header: "Product",
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-brand-ink">{p.name}</div>
          {p.description ? (
            <div className="truncate text-[11px] text-brand-mute">
              {p.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Price",
      cell: (p) => (
        <span className="num font-medium text-brand-ink">
          {formatMoney(p.price, p.currency)}
        </span>
      ),
    },
    {
      header: "Setup fee",
      cell: (p) => (
        <span className="text-[12px] text-brand-mute">
          {p.setupFee > 0 ? formatMoney(p.setupFee, p.currency) : "—"}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (p) => (
        <Link
          href={`/admin/products/${p.id}`}
          className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
        >
          Edit <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Products
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Once-off products you sell. Managed in the Products hub.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          <Plus className="h-4 w-4" /> New product
        </Link>
      </header>

      <SubsTabs />

      <AdminTable
        columns={columns}
        rows={products}
        getKey={(p) => p.id}
        empty="No once-off products yet. Create one in the Products hub."
      />
    </div>
  );
}
