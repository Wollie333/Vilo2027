import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { hostHasValidEft } from "@/lib/payments/eft";
import { getHostPaystackForBusiness } from "@/lib/payments/host-paystack";
import {
  cancellationNote,
  type ListingPolicySummary,
} from "@/lib/policy/listing-summary";
import {
  buildSitePreviewPages,
  loadSiteContext,
  resolveSiteRef,
  siteBookHref,
} from "@/lib/site/loadSitePage";
import { siteSurfaceIsDark } from "@/lib/site/themes";
import { createAdminClient } from "@/lib/supabase/admin";

import type { PricingModel } from "@/app/[locale]/dashboard/addons/schemas";

import {
  SiteCheckoutForm,
  type CheckoutAddon,
  type CheckoutRoom,
} from "./SiteCheckoutForm";

export const dynamic = "force-dynamic";

type SP = {
  site?: string;
  property?: string;
  slug?: string;
  room?: string;
  from?: string;
  to?: string;
  guests?: string;
  scope?: string;
  preview?: string;
  theme?: string;
  /** Set when booking a SPECIAL (offer) — locks the checkout to it. */
  special?: string;
};

const isIso = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

/**
 * On-site checkout (Phase 6B/c) — runs on the host's own tenant domain. Loads the
 * chosen property + rooms (membership-gated to the site's visible channel
 * members) and the host's payment options, then renders the themed checkout form.
 * Pricing/availability/payment all resolve server-side via the shared booking
 * engine (the client is never trusted on price). 404s if the property isn't a
 * visible member of this site.
 */
