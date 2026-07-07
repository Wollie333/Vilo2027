import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import {
  cancellationNote,
  getListingPolicySummary,
} from "@/lib/policy/listing-summary";
import {
  getHostPaystack,
  getHostPaystackForBusiness,
} from "@/lib/payments/host-paystack";
import {
  getHostPayPal,
  getHostPayPalForBusiness,
} from "@/lib/payments/host-paypal";
import { specialCategoryLabel } from "@/lib/specials/categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";

import { type PricingModel } from "../../../dashboard/addons/schemas";
import {
  SpecialBookingForm,
  type SpecialAddonOption,
} from "./SpecialBookingForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("specials");
  return { title: t("bkMetaTitle") };
}

// Guest-facing deal data (quantity left, add-ons, dates) must always read fresh —
// see the sibling property booking page for why force-dynamic is required.
export const dynamic = "force-dynamic";

export default async function SpecialBookingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { via?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bookedVia = searchParams?.via === "website" ? "website" : "platform";

  // Admin read — RLS only exposes active rows, but we also need to render a
  // graceful sold-out/closed state, so read with the admin client and guard.
  // Slug is unique per host, not globally; pre-MVP collisions are vanishingly
  // unlikely, so take the earliest active match (the booking action keys off the
  // resolved id, so the charge is always unambiguous).
  const admin = createAdminClient();
  const { data: specialRows } = await admin
    .from("specials")
    .select(
      "id, host_id, business_id, property_id, room_id, title, description, hero_image_path, badge, date_mode, fixed_check_in, fixed_check_out, window_start, window_end, min_nights, max_nights, price_mode, flat_total, per_night_price, currency, max_guests, quantity, redemptions_used, go_live_at, book_by, categories, custom_tags, was_price, savings_amount, savings_pct, cancellation_policy_id, status, deleted_at",
    )
    .eq("slug", params.slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const special = specialRows?.[0];
  if (!special) notFound();

  const { data: property } = await admin
    .from("properties")
    .select(
      "id, host_id, business_id, name, city, province, currency, base_price, weekend_price, cleaning_fee, max_guests",
    )
    .eq("id", special.property_id)
    .maybeSingle();
  if (!property) notFound();

  let roomName: string | null = null;
  let roomMaxGuests: number | null = null;
  if (special.room_id) {
    const { data: room } = await admin
      .from("property_rooms")
      .select("name, max_guests")
      .eq("id", special.room_id)
      .maybeSingle();
    roomName = room?.name ?? null;
    roomMaxGuests = room?.max_guests ?? null;
  }

  // Bundled add-ons (compulsory) + optional upsells, joined to the catalog.
  const { data: addonRows } = await admin
    .from("special_addons")
    .select(
      "addon_id, is_required, unit_price_override, sort_order, addons!inner ( id, name, description, pricing_model, unit_price, currency, min_quantity, is_active )",
    )
    .eq("special_id", special.id)
    .order("sort_order", { ascending: true });

  type AddonJoin = {
    addon_id: string;
    is_required: boolean;
    unit_price_override: number | null;
    addons: {
      id: string;
      name: string;
      description: string | null;
      pricing_model: PricingModel;
      unit_price: number;
      currency: string;
      min_quantity: number;
      is_active: boolean;
    };
  };

  const requiredAddons: SpecialAddonOption[] = [];
  const optionalAddons: SpecialAddonOption[] = [];
  for (const raw of (addonRows ?? []) as unknown as AddonJoin[]) {
    const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
    if (!a || !a.is_active) continue;
    const opt: SpecialAddonOption = {
      id: a.id,
      name: a.name,
      description: a.description,
      pricingModel: a.pricing_model,
      unitPrice:
        raw.unit_price_override == null
          ? Number(a.unit_price)
          : Number(raw.unit_price_override),
      minQuantity: a.min_quantity ?? 1,
      currency: a.currency,
    };
    if (raw.is_required) requiredAddons.push(opt);
    else optionalAddons.push(opt);
  }

  // Host card / EFT rails — the action enforces the same predicates server-side.
  const { data: eftRow } = await admin
    .from("eft_banking_details")
    .select("id")
    .eq("host_id", property.host_id)
    .eq("is_default", true)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();
  const hasEftBanking = !!eftRow;
  const hasPaystack = !!(property.business_id
    ? await getHostPaystackForBusiness(property.business_id)
    : await getHostPaystack(property.host_id));
  const hasPaypal = !!(property.business_id
    ? await getHostPayPalForBusiness(property.business_id)
    : await getHostPayPal(property.host_id));

  // Host attribution.
  const { data: hostRow } = await supabase
    .from("hosts")
    .select("display_name")
    .eq("id", property.host_id)
    .maybeSingle();

  // Contact prefill for a signed-in guest.
  let guestName = "";
  let guestPhone = "";
  if (user) {
    const { data: prof } = await supabase
      .from("user_profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle();
    guestName = prof?.full_name ?? "";
    guestPhone = prof?.phone ?? "";
  }

  // Effective cancellation note shown at checkout. The special's override (if
  // any) is what gets snapshotted; without one it resolves to the property's.
  const policySummary = await getListingPolicySummary(
    property.id,
    special.room_id ?? undefined,
  );
  const note = cancellationNote(policySummary);

  const remaining = Math.max(0, special.quantity - special.redemptions_used);
  const heroUrl = websiteAssetUrl(special.hero_image_path);
  const t = await getTranslations("specials");
  const categoryLabels = (special.categories ?? []).map((c: string) =>
    t.has(`category_${c}`) ? t(`category_${c}`) : specialCategoryLabel(c),
  );

  return (
    <div className="bg-white text-brand-ink">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
        <SpecialBookingForm
          specialId={special.id}
          slug={params.slug}
          bookedVia={bookedVia}
          title={special.title}
          description={special.description}
          badge={special.badge}
          heroUrl={heroUrl}
          categoryLabels={categoryLabels}
          propertyName={property.name}
          propertyCity={property.city}
          propertyProvince={property.province}
          roomName={roomName}
          hostName={hostRow?.display_name ?? null}
          currency={special.currency}
          dateMode={special.date_mode as "fixed" | "flexible"}
          fixedCheckIn={special.fixed_check_in}
          fixedCheckOut={special.fixed_check_out}
          windowStart={special.window_start}
          windowEnd={special.window_end}
          minNights={special.min_nights}
          maxNights={special.max_nights}
          priceMode={special.price_mode as "flat" | "per_night"}
          flatTotal={
            special.flat_total == null ? null : Number(special.flat_total)
          }
          perNightPrice={
            special.per_night_price == null
              ? null
              : Number(special.per_night_price)
          }
          maxGuests={
            special.max_guests ?? roomMaxGuests ?? property.max_guests ?? 50
          }
          wasPrice={
            special.was_price == null ? null : Number(special.was_price)
          }
          savingsAmount={
            special.savings_amount == null
              ? null
              : Number(special.savings_amount)
          }
          savingsPct={special.savings_pct}
          remaining={remaining}
          requiredAddons={requiredAddons}
          optionalAddons={optionalAddons}
          cancellationNote={note?.note ?? null}
          hasEftBanking={hasEftBanking}
          hasPaystack={hasPaystack}
          hasPaypal={hasPaypal}
          isAuthenticated={!!user}
          guestEmail={user?.email ?? ""}
          guestName={guestName}
          guestPhone={guestPhone}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
