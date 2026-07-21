import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  MapPin,
  MessageSquare,
  PencilLine,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { FunnelTracker } from "@/components/funnel/FunnelTracker";
import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import { MAX_ACTIVE_LOOKING_FOR_POSTS } from "@/lib/looking-for/limits";
import { stripHtml } from "@/lib/sanitiseHtml";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandName();
  return {
    title: "Post a free stay request — hosts come to you",
    description: `Can't find the perfect place? Post what you're looking for on ${brand} and get personalised offers direct from hosts. Free to post, no commission.`,
  };
}

const STEPS = [
  {
    icon: PencilLine,
    title: "Post your request",
    body: "Tell hosts where, when, your budget and what matters to you. Takes about two minutes — no account fees.",
  },
  {
    icon: MessageSquare,
    title: "Hosts send offers",
    body: "Verified hosts with a matching stay reply directly with a personalised quote. You compare, you choose.",
  },
  {
    icon: BadgeCheck,
    title: "Book direct",
    body: "Chat, agree the details and book straight with the host. No middle-man, no commission on top.",
  },
];

const BENEFITS = [
  {
    icon: Wallet,
    title: "Free to post",
    body: `Post up to ${MAX_ACTIVE_LOOKING_FOR_POSTS} active requests at a time. No listing fees, no catch.`,
  },
  {
    icon: Sparkles,
    title: "Offers come to you",
    body: "Stop scrolling. The right hosts find your request and pitch you their place.",
  },
  {
    icon: ShieldCheck,
    title: "No commission",
    body: "You book directly with the host at the price you agree — nothing skimmed off the top.",
  },
  {
    icon: CalendarClock,
    title: "You stay in control",
    body: "Keep a request public or private. It runs for 30 days, and you can close it any time.",
  },
];

// A guest-facing showcase of what a posted request looks like. Populated from
// real active posts when there are enough; otherwise the curated examples below
// so the section always reads full and credible. `href` is set only for real
// posts (links to the live request).
type ShowcasePost = {
  key: string;
  href?: string;
  category: string;
  title: string;
  location: string | null;
  dateLabel: string | null;
  guests: number;
  budget: string | null;
  quote: string | null;
  urgent?: boolean;
};

const EXAMPLE_POSTS: ShowcasePost[] = [
  {
    key: "ex-beach",
    category: "accommodation",
    title: "Beachfront house for a family reunion",
    location: "Umhlanga, KwaZulu-Natal",
    dateLabel: "20 – 27 Dec",
    guests: 8,
    budget: "R2 000 – R3 500 / night",
    quote:
      "A 4-bed place walking distance to the beach, pet-friendly if possible.",
  },
  {
    key: "ex-safari",
    category: "experience",
    title: "Private safari for our anniversary",
    location: "Kruger area, Mpumalanga",
    dateLabel: "14 – 16 Mar",
    guests: 2,
    budget: "Up to R12 000 total",
    quote:
      "A romantic bush getaway with guided game drives and dinner outdoors.",
  },
  {
    key: "ex-cottage",
    category: "accommodation",
    title: "Quiet self-catering cottage to write",
    location: "The Karoo",
    dateLabel: "Flexible · 5 nights",
    guests: 1,
    budget: "From R700 / night",
    quote: "Somewhere peaceful with good wifi and big skies for a deadline.",
    urgent: true,
  },
];

// stripHtml removes tags but leaves entities encoded; decode the common ones so
// a real quote reads "B&B", not "B&amp;B".
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function budgetLabel(
  min: number | null | undefined,
  max: number | null | undefined,
  per: string | null | undefined,
): string | null {
  if (!min && !max) return null;
  const base =
    min && max
      ? `R${min.toLocaleString()} – R${max.toLocaleString()}`
      : max
        ? `Up to R${max.toLocaleString()}`
        : `From R${min?.toLocaleString()}`;
  return per ? `${base} / ${per}` : base;
}