export default async function SiteBookPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const h = await headers();
  const ref = resolveSiteRef({
    host: h.get("x-wielo-site-host"),
    siteParam: sp?.site,
  });
  if (!ref) notFound();

  const ctx = await loadSiteContext(ref, {
    siteParam: sp?.site,
    preview: sp?.preview === "1",
    themeSlug: sp?.theme,
  });
  if (!ctx) notFound();

  const previewPages = ctx.preview
    ? await buildSitePreviewPages(ctx)
    : undefined;

  const admin = createAdminClient();

  // Resolve the target property from ?property (id) or ?slug, defaulting to the
  // site's primary visible property. It MUST be a visible channel member.
  let propertyId = sp?.property?.trim() || "";
  if (!propertyId && sp?.slug) {
    const { data: bySlug } = await admin
      .from("properties")
      .select("id")
      .eq("slug", sp.slug.trim())
      .maybeSingle();
    if (bySlug) propertyId = bySlug.id;
  }
  if (!propertyId) propertyId = ctx.propertyIds[0] ?? "";
  if (!propertyId || !ctx.propertyIds.includes(propertyId)) notFound();

  const { data: property } = await admin
    .from("properties")
    .select(
      "id, business_id, host_id, name, currency, base_price, max_guests, min_nights, booking_mode, is_published",
    )
    .eq("id", propertyId)
    .maybeSingle();
  if (!property || !property.is_published) notFound();

  const { data: roomRows } = await admin
    .from("property_rooms")
    .select(
      "id, name, base_price, currency, max_guests, min_guests, min_nights",
    )
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rooms: CheckoutRoom[] = (roomRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    price: r.base_price == null ? null : Number(r.base_price),
    currency: (r.currency as string | null) || property.currency || "ZAR",
    maxGuests: r.max_guests ?? 1,
    minGuests: r.min_guests ?? 1,
    minNights: r.min_nights ?? 1,
  }));

  // Eligible add-ons for the picker. Grouped by add-on id: a property-wide row
  // (room_id null) always shows; otherwise it's scoped to its room(s) and shown
  // only when one is selected. Effective price = lowest across its rows (matches
  // the server's pricing). The server re-validates/clamps everything at booking.
  type AddonDef = {
    id: string;
    name: string;
    description: string | null;
    image_path: string | null;
    pricing_model: string;
    unit_price: number;
    currency: string;
    min_quantity: number;
    max_quantity: number | null;
    allow_custom_quantity: boolean;
    stock_quantity: number | null;
    is_required: boolean;
    is_active: boolean;
  };
  type AddonJoinRow = {
    addon_id: string;
    room_id: string | null;
    unit_price_override: number | null;
    addons: AddonDef | AddonDef[] | null;
  };
  const { data: addonRows } = await admin
    .from("property_addons")
    .select(
      "addon_id, room_id, unit_price_override, addons!inner ( id, name, description, image_path, pricing_model, unit_price, currency, min_quantity, max_quantity, allow_custom_quantity, stock_quantity, is_required, is_active )",
    )
    .eq("property_id", propertyId);

  const addonAgg = new Map<
    string,
    { def: AddonDef; effective: number; rooms: Set<string> | null }
  >();
  for (const raw of (addonRows ?? []) as unknown as AddonJoinRow[]) {
    const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
    if (!a || !a.is_active) continue;
    const effective =
      raw.unit_price_override == null
        ? Number(a.unit_price)
        : Number(raw.unit_price_override);
    const cur = addonAgg.get(a.id);
    if (!cur) {
      addonAgg.set(a.id, {
        def: a,
        effective,
        rooms: raw.room_id == null ? null : new Set([raw.room_id]),
      });
    } else {
      cur.effective = Math.min(cur.effective, effective);
      if (raw.room_id == null) cur.rooms = null;
      else if (cur.rooms) cur.rooms.add(raw.room_id);
    }
  }
  const supaUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
  const addonImageUrl = (path: string | null): string | null => {
    if (!path) return null;
    if (/^(https?:\/\/|data:)/.test(path)) return path;
    return supaUrl
      ? `${supaUrl}/storage/v1/object/public/addon-images/${path}`
      : null;
  };
  const addons: CheckoutAddon[] = [...addonAgg.values()].map(
    ({ def, effective, rooms }) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      imageUrl: addonImageUrl(def.image_path),
      pricingModel: def.pricing_model as PricingModel,
      unitPrice: effective,
      currency: def.currency || property.currency || "ZAR",
      minQuantity: def.min_quantity,
      maxQuantity: def.max_quantity,
      allowCustom: def.allow_custom_quantity,
      stock: def.stock_quantity,
      isRequired: def.is_required,
      roomIds: rooms ? [...rooms] : null,
    }),
  );

  // Payment rails — card when the host has connected Paystack, EFT when a valid
  // default account exists. Both resolved server-side, THEN gated by the host's
  // per-website toggles (Settings → Booking payment methods; default on).
  const [cardPaystack, eftHasAccount, siteRow] = await Promise.all([
    property.business_id
      ? getHostPaystackForBusiness(property.business_id)
      : Promise.resolve(null),
    hostHasValidEft(property.host_id),
    admin
      .from("host_websites")
      .select("settings")
      .eq("id", ctx.websiteId)
      .maybeSingle(),
  ]);
  const pay =
    (
      siteRow.data?.settings as {
        payments?: { paystack?: boolean; eft?: boolean };
      } | null
    )?.payments ?? {};
  const cardAvailable = Boolean(cardPaystack) && pay.paystack !== false;
  const eftAvailable = eftHasAccount && pay.eft !== false;

  // Cancellation note (best-effort) via the policy resolver RPC.
  let cancellation: { title: string; note: string } | null = null;
  try {
    const { data: summary } = await admin.rpc("get_listing_policy_summary", {
      p_listing_id: propertyId,
    });
    if (summary)
      cancellation = cancellationNote(
        summary as unknown as ListingPolicySummary,
      );
  } catch {
    cancellation = null;
  }

  // SPECIAL (offer) checkout — when ?special is present, load the offer (scoped to
  // this site's business + opted-in), lock the checkout to it, and show the offer
  // total. The create call re-prices at the offer rate + redeems it server-side.
  let special: {
    id: string;
    title: string;
    total: number;
    perNight: number | null;
    currency: string;
    dateMode: "fixed" | "flexible";
    savingsLabel?: string | null;
    from?: string;
    to?: string;
    roomId?: string | null;
  } | null = null;
  // A special's OWN bundled add-ons (compulsory + optional upsells) — shown +
  // pre-selected on its checkout instead of the property's generic add-ons, so the
  // guest sees exactly what the offer includes. The create call re-prices them.
  let specialAddons: CheckoutAddon[] | null = null;
  const specialId = sp?.special?.trim();
  if (specialId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: sRow } = await admin
      .from("specials")
      .select(
        "id, business_id, property_id, room_id, title, currency, status, deleted_at, show_on_website, date_mode, fixed_check_in, fixed_check_out, price_mode, flat_total, per_night_price, savings_pct, savings_amount, quantity, redemptions_used, go_live_at, book_by",
      )
      .eq("id", specialId)
      .maybeSingle();
    const eligible =
      sRow &&
      !sRow.deleted_at &&
      sRow.status === "active" &&
      sRow.show_on_website &&
      sRow.business_id === property.business_id &&
      sRow.property_id === property.id &&
      sRow.redemptions_used < sRow.quantity &&
      (!sRow.go_live_at || sRow.go_live_at <= today) &&
      (!sRow.book_by || sRow.book_by >= today);
    if (eligible) {
      const from = isIso(sp?.from) ? sp!.from! : (sRow!.fixed_check_in ?? "");
      const to = isIso(sp?.to) ? sp!.to! : (sRow!.fixed_check_out ?? "");
      const nights =
        from && to
          ? Math.max(
              1,
              Math.round(
                (new Date(to).getTime() - new Date(from).getTime()) / 86400000,
              ),
            )
          : 1;
      const total =
        sRow!.price_mode === "flat"
          ? Number(sRow!.flat_total ?? 0)
          : Number(sRow!.per_night_price ?? 0) * nights;
      const savingsLabel =
        sRow!.savings_pct != null
          ? `Save ${sRow!.savings_pct}%`
          : sRow!.savings_amount != null
            ? `Save ${property.currency || "ZAR"} ${Number(sRow!.savings_amount)}`
            : null;
      special = {
        id: sRow!.id,
        title: sRow!.title,
        total,
        perNight:
          sRow!.price_mode === "per_night"
            ? Number(sRow!.per_night_price ?? 0)
            : null,
        currency: sRow!.currency || property.currency || "ZAR",
        dateMode: sRow!.date_mode === "fixed" ? "fixed" : "flexible",
        savingsLabel,
        from,
        to,
        roomId: sRow!.room_id,
      };

      // The offer's bundled add-ons (compulsory + optional upsells), re-priced off
      // the catalog + the special's per-deal override. Shown + pre-selected on the
      // checkout; the create call re-validates them.
      type SAJoin = {
        addon_id: string;
        is_required: boolean;
        unit_price_override: number | null;
        addons: AddonDef | AddonDef[] | null;
      };
      const { data: saRows } = await admin
        .from("special_addons")
        .select(
          "addon_id, is_required, unit_price_override, sort_order, addons!inner ( id, name, description, image_path, pricing_model, unit_price, currency, min_quantity, max_quantity, allow_custom_quantity, stock_quantity, is_required, is_active )",
        )
        .eq("special_id", sRow!.id)
        .order("sort_order", { ascending: true });
      specialAddons = ((saRows ?? []) as unknown as SAJoin[])
        .map((raw): CheckoutAddon | null => {
          const a = Array.isArray(raw.addons) ? raw.addons[0] : raw.addons;
          if (!a || !a.is_active) return null;
          return {
            id: a.id,
            name: a.name,
            description: a.description,
            imageUrl: addonImageUrl(a.image_path),
            pricingModel: a.pricing_model as PricingModel,
            unitPrice:
              raw.unit_price_override == null
                ? Number(a.unit_price)
                : Number(raw.unit_price_override),
            currency: a.currency || property.currency || "ZAR",
            minQuantity: a.min_quantity,
            maxQuantity: a.max_quantity,
            allowCustom: a.allow_custom_quantity,
            stock: a.stock_quantity,
            isRequired: raw.is_required,
            roomIds: null,
          };
        })
        .filter((a): a is CheckoutAddon => a !== null);
    }
  }

  const checkout = (
    <SiteCheckoutForm
      websiteId={ctx.websiteId}
      propertyId={property.id}
      propertyName={property.name}
      currency={property.currency || "ZAR"}
      maxGuests={property.max_guests ?? 10}
      basePrice={
        property.base_price == null ? null : Number(property.base_price)
      }
      bookingMode={property.booking_mode ?? "whole_listing"}
      rooms={rooms}
      addons={specialAddons ?? addons}
      cardAvailable={cardAvailable}
      eftAvailable={eftAvailable}
      cancellation={cancellation}
      special={
        special
          ? {
              id: special.id,
              title: special.title,
              total: special.total,
              perNight: special.perNight,
              currency: special.currency,
              dateMode: special.dateMode,
              savingsLabel: special.savingsLabel,
              // Locks the checkout to the offer's room (null = whole-listing offer).
              roomId: special.roomId,
            }
          : undefined
      }
      initial={{
        from: special?.from ?? (isIso(sp?.from) ? sp!.from! : ""),
        to: special?.to ?? (isIso(sp?.to) ? sp!.to! : ""),
        guests: Math.max(1, Number(sp?.guests) || 2),
        roomId: special?.roomId ?? (sp?.room?.trim() || null),
        scope: sp?.scope === "whole_listing" ? "whole_listing" : null,
      }}
    />
  );

  return (
    <SiteThemeRoot theme={ctx.theme}>
      <SiteChrome
        brand={ctx.brand}
        nav={ctx.nav}
        navigation={ctx.navigation}
        conversion={ctx.conversion}
        analytics={ctx.analytics}
        layout={ctx.layout}
        popupForm={ctx.popupForm}
        websiteId={ctx.websiteId}
        bookHref={
          ctx.propertyIds.length > 0 ? siteBookHref(ctx, {}) : undefined
        }
        darkChrome={siteSurfaceIsDark(ctx.theme)}
        header={ctx.theme.header}
        footer={ctx.theme.footer}
        preview={
          ctx.preview
            ? { subdomain: ctx.subdomain, themeSlug: ctx.previewThemeSlug }
            : undefined
        }
        previewPages={previewPages}
      >
        {checkout}
      </SiteChrome>
    </SiteThemeRoot>
  );
}
