import type { Metadata } from "next";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";
import {
  getCategoryBySlug,
  getDescendantIds,
} from "@/lib/taxonomy/getCategories";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vilo.co.za";
const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) {
    return { title: "Category not found · Vilo" };
  }
  const title = category.meta_title || `${category.label} · Vilo`;
  const description =
    category.meta_description ||
    category.description ||
    `${category.label} on Vilo — book direct with the host.`;
  const canonical = category.canonical_url || `${BASE_URL}/c/${category.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: category.og_image_url
        ? [{ url: category.og_image_url, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      card: category.og_image_url ? "summary_large_image" : "summary",
      title,
      description,
      images: category.og_image_url ? [category.og_image_url] : undefined,
    },
  };
}

export default async function CategoryLandingPage({
  params,
}: {
  params: { slug: string };
}) {
  const category = await getCategoryBySlug(params.slug);
  if (!category) notFound();

  const descendantIds = await getDescendantIds(category.id);
  const supabase = createServerClient();

  // Listings in this category OR any descendant. Fall back to the legacy
  // accommodation_type text column for pre-migration listings.
  const idList = `(${descendantIds.join(",")})`;
  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, slug, name, city, province, base_price, currency, max_guests, listing_type, accommodation_type, booking_mode, avg_rating, total_reviews, instant_booking, host:hosts!inner ( display_name, is_verified ), photos:listing_photos ( url, sort_order ), listing_rooms ( base_price, is_active, deleted_at )",
    )
    .eq("is_published", true)
    .is("deleted_at", null)
    .or(`category_id.in.${idList},accommodation_type.eq.${category.slug}`)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const total = listings?.length ?? 0;

  // FAQ JSON-LD
  const faqJsonLd =
    Array.isArray(category.faq) && category.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: category.faq.map((row) => ({
            "@type": "Question",
            name: row.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: row.a,
            },
          })),
        }
      : null;

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      {/* Dark hero card — canonical primary-page hero shell */}
      <section className="mx-auto max-w-7xl px-5 pt-8 lg:px-8 lg:pt-12">
        <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-dark via-brand-secondary to-brand-primary text-white shadow-card">
          {category.hero_image_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.hero_image_url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-brand-dark/85 via-brand-secondary/70 to-brand-primary/60" />
            </>
          ) : null}

          <div className="relative px-7 py-10 sm:px-10 sm:py-12">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Accommodation
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {category.label}
            </h1>
            {category.description ? (
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/85">
                {category.description}
              </p>
            ) : null}
            <div className="mt-5 text-sm text-white/70">
              {total} {total === 1 ? "place" : "places"} on Vilo
            </div>
          </div>
        </div>
      </section>

      {/* Intro markdown */}
      {category.intro_markdown ? (
        <section className="mx-auto max-w-3xl px-5 pt-10 lg:px-8 lg:pt-14">
          <div className="prose-vilo space-y-4">
            {splitParagraphs(category.intro_markdown).map((para, i) => (
              <p
                key={i}
                className="text-[15.5px] leading-relaxed text-brand-ink"
              >
                {para}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* Listings grid */}
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <h2 className="mb-5 font-display text-xl font-bold tracking-tight text-brand-ink md:text-2xl">
          {category.label} on Vilo
        </h2>

        {!listings || listings.length === 0 ? (
          <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
            <h3 className="font-display text-lg font-bold text-brand-ink">
              No listings yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
              Be the first to host a {category.label.toLowerCase()} on Vilo.{" "}
              <Link
                href="/signup/host"
                className="text-brand-primary underline-offset-2 hover:underline"
              >
                Become a host →
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => {
              const photos =
                (l.photos as Array<{
                  url: string;
                  sort_order: number;
                }> | null) ?? [];
              const hero = photos.sort(
                (a, b) => a.sort_order - b.sort_order,
              )[0];
              const host = l.host as unknown as {
                display_name: string;
                is_verified: boolean;
              };
              const location = [l.city, l.province].filter(Boolean).join(", ");
              const rooms =
                (l.listing_rooms as Array<{
                  base_price: number;
                  is_active: boolean | null;
                  deleted_at: string | null;
                }> | null) ?? [];
              let amount: number | null = null;
              let fromLabel = false;
              const perLabel = "/ night";
              if (l.booking_mode === "rooms_only") {
                const prices = rooms
                  .filter((r) => r.is_active !== false && r.deleted_at == null)
                  .map((r) => Number(r.base_price))
                  .filter((p) => p > 0);
                amount = prices.length > 0 ? Math.min(...prices) : null;
                fromLabel = true;
              } else if (l.base_price != null) {
                amount = Number(l.base_price);
              }
              return (
                <Link
                  key={l.id}
                  href={`/listing/${l.slug}`}
                  className="group overflow-hidden rounded-card"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-brand-accent">
                    {hero ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero.url}
                        alt={l.name}
                        className="card-img absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-brand-mute">
                        <MapPin className="h-10 w-10" />
                      </div>
                    )}
                    {l.instant_booking ? (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
                        Instant
                      </span>
                    ) : null}
                    {host.is_verified ? (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/90 px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                        <BadgeCheck className="h-3 w-3" />
                        Verified
                      </span>
                    ) : null}
                  </div>
                  <div className="pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-display font-semibold text-brand-ink group-hover:text-brand-secondary">
                          {l.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-brand-mute">
                          {location || category.label}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs">
                        {l.avg_rating != null &&
                        l.total_reviews != null &&
                        l.total_reviews > 0 ? (
                          <>
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="font-semibold text-brand-ink">
                              {Number(l.avg_rating).toFixed(1)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {amount != null ? (
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="num font-display font-bold text-brand-ink">
                          {fromLabel ? "from " : ""}
                          {fmtR(amount, l.currency)}
                        </span>
                        <span className="text-xs text-brand-mute">
                          {perLabel}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {total >= PAGE_SIZE ? (
          <div className="mt-10 text-center">
            <Link
              href={`/explore?type=${category.slug}`}
              className="inline-flex h-10 items-center rounded-pill bg-brand-primary px-5 text-sm font-semibold text-white hover:bg-brand-secondary"
            >
              See all {category.label} on Vilo →
            </Link>
          </div>
        ) : null}
      </main>

      {/* FAQ section */}
      {Array.isArray(category.faq) && category.faq.length > 0 ? (
        <section className="border-t border-brand-line bg-white">
          <div className="mx-auto max-w-3xl px-5 py-12 lg:px-8 lg:py-16">
            <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink md:text-2xl">
              Frequently asked
            </h2>
            <dl className="mt-6 space-y-5">
              {category.faq.map((row, i) => (
                <div
                  key={i}
                  className="rounded-card border border-brand-line bg-brand-light/40 p-5"
                >
                  <dt className="font-display font-semibold text-brand-ink">
                    {row.q}
                  </dt>
                  <dd className="mt-1.5 text-[14.5px] leading-relaxed text-brand-mute">
                    {row.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <SiteFooter />
    </div>
  );
}

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function splitParagraphs(input: string): string[] {
  return input
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