function ShowcaseCard({ post }: { post: ShowcasePost }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-brand-line p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {post.category}
          </Badge>
          {post.urgent ? (
            <Badge variant="destructive" className="gap-1">
              <Zap className="h-3 w-3" /> Urgent
            </Badge>
          ) : null}
        </div>
        {post.location ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-brand-mute">
            <MapPin className="h-3 w-3" />{" "}
            {post.location.split(",").pop()?.trim()}
          </span>
        ) : null}
      </div>
      <div className="flex-1 p-4">
        <h3 className="line-clamp-2 font-display text-base font-semibold text-brand-ink">
          {post.title}
        </h3>
        {post.location ? (
          <p className="mt-1 flex items-center gap-1 text-sm text-brand-mute">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{post.location}</span>
          </p>
        ) : null}
        <div className="mt-3 space-y-1.5 text-sm text-brand-ink">
          {post.dateLabel ? (
            <div className="flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-brand-mute" />
              <span>{post.dateLabel}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-brand-mute" />
            <span>
              {post.guests} guest{post.guests !== 1 ? "s" : ""}
            </span>
          </div>
          {post.budget ? (
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-brand-mute" />
              <span>{post.budget}</span>
            </div>
          ) : null}
        </div>
        {post.quote ? (
          <p className="mt-3 line-clamp-2 text-sm text-brand-mute">
            &ldquo;{post.quote}&rdquo;
          </p>
        ) : null}
      </div>
    </>
  );

  const className =
    "flex flex-col rounded-card border border-brand-line bg-white text-left shadow-card transition-shadow hover:shadow-md";
  return post.href ? (
    <Link href={post.href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

export default async function LookingForStartPage() {
  const brand = await getBrandName();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Real, live requests from OTHER travellers to showcase — social proof beats a
  // fabricated example. We lead with as many real posts as we can and top up
  // with curated examples so the row is always full and credible.
  let liveQuery = supabase
    .from("looking_for_posts")
    .select(
      "id, title, category, location_text, location_region, check_in_date, check_out_date, adults, children, infants, budget_min, budget_max, budget_per, description, is_urgent",
    )
    .eq("status", "active")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(6);
  // Show OTHER people's requests, not the viewer's own.
  if (user?.id) liveQuery = liveQuery.neq("guest_id", user.id);
  const { data: liveRows } = await liveQuery;
  const livePosts: ShowcasePost[] = (liveRows ?? [])
    // Only surface presentable posts on the marketing page — a real but junky
    // title ("asdf") would undercut the pitch.
    .filter((r) => (r.title?.trim().length ?? 0) >= 10)
    .slice(0, 3)
    .map((r) => ({
      key: r.id,
      href: `/looking-for/${r.id}`,
      category: r.category,
      title: r.title,
      location: r.location_text || r.location_region || null,
      dateLabel:
        r.check_in_date && r.check_out_date
          ? `${new Date(r.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${new Date(r.check_out_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
          : r.check_in_date
            ? `From ${new Date(r.check_in_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
            : "Flexible dates",
      guests: (r.adults ?? 0) + (r.children ?? 0) + (r.infants ?? 0),
      budget: budgetLabel(r.budget_min, r.budget_max, r.budget_per),
      quote: r.description ? decodeEntities(stripHtml(r.description)) : null,
      urgent: r.is_urgent ?? false,
    }));
  const showcaseIsLive = livePosts.length > 0;
  // Real posts first, examples fill the remaining slots (up to 3 total).
  const showcasePosts = [...livePosts, ...EXAMPLE_POSTS].slice(0, 3);

  // Post-first funnel (WS-2a): signed-in guests go straight to the portal form;
  // everyone else uses the PUBLIC wizard — no signup wall. The submit mints a
  // passwordless account at the end, so they reach the form in one click.
  const postHref = user ? "/portal/looking-for/new" : "/looking-for/post";
  const ctaLabel = "Post your free request";

  return (
    <div className="bg-brand-light text-brand-ink">
      {/* WS-7 — the top of the funnel every ad lands on. */}
      <FunnelTracker event="landing_view" />
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-brand-line bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-primary/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-5xl px-5 py-16 text-center lg:px-8 lg:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-brand-primary/25 bg-brand-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-secondary">
            <Sparkles className="h-3.5 w-3.5" /> Looking For · Free to post
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-brand-ink md:text-6xl">
            Tell hosts what you want.
            <br className="hidden sm:block" /> Let the offers come to you.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-brand-mute md:text-lg">
            Can&rsquo;t find the perfect place? Post what you&rsquo;re looking
            for — dates, budget, the vibe — and get personalised offers direct
            from hosts on {brand}. Free to post. No commission, ever.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={postHref}
              className="inline-flex items-center gap-2 rounded-[12px] bg-brand-primary px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-secondary"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/looking-for"
              className="inline-flex items-center gap-2 rounded-[12px] border border-brand-line bg-white px-6 py-3.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <Search className="h-4 w-4" /> Browse live requests
            </Link>
          </div>
          <p className="mt-4 text-[12.5px] text-brand-mute">
            No credit card. Post in about two minutes.
          </p>
        </div>
      </section>

      {/* Real requests / examples — show how easy it is */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-3 text-center sm:text-left">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
                {showcaseIsLive ? "Live right now" : "See how it works"}
              </div>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
                {showcaseIsLive
                  ? "What travellers are posting"
                  : "This is all it takes"}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-brand-mute">
                A few lines about your trip is enough for hosts to make you an
                offer.
              </p>
            </div>
            <Link
              href="/looking-for"
              className="hidden items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline sm:inline-flex"
            >
              Browse all requests <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {showcasePosts.map((post) => (
              <ShowcaseCard key={post.key} post={post} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href={postHref}
              className="inline-flex items-center gap-2 rounded-[12px] bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-secondary"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-brand-line">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
              How it works
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
              Three steps to the right stay
            </h2>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="relative rounded-card border border-brand-line bg-white p-6 shadow-card"
              >
                <span className="absolute right-5 top-5 font-display text-4xl font-extrabold text-brand-accent">
                  {i + 1}
                </span>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-brand-accent text-brand-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-brand-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-mute">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
              Why post a request?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-brand-mute">
              You&rsquo;re the one hosts pitch to — on your terms.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="rounded-card border border-brand-line bg-brand-light/40 p-6"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-white text-brand-primary shadow-card">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-bold text-brand-ink">
                  {b.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-brand-mute">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 lg:py-20">
        <div className="brand-gradient relative mx-auto max-w-5xl overflow-hidden rounded-card p-10 text-center text-white lg:p-16">
          <div
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative">
            <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
              Ready to find your stay?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/90 md:text-base">
              Post your first request free and let the offers roll in.
            </p>
            <Link
              href={postHref}
              className="mt-7 inline-flex items-center gap-2 rounded-[12px] bg-white px-6 py-3.5 text-sm font-semibold text-brand-secondary transition hover:bg-brand-accent"
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
