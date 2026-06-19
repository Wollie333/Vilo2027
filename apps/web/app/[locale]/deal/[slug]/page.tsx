import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  MapPin,
  Moon,
  Percent,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";

import { Money } from "@/components/currency/Money";
import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { Link } from "@/i18n/navigation";
import { nightsBetween } from "@/lib/pricing/engine";
import {
  cancellationNote,
  getListingPolicySummary,
} from "@/lib/policy/listing-summary";
import { specialCategoryLabel } from "@/lib/specials/categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { websiteAssetUrl } from "@/lib/website/assets";

import { AmenitiesList } from "@/app/[locale]/property/[slug]/AmenitiesList";
import {
  PhotoGallery,
  type GalleryPhoto,
} from "@/app/[locale]/property/[slug]/PhotoGallery";

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
      "id, slug, host_id, name, city, province, country, accommodation_type, deleted_at",
    )
    .eq("id", special.property_id)
    .maybeSingle();
  if (!property || property.deleted_at) return null;

  let roomName: string | null = null;
  if (special.room_id) {
    const { data: room } = await admin
      .from("property_rooms")
      .select("name")
      .eq("id", special.room_id)
      .maybeSingle();
    roomName = room?.name ?? null;
  }

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
    gallery,
    amenityKeys,
    included,
    hostName,
  } = loaded;
  const t = await getTranslations("specials");
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
  const perLabel =
    special.price_mode === "flat" ? t("dtPackageTotal") : t("dtPerNight");

  // ── Stats grid (mirrors the room view's tiles). ──
  const nightsValue =
    special.date_mode === "fixed"
      ? special.fixed_check_in && special.fixed_check_out
        ? String(nightsBetween(special.fixed_check_in, special.fixed_check_out))
        : "—"
      : special.min_nights
        ? special.max_nights
          ? `${special.min_nights}–${special.max_nights}`
          : `${special.min_nights}+`
        : "—";
  const stats: { icon: typeof Users; label: string; value: string }[] = [
    {
      icon: Users,
      label: t("dtStatGuests"),
      value: special.max_guests != null ? String(special.max_guests) : "—",
    },
    { icon: Moon, label: t("dtStatNights"), value: nightsValue },
    {
      icon: Percent,
      label: t("dtStatSave"),
      value: special.savings_pct ? `${special.savings_pct}%` : "—",
    },
    {
      icon: CalendarClock,
      label: t("dtStatBookBy"),
      value: special.book_by ? fmtDate(special.book_by) : "—",
    },
  ];

  const propertyHref = `/property/${property.slug}`;

  return (
    <div className="bg-brand-light text-brand-ink">
      <SpecialTracker specialId={special.id} />
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 pb-28 pt-6 lg:px-8 lg:pb-12 lg:pt-8">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1 text-xs text-brand-mute">
          {property.province ? (
            <>
              <span>{property.province}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          ) : null}
          <Link href={propertyHref} className="hover:text-brand-primary">
            {property.name}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-brand-ink">{special.title}</span>
        </nav>

        {/* Header */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2.5 py-0.5 text-[11px] font-semibold text-white">
                <Sparkles className="h-3 w-3" /> {t("dtBadge")}
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
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
              {special.title}
            </h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-brand-mute">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {locationLine || property.name}
              {hostName ? t("dtHostedBy", { host: hostName }) : ""}
            </p>
            <Link
              href={propertyHref}
              className="mt-0.5 inline-block text-sm text-brand-primary hover:underline"
            >
              {t("dtPartOf", { property: property.name })}
              {roomName ? ` · ${roomName}` : ""}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ShareSpecialButton
              slug={params.slug}
              label={t("dtShare")}
              copiedLabel={t("dtShareCopied")}
              copiedToast={t("toastLinkCopied")}
              errorToast={t("toastLinkError")}
            />
          </div>
        </div>

        {/* Gallery */}
        {gallery.length > 0 ? (
          <div className="mt-5">
            <PhotoGallery photos={gallery} />
          </div>
        ) : (
          <div className="mt-5 flex h-56 w-full items-center justify-center rounded-card border border-brand-line bg-brand-accent/30 text-brand-primary">
            <Sparkles className="h-10 w-10" />
          </div>
        )}

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-card border border-brand-line bg-white p-4 shadow-card"
            >
              <s.icon className="h-5 w-5 text-brand-primary" />
              <div className="num mt-2 font-display text-lg font-bold tabular-nums text-brand-ink">
                {s.value}
              </div>
              <div className="text-xs text-brand-mute">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          {/* Left column */}
          <div className="space-y-8">
            {/* About */}
            {special.description ? (
              <section>
                <h2 className="font-display text-lg font-bold text-brand-ink">
                  {t("dtAboutTitle")}
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-dark">
                  {special.description}
                </p>
              </section>
            ) : null}

            {/* What's included */}
            {included.length > 0 ? (
              <section className="border-t border-brand-line pt-8">
                <h2 className="font-display text-lg font-bold text-brand-ink">
                  {t("dtIncluded")}
                </h2>
                <ul className="mt-4 space-y-2">
                  {included.map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-2 text-sm text-brand-ink"
                    >
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      {name}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Dates */}
            <section className="border-t border-brand-line pt-8">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-brand-ink">
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
              {special.book_by ? (
                <p className="mt-1 text-xs text-brand-mute">
                  {t("dtBookBy", { date: fmtDate(special.book_by) })}
                </p>
              ) : null}
            </section>

            {/* What this place offers */}
            {amenityKeys.length > 0 ? (
              <section className="border-t border-brand-line pt-8">
                <h2 className="font-display text-lg font-bold text-brand-ink">
                  {t("dtOffersTitle")}
                </h2>
                <div className="mt-4">
                  <AmenitiesList keys={amenityKeys} />
                </div>
              </section>
            ) : null}

            {/* Cancellation */}
            {note?.note ? (
              <section className="border-t border-brand-line pt-8">
                <h2 className="font-display text-lg font-bold text-brand-ink">
                  {t("dtCancellation")}
                </h2>
                <p className="mt-2 text-sm text-brand-mute">{note.note}</p>
              </section>
            ) : null}

            {/* Part of property */}
            <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
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
            </section>

            <div>
              <Link
                href="/help"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-mute hover:text-brand-primary"
              >
                <Flag className="h-3.5 w-3.5" />
                {t("dtReport")}
              </Link>
            </div>
          </div>

          {/* Right column — sticky CTA panel */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="space-y-3 rounded-card border border-brand-line bg-white p-5 shadow-card">
              {amount != null ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="num font-display text-2xl font-extrabold text-brand-ink">
                      <Money amount={amount} currency={special.currency} />
                    </span>
                    <span className="text-xs text-brand-mute">{perLabel}</span>
                  </div>
                  {special.was_price && special.savings_amount ? (
                    <p className="mt-1 text-sm font-semibold text-emerald-600">
                      {t("dtSave")}{" "}
                      <Money
                        amount={Number(special.savings_amount)}
                        currency={special.currency}
                        approx={false}
                      />
                      {special.savings_pct
                        ? t("dtOffParen", { pct: special.savings_pct })
                        : ""}
                      <span className="ml-1 font-normal text-brand-mute line-through">
                        <Money
                          amount={Number(special.was_price)}
                          currency={special.currency}
                          approx={false}
                        />
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {bookable && remaining <= 5 ? (
                <p className="text-xs font-medium text-amber-600">
                  {t("onlyLeft", { count: remaining })}
                </p>
              ) : null}

              {bookable ? (
                <Link
                  href={`/deal/${params.slug}/book?via=platform`}
                  data-special-book
                  className="block rounded-pill bg-brand-primary px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
                >
                  {t("dtBookCta")}
                </Link>
              ) : (
                <div className="rounded-pill bg-brand-light px-5 py-3 text-center text-sm font-medium text-brand-mute">
                  {soldOut ? t("dtSoldOut") : t("dtUnavailable")}
                </div>
              )}
              <p className="text-center text-[11px] text-brand-mute">
                {t("dtDirectNote")}
              </p>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
