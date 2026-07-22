import type { Metadata } from "next";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  Check,
  CheckCircle2,
  CreditCard,
  Gift,
  Globe,
  HandHeart,
  Headphones,
  ImagePlus,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  PartyPopper,
  PhoneCall,
  Quote,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  Unlink,
  UserX,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { notFound } from "next/navigation";

import { getBrandName } from "@/lib/brand";
import { SITE_URL } from "@/lib/contact";
import { createAdminClient } from "@/lib/supabase/admin";

import { PartnerCalculator } from "./_components/PartnerCalculator";
import { PartnerLeadForm } from "./_components/PartnerLeadForm";

// Co-branded partner landing page. Public, unauthenticated — a partner points
// their audience here and every CTA routes through /r/<slug>, the only
// cookie-dropping path, so the referral attributes exactly as the raw link does.
//
// What is REAL on this page, and what is not, was a deliberate decision:
//   • The partner's name, photo, message, community and phone are their own.
//   • The offer and campaign name come from affiliate_campaigns, so a finished
//     campaign cannot keep advertising a dead deal.
//   • Testimonials are REAL published reviews, anonymised to "Verified guest".
//     The section does not render at all below MIN_REVIEWS rather than pad
//     itself with invented hosts.
//   • The mockup this was built from also carried a ticker that GENERATED
//     random host earnings in the browser ("Host in Knysna kept R1,450"). It is
//     not here and must not come back: it fabricated social proof on a page
//     carrying a real person's name and face.
export const dynamic = "force-dynamic";

/** Below this many real reviews the section is hidden rather than padded. */
const MIN_REVIEWS = 3;

type PartnerAccount = {
  id: string;
  slug: string;
  status: string;
  display_headline: string | null;
  bio: string | null;
  photo_url: string | null;
  community_name: string | null;
  community_members: number | null;
  region: string | null;
  public_phone: string | null;
  user_id: string;
};

type CampaignInfo = {
  slug: string;
  name: string;
  hostOffer: string | null;
  endsAt: string | null;
};

type PublicReview = {
  id: string;
  rating: number;
  body: string;
  property: string;
  place: string;
};

async function getPartner(slug: string): Promise<PartnerAccount | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("affiliate_accounts")
    .select(
      "id, slug, status, display_headline, bio, photo_url, community_name, community_members, region, public_phone, user_id",
    )
    .ilike("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  return data as PartnerAccount;
}

async function getPartnerName(userId: string, slug: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return (data?.full_name ?? "").trim() || slug;
}

// The campaign this page is selling. An explicit ?c= wins; otherwise the
// partner's own live enrollment. A paused or withdrawn enrollment resolves to
// null, so a partner who is out of the race stops advertising it.
async function getCampaign(
  affiliateId: string,
  requested: string | undefined,
): Promise<CampaignInfo | null> {
  const admin = createAdminClient();
  const now = Date.now();
  const cols = "slug, name, status, host_offer, starts_at, ends_at";

  type Row = {
    slug: string;
    name: string;
    status: string;
    host_offer: string | null;
    starts_at: string | null;
    ends_at: string | null;
  };

  const usable = (c: Row): CampaignInfo | null => {
    if (c.status !== "active") return null;
    if (c.starts_at && Date.parse(c.starts_at) > now) return null;
    if (c.ends_at && Date.parse(c.ends_at) <= now) return null;
    return {
      slug: c.slug,
      name: c.name,
      hostOffer: c.host_offer?.trim() || null,
      endsAt: c.ends_at,
    };
  };

  if (requested) {
    const { data } = await admin
      .from("affiliate_campaigns")
      .select(cols)
      .ilike("slug", requested)
      .maybeSingle();
    return data ? usable(data as Row) : null;
  }

  const { data: enrolment } = await admin
    .from("affiliate_campaign_enrollments")
    .select("campaign_id")
    .eq("affiliate_id", affiliateId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!enrolment) return null;

  const { data } = await admin
    .from("affiliate_campaigns")
    .select(cols)
    .eq("id", enrolment.campaign_id)
    .maybeSingle();
  return data ? usable(data as Row) : null;
}

