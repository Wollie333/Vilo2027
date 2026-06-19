import type { Metadata } from "next";
import { CalendarDays, Check, MapPin, Sparkles, Tag } from "lucide-react";
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

import { SpecialTracker } from "./_components/SpecialTracker";

export const dynamic = "force-dynamic";

const todayISO = () => new Date().toISOString().slice(0, 10);

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
      "id, host_id, name, city, province, accommodation_type, deleted_at, photos:property_photos ( url, sort_order )",
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
  if (!loaded) return { title: "Special not found" };
  return {
    title: `${loaded.special.title} — special`,
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
  const { special, property, roomName, included, hostName } = loaded;

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

  const heroUrl =
    websiteAssetUrl(special.hero_image_path) ??
    [...(property.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]
      ?.url ??
    null;
  const place = [property.city, property.province].filter(Boolean).join(", ");
  const categoryLabels = (special.categories ?? []).map((c: string) =>
    specialCategoryLabel(c),
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
    special.price_mode === "flat" ? "package total" : "per night";

  return (
    <div className="bg-white text-brand-ink">
      <SpecialTracker specialId={special.id} />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
        <Link
          href="/specials"
          className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
        >
          ← All specials
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* details */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-brand-line">
              {heroUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroUrl}
                  alt={special.title}
                  className="h-64 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center bg-brand-accent text-brand-primary">
                  <Sparkles className="h-12 w-12" />
                </div>
              )}
              <div className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {special.badge ? (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-brand-accent px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
                      <Tag className="h-3 w-3" /> {special.badge}
                    </span>
                  ) : null}
                  {categoryLabels.map((c: string) => (
                    <span
                      key={c}
                      className="rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand-mute"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <h1 className="font-display text-2xl font-extrabold text-brand-ink">
                  {special.title}
                </h1>
                <p className="flex items-center gap-1 text-sm text-brand-mute">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {property.name}
                  {roomName ? ` · ${roomName}` : ""}
                  {place ? ` · ${place}` : ""}
                  {hostName ? ` · hosted by ${hostName}` : ""}
                </p>
                {special.description ? (
                  <p className="whitespace-pre-line pt-1 text-sm text-brand-ink/80">
                    {special.description}
                  </p>
                ) : null}
              </div>
            </div>

            {/* dates */}
            <section className="space-y-2 rounded-2xl border border-brand-line p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <CalendarDays className="h-4 w-4" /> Dates
              </h2>
              {special.date_mode === "fixed" ? (
                <p className="text-sm text-brand-ink">
                  {special.fixed_check_in} → {special.fixed_check_out}{" "}
                  <span className="text-brand-mute">
                    (
                    {nightsBetween(
                      special.fixed_check_in ?? "",
                      special.fixed_check_out ?? "",
                    )}{" "}
                    nights — fixed dates)
                  </span>
                </p>
              ) : (
                <p className="text-sm text-brand-ink">
                  Book any stay between {special.window_start} and{" "}
                  {special.window_end}
                  {special.min_nights
                    ? ` · ${special.min_nights}${
                        special.max_nights ? `–${special.max_nights}` : "+"
                      } nights`
                    : ""}
                  .
                </p>
              )}
              {special.book_by ? (
                <p className="text-xs text-brand-mute">
                  Book by {special.book_by}.
                </p>
              ) : null}
            </section>

            {/* what's included */}
            {included.length > 0 ? (
              <section className="space-y-2 rounded-2xl border border-brand-line p-5">
                <h2 className="text-sm font-semibold text-brand-ink">
                  What&apos;s included
                </h2>
                <ul className="space-y-1.5">
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

            {note?.note ? (
              <section className="rounded-2xl border border-brand-line p-5">
                <h2 className="text-sm font-semibold text-brand-ink">
                  Cancellation
                </h2>
                <p className="mt-1 text-sm text-brand-mute">{note.note}</p>
              </section>
            ) : null}
          </div>

          {/* CTA panel */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-3 rounded-2xl border border-brand-line p-5 shadow-card">
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
                      Save{" "}
                      <Money
                        amount={Number(special.savings_amount)}
                        currency={special.currency}
                        approx={false}
                      />
                      {special.savings_pct
                        ? ` (${special.savings_pct}% off)`
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
                  Only {remaining} left
                </p>
              ) : null}

              {bookable ? (
                <Link
                  href={`/special/${params.slug}/book?via=platform`}
                  data-special-book
                  className="block rounded-pill bg-brand-primary px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
                >
                  Book this special
                </Link>
              ) : (
                <div className="rounded-pill bg-brand-light px-5 py-3 text-center text-sm font-medium text-brand-mute">
                  {soldOut ? "Sold out" : "No longer available"}
                </div>
              )}
              <p className="text-center text-[11px] text-brand-mute">
                You book directly with the host.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
