import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  MessageSquare,
  PencilLine,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import { MAX_ACTIVE_LOOKING_FOR_POSTS } from "@/lib/looking-for/limits";
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

export default async function LookingForStartPage() {
  const brand = await getBrandName();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in guests go straight to the form; everyone else signs up first and
  // lands right back on it (?next survives the guest signup).
  const postHref = user
    ? "/portal/looking-for/new"
    : "/signup/guest?next=/portal/looking-for/new";
  const ctaLabel = user
    ? "Post your free request"
    : "Sign up & post — it's free";

  return (
    <div className="bg-brand-light text-brand-ink">
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