// Real reviews only, anonymised. A guest wrote these about a host — neither
// agreed to be marketing on a third party's referral page, so no guest name and
// no host name travel here, only the property and its town.
async function getReviews(): Promise<PublicReview[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reviews")
    .select("id, rating, body, property_id")
    .eq("is_published", true)
    .eq("flagged", false)
    .gte("rating", 4)
    .not("body", "is", null)
    .order("rating", { ascending: false })
    .limit(6);

  const rows = (data ?? []) as {
    id: string;
    rating: number;
    body: string | null;
    property_id: string;
  }[];
  const usable = rows.filter((r) => (r.body ?? "").trim().length > 40);
  if (usable.length === 0) return [];

  const { data: props } = await admin
    .from("properties")
    .select("id, name, city, province")
    .in("id", [...new Set(usable.map((r) => r.property_id))]);

  type Prop = {
    id: string;
    name: string;
    city: string | null;
    province: string | null;
  };
  const byId = new Map(((props ?? []) as Prop[]).map((p) => [p.id, p]));

  return usable.slice(0, 3).map((r) => {
    const p = byId.get(r.property_id);
    return {
      id: r.id,
      rating: Math.min(5, Math.max(1, r.rating)),
      body: (r.body ?? "").trim(),
      property: p?.name ?? "A property on the platform",
      place: [p?.city, p?.province].filter(Boolean).join(" · "),
    };
  });
}

/**
 * A real published property photo — the product showing its own work.
 *
 * Picks the property with the MOST photos rather than simply the first one.
 * "First published property" put a half-finished test listing (one image, and
 * that image a portrait of a person) into the hero of every partner's page. A
 * well-photographed listing is the best available proxy for a real, finished
 * one, and it degrades to a gradient rather than to something embarrassing.
 */
async function getHeroPhoto(): Promise<string | null> {
  const admin = createAdminClient();
  const { data: props } = await admin
    .from("properties")
    .select("id")
    .eq("is_published", true)
    .eq("is_suspended", false)
    .is("deleted_at", null)
    .limit(50);
  const ids = ((props ?? []) as { id: string }[]).map((p) => p.id);
  if (ids.length === 0) return null;

  const { data: photos } = await admin
    .from("property_photos")
    .select("property_id, url, sort_order")
    .in("property_id", ids)
    .order("sort_order", { ascending: true });

  const byProperty = new Map<string, string[]>();
  for (const p of (photos ?? []) as {
    property_id: string;
    url: string | null;
  }[]) {
    if (!p.url) continue;
    const list = byProperty.get(p.property_id) ?? [];
    list.push(p.url);
    byProperty.set(p.property_id, list);
  }

  let best: string[] = [];
  for (const list of byProperty.values()) {
    if (list.length > best.length) best = list;
  }
  // A single-photo listing is almost certainly a stub — prefer nothing.
  return best.length >= 3 ? (best[0] ?? null) : null;
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
  return {
    title: `Keep every rand · List on ${brandName} · Invited by ${name}`,
    description:
      partner.bio?.trim() ||
      `Run your place on ${brandName}, commission-free. Invited by ${name}.`,
    alternates: { canonical: `${SITE_URL}/partners/${partner.slug}` },
  };
}

const FEATURES = [
  {
    Icon: Wallet,
    t: "Keep 100% of payouts",
    d: "Guest pays R1,000, you get R1,000 — no commission or service fee, ever.",
  },
  {
    Icon: Users,
    t: "Own your guest list",
    d: "Full guest details stay with you. Build a repeat, direct-booking business.",
  },
  {
    Icon: MessageSquare,
    t: "Direct messaging",
    d: "Talk to guests directly, with saved replies and check-in automations.",
  },
  {
    Icon: CalendarCheck,
    t: "Bookings & calendar",
    d: "Instant or request-to-book, synced with your existing calendars.",
  },
  {
    Icon: CreditCard,
    t: "Direct payments",
    d: "Card or EFT settling straight to your bank via Paystack — no middle cut.",
  },
  {
    Icon: Smartphone,
    t: "Mobile-perfect",
    d: "Most guests book on their phone. Your pages are built for it.",
  },
  {
    Icon: ImageIcon,
    t: "Listings that sell",
    d: "Photo-first pages with your own shareable link for socials & WhatsApp.",
  },
  {
    Icon: BarChart3,
    t: "Clear reporting",
    d: "Occupancy, revenue and payout reports — every cent accounted for.",
  },
  {
    Icon: Headphones,
    t: "Real human help",
    d: "South-African support from people who know the market.",
  },
];

