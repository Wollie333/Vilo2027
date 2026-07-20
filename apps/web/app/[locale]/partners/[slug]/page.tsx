import type { Metadata } from "next";
import { ArrowRight, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { getBrandName } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

// Co-branded partner landing page (WS-1.7). Unauthenticated, public. A partner
// (affiliate) points their audience here; the primary CTA links to the
// locale-free /r/<slug> route — the ONLY cookie-dropping path — so a click lands
// the referral attribution just as the raw link would. An optional ?c=<campaign>
// is forwarded to /r so the referral is tagged to that campaign.
//
// No PII beyond what the partner set on their own account (headline, bio, photo).
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wielo.co.za";

type PartnerAccount = {
  id: string;
  slug: string;
  status: string;
  display_headline: string | null;
  bio: string | null;
  photo_url: string | null;
  user_id: string;
};

async function getPartner(slug: string): Promise<PartnerAccount | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("affiliate_accounts")
    .select("id, slug, status, display_headline, bio, photo_url, user_id")
    .ilike("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return data as PartnerAccount;
}

// The partner's chosen public name: full_name, falling back to the slug.
async function getPartnerName(userId: string, slug: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.full_name ?? "").trim() || slug;
}

function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const partner = await getPartner(params.slug);
  if (!partner) return { title: "Partner not found" };
  const brandName = await getBrandName();
  const name = await getPartnerName(partner.user_id, partner.slug);
  const title =
    partner.display_headline?.trim() || `${name} · ${brandName} partner`;
  return {
    title,
    description:
      partner.bio?.trim() ||
      `Run your place on ${brandName}, commission-free. Invited by ${name}.`,
    alternates: { canonical: `${BASE_URL}/partners/${partner.slug}` },
  };
}

export default async function PartnerLandingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { c?: string };
}) {
  const partner = await getPartner(params.slug);
  if (!partner) notFound();

  const brandName = await getBrandName();
  const name = await getPartnerName(partner.user_id, partner.slug);

  const headline =
    partner.display_headline?.trim() ||
    `Run your place on ${brandName}, commission-free`;
  const bio = partner.bio?.trim() || null;
  const photo = partner.photo_url?.trim() || null;

  // Forward an optional campaign tag to the cookie-dropping route.
  const campaign = searchParams.c?.trim();
  const ctaHref = campaign
    ? `/r/${partner.slug}?c=${encodeURIComponent(campaign)}`
    : `/r/${partner.slug}`;

  const perks = [
    {
      icon: <Wallet className="h-4 w-4" />,
      title: "Zero booking commission",
      body: `Keep every rand of every booking. ${brandName} charges no per-booking fee.`,
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: "Direct bookings, your brand",
      body: "Your own booking site, calendar, payments and guest messaging in one place.",
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      title: "South-African built",
      body: "Rand pricing, local payment rails and support that knows the market.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-brand-line bg-gradient-to-br from-[#FAFCFB] to-white">
          <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="shrink-0">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={name}
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-brand-accent sm:h-24 sm:w-24"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-accent font-display text-2xl font-bold text-brand-secondary ring-2 ring-brand-accent sm:h-24 sm:w-24">
                    {initial(name)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-mute">
                  <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                  {name} invites you
                </div>
                <h1 className="mt-2 text-2xl font-bold leading-tight text-brand-ink sm:text-4xl">
                  {headline}
                </h1>
                {bio ? (
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-brand-mute">
                    {bio}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-8">
              <a
                href={ctaHref}
                className="inline-flex h-12 items-center gap-2 rounded-pill bg-brand-primary px-7 text-[15px] font-semibold text-white transition hover:bg-brand-secondary"
              >
                Get started on {brandName}
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="mt-2.5 text-[12.5px] text-brand-mute">
                Free to explore. No booking commission, ever.
              </p>
            </div>
          </div>
        </section>

        {/* Why the platform */}
        <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
          <h2 className="font-display text-lg font-bold text-brand-ink sm:text-xl">
            Why hosts choose {brandName}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {perks.map((perk) => (
              <div
                key={perk.title}
                className="rounded-card border border-brand-line bg-white p-5 shadow-card"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-brand-primary">
                  {perk.icon}
                </div>
                <h3 className="mt-3 font-display text-[15px] font-bold text-brand-ink">
                  {perk.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-brand-mute">
                  {perk.body}
                </p>
              </div>
            ))}
          </div>

          {/* Closing CTA */}
          <div className="mt-10 flex flex-col items-start gap-4 rounded-card border border-brand-line bg-brand-secondary p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h3 className="font-display text-lg font-bold text-white sm:text-xl">
                Ready to take direct bookings?
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-accent">
                Set up your place and start welcoming guests, commission-free.
              </p>
            </div>
            <a
              href={ctaHref}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-pill bg-white px-7 text-[15px] font-semibold text-brand-secondary transition hover:bg-brand-accent"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
