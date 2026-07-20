import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Calendar,
  ChevronRight,
  Clock,
  Eye,
  Home,
  MapPin,
  MessageSquare,
  Navigation,
  Share2,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { stripHtml } from "@/lib/sanitiseHtml";
import { recordPostView } from "@/lib/looking-for/postViews";
import { RequestDetailsHtml } from "@/components/looking-for/RequestDetailsHtml";
import { RequestRequirements } from "@/components/looking-for/RequestRequirements";
import { Link } from "@/i18n/navigation";

import { QuoteButton } from "../_components/QuoteButton";

// Native date formatting utility
function formatDistanceToNow(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "just now";
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Decorative hero + search-area styling. Class names are page-unique (`lf-`)
// so this scoped block never collides with the rest of the app.
const LF_STYLES = `
@keyframes lfPing{0%{transform:scale(1);opacity:.5}80%,100%{transform:scale(2.6);opacity:0}}
.lf-ping::before{content:"";position:absolute;inset:0;border-radius:9999px;background:#10B981;animation:lfPing 1.9s cubic-bezier(0,0,.2,1) infinite}
.lf-dot{background-image:radial-gradient(rgba(16,185,129,.38) 1px,transparent 1px);background-size:20px 20px}
.lf-map{background:radial-gradient(circle at 32% 42%,rgba(16,185,129,.22) 0,transparent 34%),radial-gradient(circle at 70% 66%,rgba(6,78,59,.16) 0,transparent 40%),linear-gradient(135deg,#E7FAEE 0%,#D1FAE5 100%)}
.lf-map::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(6,78,59,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(6,78,59,.06) 1px,transparent 1px);background-size:30px 30px}
`;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: post } = await supabase
    .from("looking_for_posts")
    .select(
      "title, description, category, location_region, check_in_date, check_out_date, adults",
    )
    .eq("id", id)
    .eq("is_public", true)
    .eq("status", "active")
    .single();

  if (!post) {
    return {
      title: "Request Not Found | Wielo",
    };
  }

  const descText = post.description ? stripHtml(post.description) : "";
  const description = descText
    ? descText.slice(0, 155) + (descText.length > 155 ? "..." : "")
    : `Looking for ${post.category}${post.location_region ? ` in ${post.location_region}` : ""}${post.adults ? ` for ${post.adults} guests` : ""} — respond with a direct, commission-free quote on Wielo.`;

  return {
    title: `${post.title} | Looking For | Wielo`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      siteName: "Wielo",
    },
    twitter: {
      card: "summary",
      title: post.title,
      description,
    },
  };
}

