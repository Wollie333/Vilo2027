import type { Metadata } from "next";

import { commissionLabel } from "@/lib/affiliate/commission";
import { getAffiliateForUser } from "@/lib/affiliate/account";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { ProductLinkRow } from "../_components/ProductLinkRow";

export const metadata: Metadata = { title: "Affiliate products" };
export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  price: number;
  currency: string;
  billing_cycle: string | null;
  type: string;
  affiliate_type: "none" | "amount" | "percent";
  affiliate_value: number;
  affiliate_duration: "once" | "months" | "forever";
  affiliate_duration_months: number | null;
};

function durationLabel(p: ProductRow): string | null {
  if (p.affiliate_type === "none" || p.type !== "subscription") return null;
  if (p.affiliate_duration === "forever") return "recurring for life";
  if (p.affiliate_duration === "months")
    return `for ${p.affiliate_duration_months ?? 0} months`;
  return "first payment";
}

export default async function AffiliateProductsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const account = await getAffiliateForUser(admin, user.id);
  if (!account) return null;

  const { data: products } = await admin
    .from("products")
    .select(
      "id, name, description, slug, price, currency, billing_cycle, type, affiliate_type, affiliate_value, affiliate_duration, affiliate_duration_months",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://vilo.co.za";

  const rows = (products ?? []) as ProductRow[];
  const earning = rows.filter((p) => p.affiliate_type !== "none");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
          Products to promote
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          Share a product&apos;s link. Anyone who buys it within 30 days of
          clicking earns you the commission shown.
        </p>
      </header>

      {earning.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
          No commissionable products are live yet. Check back soon.
        </div>
      ) : (
        <div className="space-y-4">
          {earning.map((p) => {
            const dest = p.slug ? `/p/${p.slug}` : "/";
            const link = `${baseUrl}/r/${account.slug}?next=${encodeURIComponent(dest)}`;
            const dur = durationLabel(p);
            return (
              <div
                key={p.id}
                className="rounded-card border border-brand-line bg-white p-5 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold text-brand-ink">
                      {p.name}
                    </div>
                    {p.description ? (
                      <p className="mt-0.5 max-w-xl text-sm text-brand-mute">
                        {p.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-brand-mute">
                        {formatMoney(p.price, p.currency)}
                        {p.billing_cycle ? ` / ${p.billing_cycle}` : ""}
                      </span>
                      <span className="inline-flex items-center rounded-pill bg-brand-accent px-2 py-0.5 font-medium text-brand-secondary">
                        {commissionLabel(
                          p.affiliate_type,
                          p.affiliate_value,
                          p.currency,
                        )}
                        {dur ? ` · ${dur}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <ProductLinkRow link={link} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
