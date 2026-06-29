import type { Metadata } from "next";
import { Package } from "lucide-react";

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
    "https://wielo.co.za";

  const rows = (products ?? []) as ProductRow[];
  const earning = rows.filter((p) => p.affiliate_type !== "none");

  return (
    <div>
      <p className="max-w-2xl text-[13.5px] leading-relaxed text-brand-mute">
        Every plan and tool you can promote. Each has its own commission and a
        ready-to-share link with your code already attached.
      </p>

      {earning.length === 0 ? (
        <div className="mt-5 rounded-card border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-mute">
          No commissionable products are live yet. Check back soon.
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {earning.map((p) => {
            const dest = p.slug ? `/p/${p.slug}` : "/";
            const link = `${baseUrl}/r/${account.slug}?next=${encodeURIComponent(dest)}`;
            const dur = durationLabel(p);
            return (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-[14px] border border-brand-line bg-white shadow-card transition hover:-translate-y-0.5 hover:border-[#CDE6D8] hover:shadow-lift"
              >
                <div className="flex gap-4 p-4">
                  <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-brand-light text-brand-secondary">
                    <Package className="h-[22px] w-[22px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-[15px] font-bold leading-snug text-brand-ink">
                        {p.name}
                      </h3>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-[#C7F0DC] bg-[#ECFDF5] px-2.5 py-[3px] text-[11.5px] font-semibold text-[#047857]">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                        {commissionLabel(
                          p.affiliate_type,
                          p.affiliate_value,
                          p.currency,
                        )}
                        {dur ? ` · ${dur}` : ""}
                      </span>
                    </div>
                    {p.description ? (
                      <p className="mt-1 text-[12px] leading-snug text-brand-mute">
                        {p.description}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <span className="num font-display text-[16px] font-bold text-brand-ink">
                        {formatMoney(p.price, p.currency)}
                      </span>
                      {p.billing_cycle ? (
                        <span className="text-[11px] text-brand-mute">
                          {" "}
                          / {p.billing_cycle}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-auto border-t border-brand-line px-4 py-2.5">
                  <ProductLinkRow link={link} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
