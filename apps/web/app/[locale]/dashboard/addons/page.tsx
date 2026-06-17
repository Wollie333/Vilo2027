import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

import { Crown, PackagePlus } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";

import { AddonsArchive, type AddonCard } from "./AddonsArchive";
import { type AddonCategory, type PricingModel } from "./schemas";

export const metadata: Metadata = {
  title: "Add-ons",
};

export const dynamic = "force-dynamic";

export default async function AddonsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/addons");

  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!host) {
    return (
      <div>
        <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <PackagePlus className="h-6 w-6" />
          </div>
          <h1 className="font-display text-lg font-bold text-brand-ink">
            Create your host profile first
          </h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
            Finish host onboarding before creating add-ons.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: featureRaw }, { data: rows }] = await Promise.all([
    supabase.rpc("check_feature_permission", {
      p_host_id: host.id,
      p_feature_key: "addons",
    }),
    supabase
      .from("addons")
      .select(
        "id, name, description, image_path, pricing_model, unit_price, currency, min_quantity, max_quantity, is_required, is_active, lead_time_days, category, vat_included, daily_capacity",
      )
      .eq("host_id", host.id)
      .order("sort_order", { ascending: true }),
  ]);

  const feature = featureRaw as { is_enabled: boolean } | null;
  const enabled = feature?.is_enabled ?? false;

  if (!enabled) {
    return (
      <div className="space-y-6">
        <Header />
        <UpgradeCard />
      </div>
    );
  }

  // How many distinct listings each add-on is offered on → "scope" on the card.
  const addonIds = (rows ?? []).map((r) => r.id);
  const { data: laRows } = addonIds.length
    ? await supabase
        .from("property_addons")
        .select("addon_id, listing_id")
        .in("addon_id", addonIds)
    : { data: [] as { addon_id: string; listing_id: string }[] };

  const listingsByAddon = new Map<string, Set<string>>();
  for (const row of laRows ?? []) {
    const set = listingsByAddon.get(row.addon_id) ?? new Set<string>();
    set.add(row.listing_id);
    listingsByAddon.set(row.addon_id, set);
  }

  const addons: AddonCard[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    imageUrl: r.image_path
      ? supabase.storage.from("addon-images").getPublicUrl(r.image_path).data
          .publicUrl
      : null,
    pricingModel: r.pricing_model as PricingModel,
    unitPrice: Number(r.unit_price),
    currency: r.currency,
    minQuantity: r.min_quantity,
    maxQuantity: r.max_quantity,
    isRequired: r.is_required,
    isActive: r.is_active,
    leadTimeDays: r.lead_time_days,
    category: (r.category as AddonCategory | null) ?? null,
    vatIncluded: r.vat_included,
    dailyCapacity: r.daily_capacity,
    listingCount: listingsByAddon.get(r.id)?.size ?? 0,
  }));

  return <AddonsArchive initial={addons} />;
}

function Header() {
  return (
    <header>
      <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
        Add-ons
      </h1>
      <p className="mt-1 text-sm text-brand-mute">
        Create reusable extras once — breakfast, transfers, activities — then
        attach them to listings or specific rooms. Guests pick them at checkout.
      </p>
    </header>
  );
}

function UpgradeCard() {
  return (
    <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-brand-ink">
              Add-ons are on the Pro plan
            </div>
            <p className="mt-1 max-w-md text-sm text-brand-mute">
              Sell breakfasts, transfers, snorkel trips and more alongside every
              booking. Pro and Business plans unlock the add-ons catalog.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/subscription"
          className="inline-flex shrink-0 items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary"
        >
          See plans
        </Link>
      </div>
    </div>
  );
}
