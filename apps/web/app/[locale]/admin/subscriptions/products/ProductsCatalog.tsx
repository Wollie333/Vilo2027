"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";

// All products in one place, with an instant per-category filter (Plans /
// Services / Products). Editing links to the canonical Products hub.
export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingCycle: string | null;
  productType: string; // membership | service | product
  setupFee: number;
};

const CATS = [
  { key: "all", label: "All" },
  { key: "membership", label: "Plans" },
  { key: "service", label: "Services" },
  { key: "product", label: "Products" },
] as const;

const TYPE_TAG: Record<string, { label: string; cls: string }> = {
  membership: {
    label: "Plan",
    cls: "border-violet-200 bg-violet-50 text-violet-700",
  },
  service: { label: "Service", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  product: {
    label: "Product",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

export function ProductsCatalog({ products }: { products: CatalogItem[] }) {
  const [cat, setCat] = useState<string>("all");
  const countFor = (k: string) =>
    k === "all"
      ? products.length
      : products.filter((p) => p.productType === k).length;
  const rows =
    cat === "all" ? products : products.filter((p) => p.productType === cat);

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => {
          const active = cat === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                active
                  ? "bg-brand-primary text-white shadow-sm"
                  : "border border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
              }`}
            >
              {c.label}
              <span
                className={`num rounded-pill px-1.5 text-[11px] ${
                  active ? "bg-white/20" : "bg-brand-light text-brand-mute"
                }`}
              >
                {countFor(c.key)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-line bg-brand-light/50 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Setup fee</th>
              <th className="px-4 py-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-mute"
                >
                  No products in this category yet.
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const tag = TYPE_TAG[p.productType] ?? {
                  label: p.productType,
                  cls: "border-brand-line bg-brand-light text-brand-mute",
                };
                return (
                  <tr
                    key={p.id}
                    className="border-b border-brand-line last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-brand-ink">
                          {p.name}
                        </div>
                        {p.description ? (
                          <div className="truncate text-[11px] text-brand-mute">
                            {p.description}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium ${tag.cls}`}
                      >
                        {tag.label}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 font-medium text-brand-ink">
                      {formatMoney(p.price, p.currency)}
                      {p.productType !== "product" && p.billingCycle ? (
                        <span className="text-[11px] text-brand-mute">
                          {" "}
                          / {p.billingCycle}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-brand-mute">
                      {p.setupFee > 0
                        ? formatMoney(p.setupFee, p.currency)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="inline-flex items-center gap-1 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-light"
                      >
                        Edit <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
