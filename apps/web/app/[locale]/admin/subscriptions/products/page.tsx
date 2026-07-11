import { Plus } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { getInternalCatalog } from "@/lib/products/getProducts";

import { SubsTabs } from "../_SubsTabs";
import { ProductsCatalog, type CatalogItem } from "./ProductsCatalog";

export const dynamic = "force-dynamic";

// The full product catalog (memberships/plans + services + once-off products)
// from the REAL products table, in one tab with a live per-category filter.
// Editing is done in the canonical Products hub (/admin/products).
export default async function AdminSubsProductsPage() {
  await requirePermission("subscriptions.edit");

  const catalog = await getInternalCatalog();
  const products: CatalogItem[] = catalog.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    billingCycle: p.billingCycle,
    productType: p.productType,
    setupFee: p.setupFee,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            Products
          </h1>
          <p className="mt-1 text-[13px] text-brand-mute">
            Everything you sell — plans, services and once-off products. Filter
            by category; edit in the Products hub.
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

      <ProductsCatalog products={products} />
    </div>
  );
}
