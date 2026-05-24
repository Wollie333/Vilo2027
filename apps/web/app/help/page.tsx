import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CreditCard,
  Home,
  Mail,
  MessageSquare,
  RotateCcw,
  Star,
} from "lucide-react";

import { SiteFooter } from "../_components/home/SiteFooter";
import { SiteHeader } from "../_components/home/SiteHeader";

export const metadata: Metadata = {
  title: "Help — Vilo",
  description:
    "Find your way around Vilo. Help for guests and hosts on bookings, payments, calendars, refunds, and reviews.",
};

const GUEST_TOPICS = [
  {
    icon: Calendar,
    title: "Booking a stay",
    body: "Search the directory, message a host, hold the dates, and pay — through one flow.",
    href: "/explore",
    cta: "Browse listings",
  },
  {
    icon: CreditCard,
    title: "How payments work",
    body: "Pay with Paystack (card), PayPal, or manual EFT. Hosts get the funds; we just pass them through.",
    href: "/booking-management#pricing",
    cta: "See pricing",
  },
  {
    icon: RotateCcw,
    title: "Cancellations & refunds",
    body: "Every host publishes their own cancellation policy. Your refund entitlement is shown before you book.",
    href: "/terms",
    cta: "Read terms",
  },
] as const;

const HOST_TOPICS = [
  {
    icon: Home,
    title: "Listing your place",
    body: "Add photos, set pricing, configure your booking policy. Publish in under 30 minutes.",
    href: "/signup/host",
    cta: "Start as a host",
  },
  {
    icon: Calendar,
    title: "Syncing your calendars",
    body: "Two-way iCal with Airbnb, Booking.com, Google, and Apple. No more double-bookings.",
    href: "/dashboard/calendar-sync",
    cta: "Open calendar sync",
  },
  {
    icon: Star,
    title: "Reviews & response rate",
    body: "Guests review you 24h after checkout. Replying to every review lifts your repeat-booking rate ~2.4×.",
    href: "/dashboard/reviews",
    cta: "Open reviews",
  },
] as const;

export default function HelpPage() {
  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
            Help centre
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-brand-ink sm:text-5xl">
            How can we help?
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-brand-mute">
            Quick answers for guests and hosts. Can&apos;t find what you need?{" "}
            <a
              href="mailto:hello@viloplatform.com"
              className="text-brand-primary underline-offset-2 hover:underline"
            >
              Email us
            </a>{" "}
            — replies within one working day.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-14 px-5 py-16 lg:px-8 lg:py-20">
        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
            For guests
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUEST_TOPICS.map((t) => (
              <TopicCard key={t.title} {...t} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
            For hosts
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOST_TOPICS.map((t) => (
              <TopicCard key={t.title} {...t} />
            ))}
          </div>
        </section>

        <section className="rounded-card border border-brand-line bg-white p-7 shadow-card">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold text-brand-ink">
                Still stuck? Email us
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-brand-mute">
                A founder reads every email. We don&apos;t use a tier-1 support
                queue, so you get someone who actually understands the platform.
              </p>
              <a
                href="mailto:hello@viloplatform.com"
                className="mt-4 inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-secondary"
              >
                <MessageSquare className="h-4 w-4" />
                hello@viloplatform.com
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function TopicCard({
  icon: Icon,
  title,
  body,
  href,
  cta,
}: {
  icon: typeof Calendar;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-card border border-brand-line bg-white p-5 shadow-card transition-colors hover:border-brand-primary"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-brand-ink">
        {title}
      </h3>
      <p className="mt-1 flex-1 text-[13.5px] leading-relaxed text-brand-mute">
        {body}
      </p>
      <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary group-hover:underline">
        {cta}
        <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