const COMPARISON = [
  { n: "NightsBridge", v: [1, 0, 0, 1, 1] },
  { n: "Booking.com", v: [0, 1, 0, 0, 0] },
  { n: "Airbnb", v: [0, 1, 0, 0, 0] },
  { n: "LekkeSlaap", v: [0, 1, 0, 0, 1] },
  { n: "Lodgify", v: [1, 0, 1, 1, 0] },
  { n: "Web agency", v: [0, 0, 1, 0, 0] },
];

const FAQ = [
  {
    q: "If I leave Booking.com, won't I lose bookings?",
    a: "You're not leaving — you're adding a direct channel alongside it. Keep your listings for discovery. This is for every guest who already knows you.",
  },
  {
    q: "I'm not good with technology.",
    a: "Setup asks for photos, rates and a description, and takes about ten minutes. If you can send a WhatsApp you can do this, and there is a real person on support if you get stuck.",
  },
  {
    q: "I can't afford another subscription.",
    a: "You're replacing a cost rather than adding one. If you take even a few direct bookings a month that would otherwise have paid commission, the subscription has already paid for itself. The calculator above uses your own numbers.",
  },
  {
    q: "How do I know this actually works?",
    a: "Run the calculator with your real nightly rate and real occupancy. The saving is simply the commission you already pay — nothing on this page asks you to take our word for it.",
  },
  {
    q: "Do guests still prefer the big platforms?",
    a: "Some will, and that's fine — keep those listings. What changes is that every guest who already knows you can book at zero commission instead of costing you a cut.",
  },
];

