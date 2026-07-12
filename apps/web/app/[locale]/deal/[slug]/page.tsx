import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  BedDouble,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  Gift,
  MapPin,
  Percent,
  Play,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";

import { Money } from "@/components/currency/Money";
import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { FirePixelEvent } from "@/components/site/FirePixelEvent";
import { commerceParams } from "@/lib/analytics/pixel";
import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import { nightsBetween } from "@/lib/pricing/engine";
import {
  cancellationNote,
  getListingPolicySummary,
} from "@/lib/policy/listing-summary";
import { effectiveVatRate, grossVat } from "@/lib/pricing/vat";
import { specialCategoryLabel } from "@/lib/specials/categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { websiteAssetUrl } from "@/lib/website/assets";

import { AmenitiesList } from "@/app/[locale]/property/[slug]/AmenitiesList";
import {
  PhotoGallery,
  type GalleryPhoto,
} from "@/app/[locale]/property/[slug]/PhotoGallery";
import { bedSummary } from "@/app/[locale]/property/[slug]/roomDisplay";

import { ReportButton } from "@/components/report/ReportButton";

import { DealSubnav, type DealNavItem } from "./_components/DealSubnav";
import { ShareSpecialButton } from "./_components/ShareSpecialButton";
import { SpecialTracker } from "./_components/SpecialTracker";

export const dynamic = "force-dynamic";

