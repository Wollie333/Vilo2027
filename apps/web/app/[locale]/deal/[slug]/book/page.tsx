import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { FirePixelEvent } from "@/components/site/FirePixelEvent";
import { commerceParams } from "@/lib/analytics/pixel";
import {
  getHostPaystack,
  getHostPaystackForBusiness,
} from "@/lib/payments/host-paystack";
import {
  getHostPayPal,
  getHostPayPalForBusiness,
} from "@/lib/payments/host-paypal";
import {
  cancellationNote,
  getListingPolicySummary,
} from "@/lib/policy/listing-summary";
import { type PricingUnit } from "@/lib/pricing";
import { effectiveVatRate } from "@/lib/pricing/vat";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { websiteAssetUrl } from "@/lib/website/assets";

import { type PricingModel } from "../../../dashboard/addons/schemas";
import {
  BookingForm,
  type AvailableAddon,
  type DealCheckoutContext,
} from "../../../property/[slug]/book/BookingForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("specials");
  return { title: t("bkMetaTitle") };
}

// Guest-facing deal data (quantity left, add-ons, dates) must always read fresh —
// see the sibling property booking page for why force-dynamic is required.
export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO date `iso` shifted by `n` whole days (UTC-safe). */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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
  const bookUrl = `/deal/${params.slug}/book${
    bookedVia === "website" ? "?via=website" : ""
  }`;

  // Admin read — RLS only exposes active rows, but we also need to render a
  // graceful sold-out/closed state, so read with the admin client and guard.
  // Slug is unique per host, not globally; pre-MVP collisions are vanishingly
  // unlikely, so take the earliest active match (the booking action keys off the
  // resolved id, so the charge is always unambiguous).
  const admin = createAdminClient();
  const { data: specialRows } = await admin
    .from("specials")
    .select(
      "id, host_id, business_id, property_id, room_id, title, description, hero_image_path, badge, date_mode, fixed_check_in, fixed_check_out, window_start, window_end, min_nights, max_nights, is_evergreen, price_mode, flat_total, per_night_price, currency, max_guests, quantity, redemptions_used, go_live_at, book_by, categories, custom_tags, was_price, savings_amount, savings_pct, cancellation_policy_id, status, deleted_at",
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
      "id, host_id, business_id, name, city, province, currency, base_price, weekend_price, cleaning_fee, max_guests, cancellation_policy, instant_booking, vat_number, vat_rate",
    )
    .eq("id", special.property_id)
    .maybeSingle();
  if (!property) notFound();

  // The deal's priceable unit — a specific room, or the whole property.
  let roomName: string | null = null;
  let roomMaxGuests: number | null = null;
  let unit: DealCheckoutContext["unit"];
  if (special.room_id) {
    const { data: room } = await admin
      .from("property_rooms")
      .select(
        "name, max_guests, base_price, weekend_price, cleaning_fee, pricing_mode, price_per_person, base_occupancy, extra_guest_price",
      )
      .eq("id", special.room_id)
      .maybeSingle();
    if (!room) notFound();
    roomName = room.name;
    roomMaxGuests = room.max_guests;
    unit = {
      pricing_mode: (room.pricing_mode ??
        "per_room") as PricingUnit["pricing_mode"],
      base_price: Number(room.base_price ?? 0),
      price_per_person:
        room.price_per_person == null ? null : Number(room.price_per_person),
      base_occupancy: room.base_occupancy ?? null,
      extra_guest_price:
        room.extra_guest_price == null ? null : Number(room.extra_guest_price),
      weekend_price:
        room.weekend_price == null ? null : Number(room.weekend_price),
      cleaning_fee: Number(room.cleaning_fee ?? 0),
    };
  } else {
    unit = {
      pricing_mode: "per_room",
      base_price: Number(property.base_price ?? 0),
      price_per_person: null,
      base_occupancy: null,
      extra_guest_price: null,
      weekend_price:
        property.weekend_price == null ? null : Number(property.weekend_price),
      cleaning_fee: Number(property.cleaning_fee ?? 0),
    };
  }

  // Bundled add-ons (compulsory) + optional upsells, joined to the catalog. Both
  // become AvailableAddon rows for the unified checkout; required ones are
  // pre-selected + locked, optional ones are toggleable. lead_time_days is 0 so a
  // compulsory add-on is never dropped by the lead-time filter.
  const { data: addonRows } = await admin
    .from("special_addons")
    .select(
      "addon_id, is_required, unit_price_override, sort_order, addons!inner ( id, name, description, image_path, pricing_model, unit_price, currency, min_quantity, is_active )",
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
      image_path: string | null;
      pricing_model: PricingModel;
      unit_price: number;
      currency: string;
      min_quantity: number;
      is_active: boolean;
    };
  };

  const availableAddons: AvailableAddon[] = [];
  const requiredAddonIds: string[] = [];
  for (const raw of (addonRows ?? []) as unknown as AddonJoin[]) {
    const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
    if (!a || !a.is_active) continue;
    availableAddons.push({
      id: a.id,
      name: a.name,
      description: a.description,
      imageUrl: a.image_path
        ? supabase.storage.from("addon-images").getPublicUrl(a.image_path).data
            .publicUrl
        : null,
      pricingModel: a.pricing_model,
      unitPrice:
        raw.unit_price_override == null
          ? Number(a.unit_price)
          : Number(raw.unit_price_override),
      currency: a.currency,
      minQuantity: a.min_quantity ?? 1,
      // Deals fix the add-on quantity (server recomputes it) — no custom stepper.
      maxQuantity: null,
      allowCustomQuantity: false,
      stockQuantity: null,
      isRequired: raw.is_required,
      leadTimeDays: 0,
    });
    if (raw.is_required) requiredAddonIds.push(a.id);
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

  // Host attribution + guest prefill.
  const { data: hostRow } = await supabase
    .from("hosts")
    .select("display_name, avatar_url")
    .eq("id", property.host_id)
    .maybeSingle();
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

  // Effective cancellation + booking terms shown at checkout (resolver: room →
  // listing → host default). The special's own cancellation override (if any) is
  // what gets SNAPSHOTTED onto the booking server-side — the displayed policy is
  // the listing/room effective one, matching the prior deal form. (A dedicated
  // override display is a shared follow-up for both checkouts.)
  const policySummary = await getListingPolicySummary(
    property.id,
    special.room_id ?? undefined,
  );
  const note = cancellationNote(policySummary);
  const checkoutCancellation = policySummary.cancellation
    ? {
        name: policySummary.cancellation.name,
        isNonRefundable: policySummary.cancellation.is_non_refundable,
        rules: policySummary.cancellation.rules,
        note: note?.note ?? null,
      }
    : null;
  const checkoutBookingTerms = policySummary.booking_terms
    ? {
        name: policySummary.booking_terms.name,
        bodyHtml: policySummary.booking_terms.body_html ?? null,
      }
    : null;

  const remaining = Math.max(0, special.quantity - special.redemptions_used);
  const heroUrl = websiteAssetUrl(special.hero_image_path);
  const t = await getTranslations("specials");

  const maxGuests =
    special.max_guests ?? roomMaxGuests ?? property.max_guests ?? 50;
  const currency = special.currency as string;

  // Default dates fed to the form: fixed deals lock the deal's dates; flexible/
  // evergreen deals start at the window (or today) for the deal's minimum stay.
  let checkIn = "";
  let checkOut = "";
  if (special.date_mode === "fixed") {
    checkIn = special.fixed_check_in ?? "";
    checkOut = special.fixed_check_out ?? "";
  } else {
    const today = todayIso();
    const start =
      special.window_start && special.window_start > today
        ? special.window_start
        : today;
    checkIn = start;
    checkOut = addDays(start, Math.max(1, special.min_nights ?? 1));
    if (
      !special.is_evergreen &&
      special.window_end &&
      checkOut > special.window_end
    ) {
      checkOut = special.window_end;
    }
  }

  const dealCtx: DealCheckoutContext = {
    specialId: special.id,
    bookedVia,
    bookUrl,
    title: special.title,
    description: special.description,
    priceMode: special.price_mode as "flat" | "per_night",
    flatTotal: special.flat_total == null ? null : Number(special.flat_total),
    perNightPrice:
      special.per_night_price == null ? null : Number(special.per_night_price),
    dateMode: special.date_mode as "fixed" | "flexible",
    isEvergreen: special.is_evergreen,
    fixedCheckIn: special.fixed_check_in,
    fixedCheckOut: special.fixed_check_out,
    windowStart: special.window_start,
    windowEnd: special.window_end,
    minNights: special.min_nights,
    maxNights: special.max_nights,
    roomId: special.room_id,
    roomName,
    maxGuests,
    wasPrice: special.was_price == null ? null : Number(special.was_price),
    savingsAmount:
      special.savings_amount == null ? null : Number(special.savings_amount),
    savingsPct: special.savings_pct,
    requiredAddonIds,
    unit,
  };

  const soldOut = remaining <= 0;

  return (
    <div className="bg-white text-brand-ink">
      <SiteHeader />
      {/* Meta InitiateCheckout — DIRECTORY (Wielo) side → fires the Wielo pixel.
          A deal has a known price, so we can send a real value. */}
      <FirePixelEvent
        event="InitiateCheckout"
        consentRequired={false}
        params={commerceParams({
          contentIds: [property.id],
          contentName: property.name,
          currency,
          ...(special.flat_total != null
            ? { value: Number(special.flat_total) }
            : special.per_night_price != null
              ? { value: Number(special.per_night_price) }
              : special.was_price != null
                ? { value: Number(special.was_price) }
                : {}),
        })}
      />
      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
        {soldOut ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-brand-line bg-brand-light p-8 text-center">
            <h1 className="font-display text-2xl font-extrabold text-brand-ink">
              {special.title}
            </h1>
            <p className="mt-3 text-sm text-brand-mute">{t("bkErrSoldOut")}</p>
          </div>
        ) : (
          <BookingForm
            listingId={property.id}
            listingSlug={params.slug}
            listingName={property.name}
            hostName={hostRow?.display_name ?? null}
            hostAvatarUrl={hostRow?.avatar_url ?? null}
            listingTypeLabel="Deal"
            listingCity={property.city}
            listingProvince={property.province}
            coverImageUrl={heroUrl}
            basePrice={Number(property.base_price ?? 0)}
            weekendPrice={
              property.weekend_price == null
                ? null
                : Number(property.weekend_price)
            }
            cleaningFee={Number(property.cleaning_fee ?? 0)}
            vatRate={effectiveVatRate(property)}
            listingChildPrice={0}
            listingInfantPrice={0}
            listingPetFee={0}
            listingAllowChildren={false}
            listingAllowInfants={false}
            listingAllowPets={false}
            currency={currency}
            cancellationPolicy={property.cancellation_policy}
            cancellation={checkoutCancellation}
            bookingTerms={checkoutBookingTerms}
            instantBooking={property.instant_booking ?? false}
            bookingMode="flexible"
            checkIn={checkIn}
            checkOut={checkOut}
            minNights={1}
            wholeGuests={Math.min(2, maxGuests)}
            maxGuestsWhole={maxGuests}
            guestEmail={user?.email ?? ""}
            isAuthenticated={!!user}
            guestName={guestName}
            guestPhone={guestPhone}
            allRooms={[]}
            initialSelectedRoomIds={[]}
            initialRoomGuests={{}}
            availableAddons={availableAddons}
            hasEftBanking={hasEftBanking}
            hasPaystack={hasPaystack}
            hasPaypal={hasPaypal}
            seasonalRules={[]}
            wholeListingDiscountPct={null}
            weeklyDiscountPct={null}
            monthlyDiscountPct={null}
            deal={dealCtx}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