export default async function PartnerLandingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { c?: string };
}) {
  const partner = await getPartner(params.slug);
  if (!partner) notFound();

  const [brandName, name, campaign, reviews, heroPhoto] = await Promise.all([
    getBrandName(),
    getPartnerName(partner.user_id, partner.slug),
    getCampaign(partner.id, searchParams.c?.trim() || undefined),
    getReviews(),
    getHeroPhoto(),
  ]);

  const firstName = name.split(/\s+/)[0] ?? name;
  const message = partner.bio?.trim() || null;
  const photo = partner.photo_url?.trim() || null;
  const phone = partner.public_phone?.trim() || null;
  const telHref = phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : null;
  const offer = campaign?.hostOffer ?? null;

  const ctaHref = campaign
    ? `/r/${partner.slug}?c=${encodeURIComponent(campaign.slug)}`
    : `/r/${partner.slug}`;

  const community = partner.community_name?.trim() || null;
  const members = partner.community_members ?? null;
  const roleLine = [community, partner.region?.trim()]
    .filter(Boolean)
    .join(" · ");

  const yes = <Check className="mx-auto h-4 w-4 text-brand-primary" />;
  const no = <X className="mx-auto h-4 w-4 text-[#C7CDD4]" />;

  return (
    <div className="bg-[#F5FAF7] text-brand-ink">
      {campaign ? (
        <div className="bg-brand-secondary px-4 py-2.5 text-center text-[12.5px] font-semibold text-white">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#34E5A0]" />
            <span>
              The {campaign.name} is live
              {offer ? (
                <>
                  {" — "}
                  <span className="text-[#34E5A0]">{offer}</span> for beta hosts
                </>
              ) : null}
              . Places are limited.
            </span>
          </span>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-brand-line bg-white/85 px-5 backdrop-blur lg:px-10">
        <a href="#top" className="flex items-center gap-2.5 no-underline">
          <span className="font-display text-[18px] font-bold tracking-tight text-brand-ink">
            {brandName}
          </span>
        </a>
        <span className="ml-1 hidden items-center gap-2 rounded-pill border border-brand-line bg-brand-light px-3 py-1 text-[12px] font-semibold text-brand-secondary md:inline-flex">
          <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" /> Invited by{" "}
          {firstName}
        </span>
        <nav className="ml-auto mr-2 hidden items-center gap-6 text-[13.5px] font-semibold text-brand-mute lg:flex">
          <a href="#problem" className="no-underline hover:text-brand-ink">
            The problem
          </a>
          <a href="#calc" className="no-underline hover:text-brand-ink">
            Calculator
          </a>
          <a href="#included" className="no-underline hover:text-brand-ink">
            What&rsquo;s included
          </a>
        </nav>
        {telHref ? (
          <a
            href={telHref}
            className="ml-auto mr-1 hidden items-center gap-2 text-[13px] font-bold text-brand-secondary no-underline hover:text-brand-primary md:inline-flex lg:ml-0"
          >
            <PhoneCall className="h-4 w-4 text-brand-primary" />
            {phone}
          </a>
        ) : null}
        <a
          href="#signup"
          className="ml-auto inline-flex h-10 items-center justify-center rounded-pill bg-brand-primary px-5 text-[13.5px] font-bold text-white no-underline hover:bg-brand-secondary md:ml-0"
        >
          Start free
        </a>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-brand-line">
          <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 pt-14 lg:grid-cols-[1.02fr_.98fr] lg:gap-16 lg:px-10 lg:pt-20">
            <div className="pb-14 lg:pb-20">
              <div className="inline-flex items-center gap-2 rounded-pill border border-brand-line bg-white px-3.5 py-1.5 text-[12px] font-semibold text-brand-secondary">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-primary" />
                Invited by {name}
              </div>
              <h1 className="mt-6 font-display text-[42px] font-extrabold leading-[.96] tracking-tight text-brand-ink sm:text-[62px]">
                Your guests.
                <br />
                Your revenue.
                <br />
                <span className="text-brand-primary">Your business.</span>
              </h1>
              <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-brand-mute">
                Stop paying commission on bookings you earned. Get your own
                professional website, a curated directory listing, and a full
                booking system —{" "}
                <span className="font-semibold text-brand-ink">
                  one subscription, zero commission, full access to every guest.
                </span>
              </p>
              <div className="mt-8 flex flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center">
                <a
                  href="#signup"
                  className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-pill bg-brand-primary px-7 text-[15.5px] font-bold text-white no-underline transition hover:bg-brand-secondary sm:w-auto"
                >
                  Start free <ArrowRight className="h-[18px] w-[18px]" />
                </a>
                <a
                  href="#calc"
                  className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-pill border border-brand-line bg-white px-6 text-[15.5px] font-semibold text-brand-ink no-underline hover:border-brand-primary hover:bg-brand-light sm:w-auto"
                >
                  See what you&rsquo;re paying now
                </a>
              </div>
              <p className="mt-4 flex items-center gap-2 text-[13px] text-brand-mute">
                <ShieldCheck className="h-4 w-4 text-brand-primary" /> No credit
                card. No developer. Live in about ten minutes.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] font-semibold text-brand-secondary">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-primary" /> 0%
                  commission — ever
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-primary" /> Built
                  in South Africa
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-primary" /> Priced
                  in rand
                </span>
              </div>
            </div>

            <div className="relative min-h-[420px] self-stretch lg:min-h-0">
              {heroPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroPhoto}
                  alt="A property listed on the platform"
                  className="absolute inset-0 h-full w-full bg-[#0A3D2C] object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary to-[#0A3D2C]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-secondary/45 to-transparent" />
              {/* Labelled as an example. The mockup showed this as a specific
                  host's payout; it is not one, so it does not claim to be. */}
              <div className="absolute bottom-4 left-4 w-[240px] rounded-card border border-brand-line bg-white p-4 shadow-card lg:bottom-8 lg:left-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-mute">
                  A payout on {brandName}
                </div>
                <div className="mt-1 text-[30px] font-bold tabular-nums text-brand-ink">
                  R16,800
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-brand-primary">
                  <CheckCircle2 className="h-4 w-4" /> 100% kept — R0 taken
                </div>
                <div className="mt-1 text-[10.5px] text-brand-mute">
                  Example, on an R16,800 month.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stat bar */}
        <section className="border-b border-brand-line bg-white">
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-4 gap-y-7 px-5 py-8 lg:grid-cols-4 lg:px-10">
            <div className="text-center lg:border-r lg:border-brand-line lg:pr-6 lg:text-left">
              <div className="font-display text-[34px] font-extrabold tabular-nums leading-none text-brand-ink">
                R108,000
              </div>
              <div className="mt-1.5 text-[12.5px] leading-snug text-brand-mute">
                A year in commission on an R60k/month property at 15%
              </div>
            </div>
            <div className="text-center lg:border-r lg:border-brand-line lg:px-6 lg:text-left">
              <div className="font-display text-[34px] font-extrabold leading-none text-brand-primary">
                0%
              </div>
              <div className="mt-1.5 text-[12.5px] leading-snug text-brand-mute">
                Success fees on {brandName}. One subscription. Ever.
              </div>
            </div>
            <div className="text-center lg:border-r lg:border-brand-line lg:px-6 lg:text-left">
              <div className="font-display text-[34px] font-extrabold leading-none text-brand-ink">
                62%
              </div>
              <div className="mt-1.5 text-[12.5px] leading-snug text-brand-mute">
                More revenue from direct vs OTA bookings{" "}
                <span className="text-brand-mute/70">(SiteMinder)</span>
              </div>
            </div>
            <div className="text-center lg:pl-6 lg:text-left">
              <div className="font-display text-[34px] font-extrabold leading-none text-brand-ink">
                10 min
              </div>
              <div className="mt-1.5 text-[12.5px] leading-snug text-brand-mute">
                To go live. No designer, no developer, no code.
              </div>
            </div>
          </div>
        </section>

        {/* The partner's personal invitation */}
        <section className="border-b border-brand-line">
          <div className="mx-auto max-w-[1200px] px-5 py-12 lg:px-10 lg:py-16">
            <div className="grid overflow-hidden rounded-card border border-brand-line bg-white shadow-card md:grid-cols-[300px_1fr]">
              <div className="relative min-h-[240px] md:min-h-0">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={name}
                    className="absolute inset-0 h-full w-full bg-[#0A3D2C] object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-brand-secondary font-display text-[64px] font-extrabold text-white/80">
                    {(name.trim()[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-secondary/70 to-transparent" />
                <div className="absolute bottom-4 left-5 text-white">
                  <div className="font-display text-[17px] font-bold">
                    {name}
                  </div>
                  {roleLine ? (
                    <div className="text-[12px] opacity-90">{roleLine}</div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col justify-center p-7 lg:p-9">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary">
                  A personal invitation
                </span>
                <p className="mt-3 font-display text-[19px] font-semibold leading-[1.45] text-brand-ink sm:text-[22px]">
                  {message
                    ? `“${message}”`
                    : partner.display_headline?.trim() ||
                      `I'd like you to run your place on ${brandName} — and keep every rand of every booking.`}
                </p>
                <div className="mt-5 flex flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center">
                  <a
                    href="#signup"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-brand-primary px-7 text-[15px] font-bold text-white no-underline transition hover:bg-brand-secondary sm:w-auto"
                  >
                    Join {firstName}&rsquo;s network{" "}
                    <ArrowRight className="h-[18px] w-[18px]" />
                  </a>
                  {telHref ? (
                    <a
                      href={telHref}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill border border-brand-line bg-white px-5 text-[15px] font-semibold text-brand-ink no-underline hover:border-brand-primary sm:w-auto"
                    >
                      <PhoneCall className="h-[18px] w-[18px] text-brand-primary" />
                      Rather talk? <b className="text-brand-ink">{phone}</b>
                    </a>
                  ) : null}
                  {members ? (
                    <span className="inline-flex items-center justify-center gap-1.5 text-[12.5px] text-brand-mute">
                      <Users className="h-4 w-4 text-brand-primary" />
                      {members.toLocaleString("en-ZA")} members
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section
          id="problem"
          className="relative overflow-hidden bg-[#053024] text-white"
        >
          <div className="relative mx-auto max-w-[1200px] px-5 py-16 lg:px-10 lg:py-24">
            <div className="max-w-[760px]">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#34E5A0]">
                You built something real
              </span>
              <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.02] sm:text-[48px]">
                Then the invoice arrived.
              </h2>
              <p className="mt-5 max-w-[58ch] text-[16.5px] leading-relaxed text-[#B7D8CB]">
                A commission on every booking. On the property you built, the
                guests you charmed, the beds you made, the 11pm call you
                answered. They never met your guests — but they took their cut
                before you saw a single rand.
              </p>
            </div>
            <div className="mt-11 grid gap-4 md:grid-cols-3">
              {[
                {
                  Icon: Scissors,
                  t: "The fees eat your revenue",
                  d: "10–25% commission on every booking. On R60k a month that's up to R15,000 gone before a single expense is paid.",
                },
                {
                  Icon: UserX,
                  t: "You don't own your guests",
                  d: "A first name and an arrival date. The platform keeps the email, the phone and the history.",
                },
                {
                  Icon: Unlink,
                  t: "Three things, three bills",
                  d: "A social page, an OTA listing, a calendar on your phone. Nothing talks to anything.",
                },
              ].map((c) => (
                <div
                  key={c.t}
                  className="rounded-[26px] border border-white/10 bg-white/[.04] p-6"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#34E5A0]/15 text-[#34E5A0]">
                    <c.Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 font-display text-[18px] font-bold">
                    {c.t}
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#9FC6B7]">
                    {c.d}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-9 flex items-center gap-3 text-[15px] font-semibold text-[#DCEFE6]">
              <Quote className="h-6 w-6 shrink-0 text-[#34E5A0]" />
              What you pay in commission in one month is more than a year of{" "}
              {brandName}.
            </div>
          </div>
        </section>

        {/* Solution */}
        <section className="border-b border-brand-line bg-white">
          <div className="mx-auto max-w-[1200px] px-5 py-16 text-center lg:px-10 lg:py-24">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary">
              One subscription. Zero commission.
            </span>
            <h2 className="mx-auto mt-3 max-w-[18ch] font-display text-[32px] font-extrabold leading-[1.02] text-brand-ink sm:text-[50px]">
              A platform where every booking is{" "}
              <span className="text-brand-primary">100% yours.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-[62ch] text-[17px] leading-relaxed text-brand-mute">
              Your website, your directory listing, and your full booking system
              — all connected, all yours. Built in South Africa, for South
              Africa.
            </p>
            <div className="mx-auto mt-9 grid max-w-[820px] gap-4 text-left sm:grid-cols-3">
              {[
                {
                  Icon: Wallet,
                  t: "Keep every rand",
                  d: "Your payout equals the guest total. No commission, no service fee.",
                },
                {
                  Icon: Users,
                  t: "Own your guests",
                  d: "Name, email, phone and full history — and direct messaging.",
                },
                {
                  Icon: SlidersHorizontal,
                  t: "Full control",
                  d: "Your rates, your rules, your cancellation terms — always.",
                },
              ].map((c) => (
                <div
                  key={c.t}
                  className="rounded-card border border-brand-line bg-white p-5 shadow-card"
                >
                  <c.Icon className="h-6 w-6 text-brand-primary" />
                  <div className="mt-3 font-display text-[15px] font-bold text-brand-ink">
                    {c.t}
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug text-brand-mute">
                    {c.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Calculator */}
        <section
          id="calc"
          className="border-b border-brand-line bg-brand-light"
        >
          <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10 lg:py-24">
            <div className="max-w-[640px]">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary">
                The maths
              </span>
              <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.03] text-brand-ink sm:text-[46px]">
                How much commission are you paying?
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-brand-mute">
                Slide your own numbers. On {brandName} your payout is exactly
                the guest total — the rest is what the platforms keep, every
                single booking.
              </p>
            </div>
            <PartnerCalculator ctaHref={ctaHref} />
            <p className="mt-5 max-w-[74ch] text-[11.5px] text-brand-mute">
              Estimate for illustration. Competitor rates are typical host-side
              service fees and vary by plan and region. {brandName} never
              deducts commission or service fees from host payouts — your payout
              always equals the guest total.
            </p>
          </div>
        </section>

        {/* Included */}
        <section id="included" className="border-b border-brand-line bg-white">
          <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10 lg:py-24">
            <div className="max-w-[640px]">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary">
                Everything included
              </span>
              <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.03] text-brand-ink sm:text-[46px]">
                A full platform. None of the cut.
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-brand-mute">
                A website, a directory listing, and a booking system — three
                separate expenses, bundled into one subscription.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.t}
                  className="rounded-card border border-brand-line bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand-primary/40"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[13px] bg-brand-light text-brand-primary">
                    <f.Icon className="h-5 w-5" />
                  </span>
                  <div className="mt-4 font-display text-[16px] font-bold text-brand-ink">
                    {f.t}
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-mute">
                    {f.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-brand-line bg-brand-light">
          <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10 lg:py-24">
            <div className="mx-auto max-w-[620px] text-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary">
                Live in about ten minutes
              </span>
              <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.03] text-brand-ink sm:text-[46px]">
                If you can send a WhatsApp, you can do this.
              </h2>
            </div>
            <div className="mt-11 grid gap-5 md:grid-cols-3">
              {[
                {
                  n: "01",
                  Icon: ImagePlus,
                  t: "Add your property",
                  d: "Photos, rooms, rates and a description. No designer, no code.",
                },
                {
                  n: "02",
                  Icon: Globe,
                  t: "Go live & get found",
                  d: "Your website and directory listing publish instantly, with a shareable link.",
                },
                {
                  n: "03",
                  Icon: PartyPopper,
                  t: "Keep every rand",
                  d: "Guests book direct and pay you direct. Their details are yours.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="relative rounded-card border border-brand-line bg-white p-7 shadow-card"
                >
                  <div className="text-[13px] font-bold text-brand-primary">
                    {s.n}
                  </div>
                  <div className="mt-3 font-display text-[20px] font-bold text-brand-ink">
                    {s.t}
                  </div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-brand-mute">
                    {s.d}
                  </p>
                  <s.Icon className="absolute right-6 top-6 h-6 w-6 text-brand-primary/40" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Real reviews. Hidden entirely below MIN_REVIEWS — never padded. */}
        {reviews.length >= MIN_REVIEWS ? (
          <section className="border-b border-brand-line bg-white">
            <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10 lg:py-24">
              <div className="max-w-[640px]">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary">
                  From guests on {brandName}
                </span>
                <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.03] text-brand-ink sm:text-[46px]">
                  Real stays. Real reviews.
                </h2>
              </div>
              <div className="mt-10 grid gap-5 md:grid-cols-3">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col rounded-card border border-brand-line bg-white p-6 shadow-card"
                  >
                    <div className="flex items-center gap-1 text-brand-primary">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <p className="mt-3 flex-1 text-[15px] leading-relaxed text-brand-ink">
                      &ldquo;{r.body}&rdquo;
                    </p>
                    <div className="mt-5 border-t border-brand-line pt-4">
                      <div className="font-display text-[14px] font-bold text-brand-ink">
                        Verified guest
                      </div>
                      <div className="text-[12px] text-brand-mute">
                        {r.property}
                        {r.place ? ` · ${r.place}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Comparison */}
        <section className="border-b border-brand-line bg-brand-light">
          <div className="mx-auto max-w-[1100px] px-5 py-16 lg:px-10 lg:py-24">
            <div className="mx-auto max-w-[620px] text-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary">
                The whole picture
              </span>
              <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.03] text-brand-ink sm:text-[46px]">
                One row where everything is green.
              </h2>
            </div>
            <div className="mt-10 overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[14px]">
                  <thead>
                    <tr className="text-left text-brand-mute">
                      <th className="px-5 py-4 font-semibold">Platform</th>
                      {[
                        "Booking",
                        "Directory",
                        "Website",
                        "0% fee",
                        "SA-built",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-4 text-center font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((r) => (
                      <tr key={r.n} className="border-t border-brand-line">
                        <td className="px-5 py-3.5 font-semibold text-brand-ink">
                          {r.n}
                        </td>
                        {r.v.map((v, i) => (
                          <td key={i} className="px-3 py-3.5 text-center">
                            {v ? yes : no}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-brand-primary bg-brand-secondary">
                      <td className="px-5 py-4 font-display font-extrabold text-white">
                        {brandName}
                      </td>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <td key={i} className="px-3 py-4 text-center">
                          <Check className="mx-auto h-4 w-4 text-[#34E5A0]" />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Campaign / risk reversal — only with a live campaign. */}
        {campaign ? (
          <section className="relative overflow-hidden bg-[#053024] text-white">
            <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-16 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:py-20">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#34E5A0]">
                  The {campaign.name}
                </span>
                <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.03] sm:text-[46px]">
                  {offer
                    ? `Sign up in the beta. Get ${offer}.`
                    : "Sign up in the beta."}
                </h2>
                <p className="mt-5 max-w-[54ch] text-[16.5px] leading-relaxed text-[#B7D8CB]">
                  Founding hosts help us build the platform. Places are limited
                  to the first properties in each region
                  {campaign.endsAt
                    ? `, and the ${campaign.name} closes on ${new Date(
                        campaign.endsAt,
                      ).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}`
                    : ""}
                  .
                </p>
                <div className="mt-7 grid max-w-[520px] gap-3 sm:grid-cols-3">
                  {[
                    {
                      Icon: Gift,
                      t: offer ?? "Beta access",
                      d: "No card to start.",
                    },
                    {
                      Icon: HandHeart,
                      t: "Shape the build",
                      d: "Your feedback ships.",
                    },
                    {
                      Icon: Award,
                      t: "Founding badge",
                      d: "Priority in the directory.",
                    },
                  ].map((c) => (
                    <div
                      key={c.t}
                      className="rounded-xl border border-white/10 bg-white/[.04] p-4"
                    >
                      <c.Icon className="h-5 w-5 text-[#34E5A0]" />
                      <div className="mt-2 font-display text-[14px] font-bold">
                        {c.t}
                      </div>
                      <p className="mt-1 text-[12px] text-[#9FC6B7]">{c.d}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/[.04] p-7">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#34E5A0]">
                  No risk
                </div>
                <ul className="mt-4 space-y-3.5 text-[14.5px]">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#34E5A0]" />
                    <span className="text-[#DCEFE6]">
                      <b className="text-white">Keep your OTA listings.</b>{" "}
                      {brandName} is a channel you add — not one you have to
                      leave.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#34E5A0]" />
                    <span className="text-[#DCEFE6]">
                      <b className="text-white">No card required</b> to start.
                      Cancel any time in the beta.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#34E5A0]" />
                    <span className="text-[#DCEFE6]">
                      <b className="text-white">Zero commission, guaranteed.</b>{" "}
                      Your payout always equals the guest total.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {/* FAQ + signup */}
        <section id="signup" className="bg-white">
          <div className="mx-auto grid max-w-[1200px] items-start gap-10 px-5 py-16 lg:grid-cols-[1fr_460px] lg:gap-16 lg:px-10 lg:py-24">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-primary">
                Before you ask
              </span>
              <h2 className="mt-3 font-display text-[30px] font-extrabold leading-[1.04] text-brand-ink sm:text-[42px]">
                The honest answers.
              </h2>
              <div className="mt-7 divide-y divide-brand-line border-y border-brand-line">
                {FAQ.map((f) => (
                  <details key={f.q} className="group py-5">
                    <summary className="flex cursor-pointer list-none items-start gap-4">
                      <span className="flex-1 font-display text-[16.5px] font-bold text-brand-ink">
                        {f.q}
                      </span>
                      <span className="mt-0.5 shrink-0 text-[20px] font-bold leading-none text-brand-primary transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 pr-8 text-[14.5px] leading-relaxed text-brand-mute">
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            <div className="lg:sticky lg:top-24">
              <div className="rounded-card border border-brand-line bg-white p-6 shadow-card lg:p-7">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[22px] font-extrabold text-brand-ink">
                    Start free
                  </h3>
                  {offer ? (
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-primary">
                      {offer}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-brand-mute">
                  {campaign
                    ? `${campaign.name} place, invited by ${firstName}.`
                    : `Invited by ${firstName}.`}
                </p>
                <PartnerLeadForm
                  slug={partner.slug}
                  campaignSlug={campaign?.slug ?? null}
                  partnerName={name}
                />
                {telHref ? (
                  <div className="mt-4 flex items-center justify-center gap-2 border-t border-brand-line pt-4 text-[13px] text-brand-mute">
                    <PhoneCall className="h-4 w-4 text-brand-primary" />
                    Rather talk it through?{" "}
                    <a href={telHref} className="font-bold no-underline">
                      {phone}
                    </a>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-center gap-4 text-[12px] text-brand-mute">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-brand-primary" /> Your data
                  stays yours
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-brand-primary" /> Live in 10
                  min
                </span>
              </div>
            </div>
          </div>
        </section>

        <footer className="bg-[#053024] py-10 text-white/70">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-5 text-center sm:flex-row sm:text-left lg:px-10">
            <div className="font-display text-[15px] font-bold text-white">
              {brandName}
            </div>
            <p className="text-[12px]">
              Direct booking for South African hosts · Invited by {name}
              {telHref ? (
                <>
                  {" · "}
                  <a href={telHref} className="text-[#34E5A0] no-underline">
                    {phone}
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </footer>
      </main>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-3 border-t border-brand-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        {telHref ? (
          <a
            href={telHref}
            aria-label="Call"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill border border-brand-line bg-white no-underline"
          >
            <PhoneCall className="h-5 w-5 text-brand-primary" />
          </a>
        ) : null}
        <a
          href="#signup"
          className="inline-flex h-12 flex-1 items-center justify-center rounded-pill bg-brand-primary px-6 text-[14.5px] font-bold text-white no-underline"
        >
          Start free{offer ? ` — ${offer}` : ""}
        </a>
      </div>
      {/* The sticky bar would otherwise cover the footer on mobile. */}
      <div className="h-[76px] lg:hidden" />
    </div>
  );
}