const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function loadSpecial(slug: string) {
  const admin = createAdminClient();
  // Slug is unique per host (not global); take the earliest active match — the
  // booking action keys off the resolved id so the charge stays unambiguous.
  const { data: rows } = await admin
    .from("specials")
    .select(
      "id, host_id, property_id, room_id, title, description, hero_image_path, badge, date_mode, fixed_check_in, fixed_check_out, window_start, window_end, min_nights, max_nights, price_mode, flat_total, per_night_price, currency, max_guests, quantity, redemptions_used, go_live_at, book_by, categories, was_price, savings_amount, savings_pct",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  const special = rows?.[0];
  if (!special) return null;

  const { data: property } = await admin
    .from("properties")
    .select(
      "id, slug, host_id, name, city, province, country, accommodation_type, vat_number, vat_rate, deleted_at",
    )
    .eq("id", special.property_id)
    .maybeSingle();
  if (!property || property.deleted_at) return null;

  // Gallery photos: prefer the deal's room's photos when room-scoped, else the
  // whole property's. The special hero (if set) leads the gallery.
  const { data: photoRows } = await admin
    .from("property_photos")
    .select("id, url, sort_order, room_id")
    .eq("property_id", special.property_id)
    .order("sort_order", { ascending: true });
  const allPhotos = (photoRows ?? []) as Array<{
    id: string;
    url: string;
    room_id: string | null;
  }>;

  // Rooms attached to the deal: the single targeted room, or — for a
  // whole-property deal — every active room (descriptive of what booking the
  // whole place includes). Each card gets its own first photo when it has one.
  let roomQuery = admin
    .from("property_rooms")
    .select(
      "id, name, max_guests, has_ensuite_bathroom, sort_order, beds:room_beds ( bed_kind, quantity, sort_order )",
    )
    .eq("property_id", special.property_id)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (special.room_id) roomQuery = roomQuery.eq("id", special.room_id);
  const { data: roomRows } = await roomQuery;
  const rooms = (
    (roomRows ?? []) as Array<{
      id: string;
      name: string;
      max_guests: number;
      has_ensuite_bathroom: boolean;
      beds: { bed_kind: string; quantity: number; sort_order: number }[];
    }>
  ).map((r) => ({
    id: r.id,
    name: r.name,
    maxGuests: r.max_guests,
    ensuite: r.has_ensuite_bathroom,
    bedLabel: bedSummary(
      [...(r.beds ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    ),
    photoUrl: allPhotos.find((p) => p.room_id === r.id)?.url ?? null,
  }));
  const roomName = special.room_id ? (rooms[0]?.name ?? null) : null;
  let galleryRows = allPhotos;
  if (special.room_id) {
    const roomPhotos = allPhotos.filter((p) => p.room_id === special.room_id);
    if (roomPhotos.length > 0) galleryRows = roomPhotos;
  }
  const gallery: GalleryPhoto[] = galleryRows.map((p) => ({
    id: p.id,
    url: p.url,
  }));
  const heroAsset = websiteAssetUrl(special.hero_image_path);
  if (heroAsset) gallery.unshift({ id: "special-hero", url: heroAsset });

  // What this place offers — property amenities (deduped across room scopes).
  const { data: amenityRows } = await admin
    .from("property_amenities")
    .select("amenity_key")
    .eq("property_id", special.property_id);
  const amenityKeys = Array.from(
    new Set((amenityRows ?? []).map((a) => a.amenity_key)),
  );

  // Compulsory add-ons = "what's included" in the package.
  const { data: addonRows } = await admin
    .from("special_addons")
    .select("is_required, sort_order, addons!inner ( name, is_active )")
    .eq("special_id", special.id)
    .eq("is_required", true)
    .order("sort_order", { ascending: true });
  const included = (
    (addonRows ?? []) as unknown as Array<{
      addons:
        | { name: string; is_active: boolean }
        | { name: string; is_active: boolean }[];
    }>
  )
    .map((r) => (Array.isArray(r.addons) ? r.addons[0] : r.addons))
    .filter((a) => a && a.is_active)
    .map((a) => a.name);

  const { data: hostRow } = await admin
    .from("hosts")
    .select("display_name")
    .eq("id", property.host_id)
    .maybeSingle();

  return {
    special,
    property,
    roomName,
    rooms,
    gallery,
    amenityKeys,
    included,
    hostName: hostRow?.display_name ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const loaded = await loadSpecial(params.slug);
  const t = await getTranslations("specials");
  if (!loaded) return { title: t("dtMetaNotFound") };
  return {
    title: t("dtMetaTitle", { title: loaded.special.title }),
    description: loaded.special.description ?? undefined,
  };
}

export default async function SpecialDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const loaded = await loadSpecial(params.slug);
  if (!loaded) notFound();
  const {
    special,
    property,
    roomName,
    rooms,
    gallery,
    amenityKeys,
    included,
    hostName,
  } = loaded;
  const [t, brandName] = await Promise.all([
    getTranslations("specials"),
    getBrandName(),
  ]);
  // Curated category keys have their own translations; fall back to the lib's
  // English label for any unknown/custom key.
  const catLabel = (c: string) =>
    t.has(`category_${c}`) ? t(`category_${c}`) : specialCategoryLabel(c);

  const today = todayISO();
  const remaining = Math.max(0, special.quantity - special.redemptions_used);
  const stayEnd =
    special.date_mode === "fixed"
      ? special.fixed_check_out
      : special.window_end;
  const expired =
    (special.book_by && special.book_by < today) ||
    (stayEnd && stayEnd <= today) ||
    (special.go_live_at && special.go_live_at > today);
  const soldOut = remaining <= 0;
  const bookable = !soldOut && !expired;

  const locationLine = [property.city, property.province, property.country]
    .filter(Boolean)
    .join(", ");
  const categoryLabels = (special.categories ?? []).map((c: string) =>
    catLabel(c),
  );

  const policySummary = await getListingPolicySummary(
    property.id,
    special.room_id ?? undefined,
  );
  const note = cancellationNote(policySummary);

  const amount =
    special.price_mode === "flat"
      ? special.flat_total == null
        ? null
        : Number(special.flat_total)
      : special.per_night_price == null
        ? null
        : Number(special.per_night_price);
  const isFlat = special.price_mode === "flat";
  // Host prices are ex-VAT; the booking trigger grosses the charge. Show every
  // guest-facing price VAT-inclusive so "shown == charged" (0 rate = no-op).
  const vatRate = effectiveVatRate(property);
  const perLabel = isFlat ? t("dtPackageTotal") : t("dtPerNight");
  const priceLabel = isFlat ? t("ddPriceLabelPkg") : t("ddPriceLabelNight");
  const offSuffix = special.savings_pct
    ? t("dtOffParen", { pct: special.savings_pct })
    : "";

  // ── Derived date + scope summaries ──
  const fixedNights =
    special.date_mode === "fixed" &&
    special.fixed_check_in &&
    special.fixed_check_out
      ? nightsBetween(special.fixed_check_in, special.fixed_check_out)
      : null;
  const minNights =
    special.date_mode === "fixed" ? fixedNights : (special.min_nights ?? null);
  const minStayLabel = minNights ? t("bkNights", { count: minNights }) : "—";
  const datesShort =
    special.date_mode === "fixed"
      ? `${fmtDate(special.fixed_check_in)} → ${fmtDate(special.fixed_check_out)}`
      : `${fmtDate(special.window_start)} – ${fmtDate(special.window_end)}`;
  const firstNight =
    special.date_mode === "fixed"
      ? special.fixed_check_in
      : special.window_start;
  const lastNight =
    special.date_mode === "fixed"
      ? special.fixed_check_out
      : special.window_end;
  const appliesTo = roomName ?? t("ddAppliesWhole");

  // ── "At a glance" tiles ──
  const nightsValue =
    special.date_mode === "fixed"
      ? fixedNights != null
        ? String(fixedNights)
        : "—"
      : special.min_nights
        ? special.max_nights
          ? `${special.min_nights}–${special.max_nights}`
          : `${special.min_nights}+`
        : "—";
  const stats: { label: string; value: string; highlight?: boolean }[] = [
    {
      label: t("dtStatGuests"),
      value: special.max_guests != null ? String(special.max_guests) : "—",
    },
    { label: t("dtStatNights"), value: nightsValue },
    {
      label: t("dtStatSave"),
      value: special.savings_pct ? `${special.savings_pct}%` : "—",
      highlight: true,
    },
    {
      label: t("dtStatBookBy"),
      value: special.book_by ? fmtDate(special.book_by) : "—",
    },
  ];

  const propertyHref = `/property/${property.slug}`;

  // In-page subnav — only link to sections that actually render.
  const navItems: DealNavItem[] = [
    { id: "sec-overview", label: t("ddNavOverview") },
    { id: "sec-offer", label: t("ddNavOffer") },
    { id: "sec-dates", label: t("ddNavDates") },
  ];
  if (rooms.length > 0)
    navItems.push({ id: "sec-rooms", label: t("ddNavRooms") });
  if (amenityKeys.length > 0)
    navItems.push({ id: "sec-amenities", label: t("ddNavAmenities") });
  navItems.push({ id: "sec-terms", label: t("ddNavTerms") });

  return (
    <div className="bg-white text-brand-ink">
      <SpecialTracker specialId={special.id} />
      <SiteHeader />

      {/* Meta ViewContent — DIRECTORY (Wielo) deal detail → Wielo pixel. */}
      <FirePixelEvent
        event="ViewContent"
        consentRequired={false}
        params={commerceParams({
          contentIds: [property.id],
          contentName: property.name,
          currency: special.currency,
          ...(amount != null ? { value: amount } : {}),
        })}
      />

      <main className="mx-auto max-w-[1180px] px-5 pb-28 pt-6 lg:px-8 lg:pb-14">
        {/* Breadcrumb + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap items-center gap-1.5 text-[12px] text-brand-mute">
            {property.province ? (
              <>
                <span>{property.province}</span>
                <ChevronRight className="h-3 w-3" />
              </>
            ) : null}
            <Link href={propertyHref} className="hover:text-brand-ink">
              {property.name}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-brand-ink">{special.title}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <ShareSpecialButton
              slug={params.slug}
              label={t("dtShare")}
              copiedLabel={t("dtShareCopied")}
              copiedToast={t("toastLinkCopied")}
              errorToast={t("toastLinkError")}
            />
          </div>
        </div>

        {/* Gallery hero + savings ribbon */}
        <div className="relative mt-5">
          {gallery.length > 0 ? (
            <PhotoGallery photos={gallery} />
          ) : (
            <div className="flex h-[300px] w-full items-center justify-center rounded-card border border-brand-line bg-brand-accent/30 text-brand-primary sm:h-[380px]">
              <Sparkles className="h-10 w-10" />
            </div>
          )}
          {special.savings_pct ? (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-3.5 py-1.5 font-display text-[15px] font-extrabold text-white shadow-lift">
              <Percent className="h-4 w-4" />
              {t("offPct", { pct: special.savings_pct })}
            </span>
          ) : null}
        </div>

        {/* Title block */}
        <div className="mt-6 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-3 py-1 text-[11.5px] font-bold text-brand-secondary">
              <Sparkles className="h-3.5 w-3.5" /> {t("dtBadge")}
            </span>
            {special.badge ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
                <Tag className="h-3 w-3" /> {special.badge}
              </span>
            ) : null}
            {categoryLabels.map((c: string) => (
              <span
                key={c}
                className="rounded-pill border border-brand-line bg-white px-2 py-0.5 text-[10px] font-medium text-brand-mute"
              >
                {c}
              </span>
            ))}
          </div>
          <h1 className="mt-2 font-display text-[28px] font-extrabold leading-tight tracking-tight text-brand-ink sm:text-[32px]">
            {special.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-brand-mute">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {locationLine || property.name}
              {hostName ? t("dtHostedBy", { host: hostName }) : ""}
            </span>
            <span className="hidden sm:inline">·</span>
            <Link
              href={propertyHref}
              className="inline-flex items-center gap-1.5 text-brand-primary hover:underline"
            >
              <Tag className="h-4 w-4" />
              {t("dtPartOf", { property: property.name })}
              {roomName ? ` · ${roomName}` : ""}
            </Link>
          </div>
        </div>

        {/* Sticky in-page subnav */}
        <DealSubnav items={navItems} />

        {/* Two-column */}
        <div className="mt-7 grid gap-9 lg:grid-cols-12 lg:gap-12">
          {/* LEFT */}
          <div className="min-w-0 lg:col-span-7 xl:col-span-8">
            {/* Overview — at a glance */}
            <section
              id="sec-overview"
              className="scroll-mt-32 border-b border-brand-line pb-8"
            >
              <h2 className="font-display text-[19px] font-bold text-brand-ink">
                {t("ddAtAGlance")}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[13px] border border-brand-line bg-white p-3.5"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                      {s.label}
                    </div>
                    <div
                      className={`num mt-1 font-display text-[19px] font-extrabold tabular-nums ${
                        s.highlight ? "text-brand-primary" : "text-brand-ink"
                      }`}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2.5 rounded-[13px] border border-brand-line bg-brand-light/70 px-4 py-3 text-[12.5px] text-brand-secondary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                <span>{t("ddNoFeeBanner", { brand: brandName })}</span>
              </div>
            </section>

            {/* The offer — what you get */}
            <section
              id="sec-offer"
              className="scroll-mt-32 border-b border-brand-line py-8"
            >
              <h2 className="font-display text-[19px] font-bold text-brand-ink">
                {t("ddWhatYouGet")}
              </h2>
              {special.description ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-dark">
                  {special.description}
                </p>
              ) : null}
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-accent text-brand-secondary">
                    <Tag className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-display font-semibold text-brand-ink">
                      {t("ddOfferPriceTitle")}
                    </div>
                    <div className="mt-0.5 text-[13px] leading-relaxed text-brand-mute">
                      {isFlat
                        ? t("ddOfferPriceBodyPkg")
                        : t("ddOfferPriceBodyNight")}
                    </div>
                  </div>
                </div>

                {special.savings_pct ? (
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-accent text-brand-secondary">
                      <Percent className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-display font-semibold text-brand-ink">
                        {t("ddOfferSaveTitle")}
                      </div>
                      <div className="mt-0.5 text-[13px] leading-relaxed text-brand-mute">
                        {t("ddOfferSaveBody", { pct: special.savings_pct })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {included.length > 0 ? (
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-accent text-brand-secondary">
                      <Gift className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-display font-semibold text-brand-ink">
                        {t("ddOfferIncludedTitle")}
                      </div>
                      <div className="mt-0.5 text-[13px] leading-relaxed text-brand-mute">
                        {t("ddOfferIncludedBody")}
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {included.map((name) => (
                          <li
                            key={name}
                            className="flex items-center gap-2 text-[13px] text-brand-ink"
                          >
                            <Check className="h-4 w-4 shrink-0 text-brand-primary" />
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Dates */}
            <section
              id="sec-dates"
              className="scroll-mt-32 border-b border-brand-line py-8"
            >
              <h2 className="flex items-center gap-2 font-display text-[19px] font-bold text-brand-ink">
                <CalendarDays className="h-4 w-4 text-brand-primary" />
                {t("dtDates")}
              </h2>
              {special.date_mode === "fixed" ? (
                <p className="mt-2 text-sm text-brand-ink">
                  {fmtDate(special.fixed_check_in)} →{" "}
                  {fmtDate(special.fixed_check_out)}{" "}
                  <span className="text-brand-mute">
                    (
                    {t("dtFixedNights", {
                      nights: nightsBetween(
                        special.fixed_check_in ?? "",
                        special.fixed_check_out ?? "",
                      ),
                    })}
                    )
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-brand-ink">
                  {t("dtFlexRange", {
                    start: fmtDate(special.window_start),
                    end: fmtDate(special.window_end),
                  })}
                  {special.min_nights
                    ? t("dtNightsRange", {
                        min: special.min_nights,
                        max: special.max_nights
                          ? `–${special.max_nights}`
                          : "+",
                      })
                    : ""}
                  .
                </p>
              )}
              <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-[13px] border border-brand-line bg-white p-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                    <Play className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                      {t("ddFirstNight")}
                    </div>
                    <div className="num font-display text-[14px] font-bold text-brand-ink">
                      {fmtDate(firstNight)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-[13px] border border-brand-line bg-white p-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-accent text-brand-secondary">
                    <Flag className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                      {t("ddLastNight")}
                    </div>
                    <div className="num font-display text-[14px] font-bold text-brand-ink">
                      {fmtDate(lastNight)}
                    </div>
                  </div>
                </div>
                {special.book_by ? (
                  <div className="flex items-center gap-3 rounded-[13px] border border-brand-line bg-white p-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-status-cancelled/10 text-status-cancelled">
                      <CalendarClock className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                        {t("ddRowBookBy")}
                      </div>
                      <div className="num font-display text-[14px] font-bold text-brand-ink">
                        {fmtDate(special.book_by)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Rooms in this deal */}
            {rooms.length > 0 ? (
              <section
                id="sec-rooms"
                className="scroll-mt-32 border-b border-brand-line py-8"
              >
                <h2 className="font-display text-[19px] font-bold text-brand-ink">
                  {t("ddRoomsTitle")}
                </h2>
                <p className="mt-1.5 text-[13px] text-brand-mute">
                  {special.room_id
                    ? t("ddRoomsIntroRoom")
                    : t("ddRoomsIntroWhole")}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {rooms.map((room) => (
                    <article
                      key={room.id}
                      className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card"
                    >
                      <div className="relative aspect-[16/9] bg-brand-accent">
                        {room.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={room.photoUrl}
                            alt={room.name}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-brand-primary">
                            <BedDouble className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="font-display font-bold text-brand-ink">
                          {room.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-brand-mute">
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {t("ddRoomSleeps", { count: room.maxGuests })}
                          </span>
                          {room.bedLabel ? (
                            <span className="inline-flex items-center gap-1.5">
                              <BedDouble className="h-3.5 w-3.5" />
                              {room.bedLabel}
                            </span>
                          ) : null}
                          {room.ensuite ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Check className="h-3.5 w-3.5 text-brand-primary" />
                              {t("ddRoomEnsuite")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Amenities */}
            {amenityKeys.length > 0 ? (
              <section
                id="sec-amenities"
                className="scroll-mt-32 border-b border-brand-line py-8"
              >
                <h2 className="font-display text-[19px] font-bold text-brand-ink">
                  {t("dtOffersTitle")}
                </h2>
                <div className="mt-4">
                  <AmenitiesList keys={amenityKeys} />
                </div>
              </section>
            ) : null}

            {/* Good to know — cancellation + part of property + report */}
            <section id="sec-terms" className="scroll-mt-32 py-8">
              <h2 className="font-display text-[19px] font-bold text-brand-ink">
                {t("ddNavTerms")}
              </h2>
              {note?.note ? (
                <div className="mt-4">
                  <div className="font-display text-sm font-semibold text-brand-ink">
                    {t("dtCancellation")}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-brand-mute">
                    {note.note}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 rounded-card border border-brand-line bg-white p-5 shadow-card">
                <h3 className="font-display text-base font-bold text-brand-ink">
                  {t("dtPartOfTitle", { property: property.name })}
                </h3>
                <p className="mt-1 text-sm text-brand-mute">
                  {t("dtPartOfBody")}
                </p>
                <Link
                  href={propertyHref}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
                >
                  {t("dtSeeListing")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-5">
                <ReportButton
                  targetType="deal"
                  targetId={special.id}
                  targetLabel={special.title}
                  triggerLabel={t("dtReport")}
                  triggerClassName="inline-flex items-center gap-1.5 text-xs font-medium text-brand-mute hover:text-brand-primary"
                />
              </div>
            </section>
          </div>

          {/* RIGHT — sticky deal summary */}
          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-card border border-brand-line bg-white p-6 shadow-lift">
                <div className="flex items-center justify-between">
                  {special.savings_pct ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-3 py-1 font-display text-[12px] font-extrabold text-white">
                      <Percent className="h-3.5 w-3.5" />
                      {t("offPct", { pct: special.savings_pct })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-light px-3 py-1 text-[11.5px] font-bold text-brand-secondary">
                      <Sparkles className="h-3.5 w-3.5" /> {t("dtBadge")}
                    </span>
                  )}
                </div>

                {amount != null ? (
                  <div className="mt-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-mute">
                      {priceLabel}
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      {special.was_price && special.savings_amount ? (
                        <span className="num text-[15px] text-brand-mute line-through">
                          <Money
                            amount={grossVat(
                              Number(special.was_price),
                              vatRate,
                            )}
                            currency={special.currency}
                            approx={false}
                          />
                        </span>
                      ) : null}
                      <span className="num font-display text-[30px] font-extrabold tracking-tight text-brand-ink">
                        <Money
                          amount={grossVat(amount, vatRate)}
                          currency={special.currency}
                        />
                      </span>
                      <span className="text-xs text-brand-mute">
                        {perLabel}
                      </span>
                    </div>
                    {special.was_price && special.savings_amount ? (
                      <div className="mt-1 text-[12px] text-brand-mute">
                        {t("dtSave")}{" "}
                        <span className="font-semibold text-brand-primary">
                          <Money
                            amount={grossVat(
                              Number(special.savings_amount),
                              vatRate,
                            )}
                            currency={special.currency}
                            approx={false}
                          />
                          {offSuffix}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 divide-y divide-brand-line rounded-[12px] border border-brand-line">
                  <div className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]">
                    <span className="text-brand-mute">{t("ddRowDates")}</span>
                    <span className="num font-medium text-brand-ink">
                      {datesShort}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]">
                    <span className="text-brand-mute">{t("ddRowMinStay")}</span>
                    <span className="font-medium text-brand-ink">
                      {minStayLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]">
                    <span className="text-brand-mute">
                      {t("ddRowAppliesTo")}
                    </span>
                    <span className="max-w-[55%] truncate text-right font-medium text-brand-ink">
                      {appliesTo}
                    </span>
                  </div>
                  {special.book_by ? (
                    <div className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]">
                      <span className="text-brand-mute">
                        {t("ddRowBookBy")}
                      </span>
                      <span className="num font-medium text-brand-ink">
                        {fmtDate(special.book_by)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {bookable && remaining <= 5 ? (
                  <p className="mt-4 text-xs font-medium text-amber-600">
                    {t("onlyLeft", { count: remaining })}
                  </p>
                ) : null}

                {bookable ? (
                  <Link
                    href={`/deal/${params.slug}/book?via=platform`}
                    data-special-book
                    className="mt-5 block rounded-pill bg-brand-primary px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
                  >
                    {t("dtBookCta")}
                  </Link>
                ) : (
                  <div className="mt-5 rounded-pill bg-brand-light px-5 py-3 text-center text-sm font-medium text-brand-mute">
                    {soldOut ? t("dtSoldOut") : t("dtUnavailable")}
                  </div>
                )}
                <p className="mt-2 text-center text-[11px] text-brand-mute">
                  {t("dtDirectNote")}
                </p>

                <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-brand-line bg-brand-light/60 p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                  <div className="text-[11px] leading-relaxed text-brand-mute">
                    {t("ddPanelReassure", { brand: brandName })}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
