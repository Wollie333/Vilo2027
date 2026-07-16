import { Check } from "lucide-react";
import { notFound } from "next/navigation";

import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

import { BuyForm } from "./BuyForm";

export const dynamic = "force-dynamic";

const CYCLE_LABEL: Record<string, string> = {
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  biannual: "6 months",
  annual: "year",
};

export default async function ProductLandingPage({
  params,
}: {
  params: { slug: string };
}) {
  // A signed-in buyer skips the email step entirely — we already know who they
  // are, so the form goes straight to payment (and grants to THEIR account).
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionEmail = user?.email ?? null;

  const service = createAdminClient();
  const { data: p } = await service
    .from("products")
    .select(
      "id, name, description, type, price, currency, billing_cycle, trial_days, is_active, is_visible, bullets, max_quantity",
    )
    .eq("slug", params.slug)
    .maybeSingle();

  // Hidden + inactive = draft → 404. Otherwise the page is reachable by link.
  if (!p || (!p.is_active && !p.is_visible)) notFound();

  // Capped product (limited beta): lock the buy CTA once the cap is reached.
  let soldOut = false;
  if (p.max_quantity != null) {
    const { data: sold } = await service.rpc("product_units_sold", {
      p_product_id: p.id,
    });
    soldOut = Number(sold ?? 0) >= Number(p.max_quantity);
  }

  const bullets = Array.isArray(p.bullets)
    ? (p.bullets as unknown[]).filter((b): b is string => typeof b === "string")
    : [];
  const isSub = p.type === "subscription";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          {isSub ? "Subscription" : "Once-off"}
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold text-brand-ink">
          {p.name}
        </h1>
        {p.description ? (
          <p className="mt-2 text-sm text-brand-mute">{p.description}</p>
        ) : null}

        <div className="mt-4 font-display text-3xl font-bold text-brand-ink">
          {formatZar(Number(p.price))}
          {isSub ? (
            <span className="text-sm font-medium text-brand-mute">
              {" "}
              / {CYCLE_LABEL[p.billing_cycle ?? "monthly"] ?? "month"}
            </span>
          ) : null}
        </div>
        {isSub && p.trial_days > 0 ? (
          <div className="mt-1 text-[12px] font-medium text-status-confirmed">
            {p.trial_days}-day free trial
          </div>
        ) : null}

        {bullets.length > 0 ? (
          <ul className="mt-4 space-y-2 text-[13px] text-brand-dark">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6">
          {soldOut ? (
            <div className="rounded-md border border-brand-line bg-brand-light/40 px-4 py-3 text-center text-sm font-medium text-brand-mute">
              Sold out — no more are available.
            </div>
          ) : p.is_active ? (
            <BuyForm
              slug={params.slug}
              free={Number(p.price) === 0}
              sessionEmail={sessionEmail}
            />
          ) : (
            <div className="rounded-md border border-brand-line bg-brand-light/40 px-4 py-3 text-center text-sm text-brand-mute">
              Not available for purchase right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