export default async function PublicPostDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServerClient();

  // Viewer auth state — signed-in hosts go straight to the respond page;
  // signed-out visitors get the sign-in-to-quote modal.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = Boolean(user);

  // Fetch the post
  const { data: post, error } = await supabase
    .from("looking_for_posts")
    .select(
      `
      id,
      title,
      description,
      category,
      check_in_date,
      check_out_date,
      date_flexibility_days,
      adults,
      children,
      infants,
      child_ages,
      pets,
      location_text,
      location_region,
      search_radius_km,
      destination_flexible,
      budget_min,
      budget_max,
      budget_currency,
      budget_per,
      status,
      is_urgent,
      is_public,
      view_count,
      quote_count,
      created_at,
      expires_at,
      image_url,
      guest_id,
      guest:user_profiles!guest_id(full_name, avatar_url, created_at)
    `,
    )
    .eq("id", id)
    .single();

  if (error || !post) {
    notFound();
  }

  // Only show public active posts
  if (!post.is_public || post.status !== "active") {
    notFound();
  }

  // Check if expired
  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();
  if (isExpired) {
    notFound();
  }

  const guest = post.guest as unknown as {
    full_name: string | null;
    avatar_url: string | null;
    created_at: string | null;
  } | null;

  const guestName = guest?.full_name?.trim() || "Wielo guest";
  const initials =
    guestName
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "W";
  const memberSince = guest?.created_at
    ? new Date(guest.created_at).getFullYear()
    : null;

  const guestSummary =
    (post.children ?? 0) > 0 || (post.infants ?? 0) > 0
      ? `${post.adults} adult${post.adults !== 1 ? "s" : ""}${(post.children ?? 0) > 0 ? `, ${post.children} child${(post.children ?? 0) !== 1 ? "ren" : ""}` : ""}${(post.infants ?? 0) > 0 ? `, ${post.infants} infant${(post.infants ?? 0) !== 1 ? "s" : ""}` : ""}`
      : `${post.adults} guest${post.adults !== 1 ? "s" : ""}`;

  const childAges = post.child_ages ?? [];
  const petCount = post.pets ?? 0;

  const budgetDisplay =
    post.budget_min || post.budget_max
      ? post.budget_min && post.budget_max
        ? `R${post.budget_min.toLocaleString("en-ZA")} – R${post.budget_max.toLocaleString("en-ZA")}`
        : post.budget_max
          ? `Up to R${post.budget_max.toLocaleString("en-ZA")}`
          : `From R${post.budget_min?.toLocaleString("en-ZA")}`
      : "Flexible";

  const nights =
    post.check_in_date && post.check_out_date
      ? Math.max(
          0,
          Math.round(
            (new Date(post.check_out_date).getTime() -
              new Date(post.check_in_date).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;

  const dateDisplay =
    post.check_in_date && post.check_out_date
      ? `${fmtDate(post.check_in_date)} – ${fmtDate(post.check_out_date)}`
      : post.check_in_date
        ? `From ${fmtDate(post.check_in_date)}`
        : "Flexible dates";

  const flexDays = post.date_flexibility_days ?? 0;
  const dateSub = [
    nights > 0 ? `${nights} night${nights !== 1 ? "s" : ""}` : null,
    flexDays > 0
      ? `flexible ± ${flexDays} day${flexDays !== 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const locationLabel = post.destination_flexible
    ? "Flexible destination"
    : post.location_text || post.location_region || "Anywhere";
  const locationSub = post.destination_flexible
    ? "Open to suggestions from hosts"
    : [
        post.location_text && post.location_region
          ? post.location_region
          : null,
        post.search_radius_km && post.search_radius_km > 0
          ? `within ${post.search_radius_km} km`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Anywhere in South Africa";

  const showSearchArea =
    !post.destination_flexible &&
    Boolean(post.location_region || (post.search_radius_km ?? 0) > 0);

  const daysLeft = post.expires_at
    ? Math.ceil(
        (new Date(post.expires_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const daysLeftLabel =
    daysLeft === null ? "—" : daysLeft <= 0 ? "Today" : String(daysLeft);

  // A host opening this page has loaded the request's detail view — the same
  // event the respond page records, and all `view_count` has ever meant to count.
  // Signed-out visitors and plain guests are not "hosts who saw it", so they cost
  // nothing: the host lookup is skipped unless someone is actually signed in.
  if (user) {
    const { data: viewerHost } = await supabase
      .from("hosts")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (viewerHost) {
      await recordPostView(supabase, {
        postId: id,
        hostId: viewerHost.id,
        guestUserId: post.guest_id,
        viewerUserId: user.id,
      });
    }
  }

  // Requirements aren't anon-readable (RLS) — RequestRequirements itself reads
  // them with the admin client and renders null when empty. Mirror that here so
  // the styled "Requirements" heading never orphans over an empty component.
  const { count: reqCount } = await createAdminClient()
    .from("looking_for_post_requirements")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", post.id);
  const hasRequirements = (reqCount ?? 0) > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Wielo",
        item: "https://wielo.co.za",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Looking For",
        item: "https://wielo.co.za/looking-for",
      },
      { "@type": "ListItem", position: 3, name: post.title },
    ],
  };

  return (
    <div className="bg-white text-brand-ink">
      <style>{LF_STYLES}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section
        className="relative isolate overflow-hidden text-white"
        style={{
          background:
            "linear-gradient(150deg,#11201A 0%,#0A1410 55%,#06100C 100%)",
        }}
      >
        <div
          aria-hidden
          className="lf-dot pointer-events-none absolute inset-0 opacity-[0.14]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-[26rem] w-[26rem] rounded-full bg-brand-primary/20 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-brand-secondary/40 blur-[120px]"
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-9 pt-5 sm:px-6 lg:px-8 lg:pb-12">
          {/* breadcrumb + actions */}
          <div className="flex items-center gap-3">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-[12px] text-white/55"
            >
              <Link href="/" className="text-white/55 hover:text-white">
                Wielo
              </Link>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <Link
                href="/looking-for"
                className="text-white/55 hover:text-white"
              >
                Looking For
              </Link>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="max-w-[45vw] truncate text-white/90">
                {post.title}
              </span>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/looking-for"
                className="inline-flex items-center gap-1.5 rounded-pill border border-white/20 bg-white/[0.07] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.14]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">All requests</span>
              </Link>
              <button className="inline-flex items-center gap-1.5 rounded-pill border border-white/20 bg-white/[0.07] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.14]">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          </div>

          <div className="mt-7 grid items-end gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-white/[0.16] bg-white/[0.08] px-2.5 py-1 text-[11.5px] font-semibold capitalize text-brand-accent">
                  <Home className="h-3.5 w-3.5" />
                  {post.category}
                </span>
                {post.is_urgent && (
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-amber-400/40 bg-amber-400/[0.16] px-2.5 py-1 text-[11.5px] font-semibold text-amber-300">
                    <Zap className="h-3.5 w-3.5" />
                    Urgent request
                  </span>
                )}
                {post.location_region && !post.destination_flexible && (
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-white/[0.16] bg-white/[0.08] px-2.5 py-1 text-[11.5px] font-semibold text-brand-accent">
                    <MapPin className="h-3.5 w-3.5" />
                    {post.location_region}
                  </span>
                )}
              </div>

              <h1 className="mt-4 text-balance font-display text-3xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-4xl lg:text-[44px]">
                {post.title}
              </h1>

              {/* byline */}
              <div className="mt-5 flex items-center gap-3">
                {guest?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={guest.avatar_url}
                    alt={guestName}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary font-display text-sm font-bold text-white">
                    {initials}
                  </div>
                )}
                <div className="text-[13px] leading-tight">
                  <div className="font-semibold text-white">{guestName}</div>
                  <div className="text-white/55">
                    Wielo guest · Posted{" "}
                    {formatDistanceToNow(new Date(post.created_at))}
                  </div>
                </div>
              </div>
            </div>

            {/* countdown */}
            {daysLeft !== null && (
              <div className="lg:col-span-4">
                <div className="flex items-center gap-4 rounded-2xl border border-white/[0.13] bg-white/[0.06] px-5 py-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/[0.15]">
                    <Clock className="h-5 w-5 text-amber-300" />
                  </div>
                  <div className="leading-tight">
                    <div className="font-display text-lg font-bold text-white">
                      {daysLeft <= 0
                        ? "Closing today"
                        : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                    </div>
                    <div className="text-[12px] text-white/55">
                      to respond before this request closes
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── BODY ─────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
          {/* LEFT */}
          <div className="space-y-10 lg:col-span-2">
            {/* reference image */}
            {post.image_url && (
              <figure className="overflow-hidden rounded-card border border-brand-line shadow-card">
                <div className="aspect-[16/9] w-full bg-brand-light">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="flex items-center gap-2 bg-white px-4 py-3 text-[12px] text-brand-mute">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />A
                  photo the guest shared to show the kind of place they have in
                  mind.
                </figcaption>
              </figure>
            )}

            {/* THE BRIEF */}
            <section>
              <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink">
                The brief
              </h2>
              <p className="mt-1 text-sm text-brand-mute">
                Everything this guest is looking for, at a glance.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {/* Location */}
                <div className="rounded-card border border-brand-line bg-white p-5 transition-shadow hover:shadow-card">
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
                    <MapPin className="h-4 w-4 text-brand-primary" />
                    Location
                  </div>
                  <div className="mt-2 font-display text-[17px] font-bold leading-snug text-brand-ink">
                    {locationLabel}
                  </div>
                  <div className="mt-0.5 text-[13px] text-brand-mute">
                    {locationSub}
                  </div>
                </div>
                {/* Dates */}
                <div className="rounded-card border border-brand-line bg-white p-5 transition-shadow hover:shadow-card">
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
                    <Calendar className="h-4 w-4 text-brand-primary" />
                    Dates
                  </div>
                  <div className="mt-2 font-display text-[17px] font-bold leading-snug text-brand-ink">
                    {dateDisplay}
                  </div>
                  {dateSub && (
                    <div className="mt-0.5 text-[13px] text-brand-mute">
                      {dateSub}
                    </div>
                  )}
                </div>
                {/* Guests */}
                <div className="rounded-card border border-brand-line bg-white p-5 transition-shadow hover:shadow-card">
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
                    <Users className="h-4 w-4 text-brand-primary" />
                    Guests
                  </div>
                  <div className="mt-2 font-display text-[17px] font-bold leading-snug text-brand-ink">
                    {guestSummary}
                  </div>
                  <div className="mt-0.5 text-[13px] text-brand-mute">
                    {childAges.length > 0
                      ? `Ages ${childAges.join(", ")}`
                      : "Ready to book"}
                    {petCount > 0
                      ? ` · ${petCount} pet${petCount !== 1 ? "s" : ""}`
                      : ""}
                  </div>
                </div>
                {/* Budget */}
                <div className="rounded-card border border-brand-line bg-white p-5 transition-shadow hover:shadow-card">
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
                    <Banknote className="h-4 w-4 text-brand-primary" />
                    Budget
                  </div>
                  <div className="mt-2 font-display text-[17px] font-bold leading-snug text-brand-ink">
                    {budgetDisplay}
                  </div>
                  <div className="mt-0.5 text-[13px] text-brand-mute">
                    {post.budget_per && (post.budget_min || post.budget_max)
                      ? post.budget_per === "night"
                        ? "per night"
                        : post.budget_per === "person"
                          ? "per person"
                          : "total for the stay"
                      : "open to offers"}
                  </div>
                </div>
              </div>
            </section>

            {/* ADDITIONAL DETAILS */}
            {post.description && (
              <section>
                <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink">
                  Additional details
                </h2>
                <div className="mt-4 rounded-card border border-brand-line bg-brand-light/60 p-5 lg:p-6">
                  <RequestDetailsHtml
                    html={post.description}
                    className="text-[15px] leading-relaxed text-brand-ink/90"
                  />
                </div>
              </section>
            )}

            {/* REQUIREMENTS */}
            {hasRequirements && (
              <section>
                <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink">
                  Requirements
                </h2>
                <RequestRequirements
                  postId={post.id}
                  title=""
                  className="mt-5"
                />
              </section>
            )}

            {/* SEARCH AREA */}
            {showSearchArea && (
              <section>
                <h2 className="font-display text-xl font-bold tracking-tight text-brand-ink">
                  Search area
                </h2>
                <p className="mt-1 text-sm text-brand-mute">
                  {post.location_region ?? "South Africa"}
                  {(post.search_radius_km ?? 0) > 0
                    ? ` · within a ${post.search_radius_km} km radius`
                    : ""}
                </p>
                <div className="mt-4 overflow-hidden rounded-card border border-brand-line shadow-card">
                  <div className="lf-map relative aspect-[16/7]">
                    {(post.search_radius_km ?? 0) > 0 && (
                      <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-primary/40 bg-brand-primary/5" />
                    )}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="lf-ping relative block h-3.5 w-3.5 rounded-full bg-brand-primary ring-4 ring-white" />
                    </div>
                    {(post.search_radius_km ?? 0) > 0 && (
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-pill bg-white/90 px-3 py-1.5 text-[12px] font-medium text-brand-ink shadow-card backdrop-blur">
                        <Navigation className="h-3.5 w-3.5 text-brand-primary" />
                        {post.search_radius_km} km radius
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT / STICKY */}
          <aside className="lg:col-span-1">
            <div className="space-y-4">
              {/* respond card */}
              <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-lift lg:sticky lg:top-24">
                <div className="p-6">
                  <h2 className="font-display text-lg font-bold tracking-tight text-brand-ink">
                    Respond to this request
                  </h2>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-mute">
                    Send this guest a direct quote.{" "}
                    <span className="font-semibold text-brand-secondary">
                      Wielo takes 0% commission
                    </span>{" "}
                    — they pay exactly what you quote.
                  </p>
                  <QuoteButton
                    postId={id}
                    authed={authed}
                    size="lg"
                    className="mt-5 w-full"
                  />
                  <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-brand-mute">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
                    No card needed to quote
                  </div>
                </div>
                <div className="h-px bg-brand-line" />
                <div className="grid grid-cols-3 divide-x divide-brand-line">
                  <div className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 font-display text-xl font-bold text-brand-ink">
                      <Eye className="h-3.5 w-3.5 text-brand-mute" />
                      {post.view_count}
                    </div>
                    <div className="mt-0.5 text-[11px] text-brand-mute">
                      views
                    </div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 font-display text-xl font-bold text-brand-ink">
                      <MessageSquare className="h-3.5 w-3.5 text-brand-mute" />
                      {post.quote_count > 5 ? "5+" : post.quote_count}
                    </div>
                    <div className="mt-0.5 text-[11px] text-brand-mute">
                      quotes
                    </div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="font-display text-xl font-bold text-brand-ink">
                      {daysLeftLabel}
                    </div>
                    <div className="mt-0.5 text-[11px] text-brand-mute">
                      days left
                    </div>
                  </div>
                </div>
              </div>

              {/* guest card */}
              <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  {guest?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={guest.avatar_url}
                      alt={guestName}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary font-display text-sm font-bold text-white">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 leading-tight">
                    <div className="font-semibold text-brand-ink">
                      {guestName}
                    </div>
                    <div className="text-[12.5px] text-brand-mute">
                      {memberSince
                        ? `Member since ${memberSince}`
                        : "Wielo guest"}
                    </div>
                  </div>
                </div>
              </div>

              {/* host CTA */}
              {!authed && (
                <div className="rounded-card border border-dashed border-brand-line bg-brand-light/60 p-5 text-center">
                  <div className="text-[13.5px] font-medium text-brand-ink">
                    Not a host yet?
                  </div>
                  <p className="mt-1 text-[12.5px] text-brand-mute">
                    List your place and reply to requests like this — free.
                  </p>
                  <Link
                    href="/signup/host"
                    className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-secondary hover:text-brand-primary"
                  >
                    Get started free <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* ── ABOUT / HOW IT WORKS ─────────────────────────────────────── */}
      <section className="border-y border-brand-line bg-brand-light">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              How it works
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-brand-ink lg:text-3xl">
              About Looking For
            </h2>
            <p className="mt-3 leading-relaxed text-brand-mute">
              Guests post what they&apos;re looking for, and hosts respond with
              personalised quotes. It&apos;s a direct, commission-free way to
              connect with travellers who are ready to book.
            </p>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-3">
            {[
              {
                n: "1",
                t: "Guest posts a request",
                d: "Location, dates, budget and must-haves — everything you need to pitch the right place.",
              },
              {
                n: "2",
                t: "Hosts send quotes",
                d: "Reply with a tailored offer for your listing. No commission — the guest pays what you quote.",
              },
              {
                n: "3",
                t: "Guest books direct",
                d: "They pick the quote they love and book straight with the host. Simple and direct.",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-card border border-brand-line bg-white p-6 shadow-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent font-display font-bold text-brand-secondary">
                  {step.n}
                </div>
                <div className="mt-4 font-display font-bold text-brand-ink">
                  {step.t}
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-mute">
                  {step.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* mobile sticky action bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-brand-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
        style={{ boxShadow: "0 -8px 24px -12px rgba(6,78,59,.18)" }}
      >
        <div className="min-w-0 leading-tight">
          <div className="font-display text-[15px] font-bold text-brand-ink">
            {budgetDisplay}
          </div>
          <div className="text-[11.5px] text-brand-mute">
            {daysLeft !== null && daysLeft > 0
              ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left · `
              : ""}
            {post.quote_count > 5 ? "5+" : post.quote_count} quote
            {post.quote_count !== 1 ? "s" : ""}
          </div>
        </div>
        <QuoteButton postId={id} authed={authed} className="ml-auto shrink-0" />
      </div>
      <div className="h-20 lg:hidden" aria-hidden />
    </div>
  );
}
