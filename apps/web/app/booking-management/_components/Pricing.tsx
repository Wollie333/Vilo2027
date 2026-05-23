"use client";

import { ArrowRight, Check, Gift, Minus } from "lucide-react";
import { useState } from "react";

type Tier = {
  name: string;
  tagline: string;
  annual: { price: string; sub: string };
  monthly: { price: string; sub: string };
  cta: { label: string; primary: boolean };
  bullets: Array<{ text: React.ReactNode; included: boolean }>;
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Basic",
    tagline: "For new hosts",
    annual: { price: "R 249", sub: "Billed annually · R 311/mo monthly" },
    monthly: { price: "R 311", sub: "Billed monthly · R 249/mo annually" },
    cta: { label: "Start 14-day trial", primary: false },
    bullets: [
      {
        text: (
          <>
            <span className="font-medium">1 listing</span> · unlimited bookings
          </>
        ),
        included: true,
      },
      { text: "Branded booking page", included: true },
      { text: "Inbox, calendar, reviews", included: true },
      { text: "Paystack + manual EFT", included: true },
      { text: "iCal sync & PayPal", included: false },
      { text: "Staff seats", included: false },
    ],
  },
  {
    name: "Pro",
    tagline: "For growing operators",
    annual: { price: "R 499", sub: "Billed annually · R 624/mo monthly" },
    monthly: { price: "R 624", sub: "Billed monthly · R 499/mo annually" },
    cta: { label: "Start 14-day trial", primary: true },
    popular: true,
    bullets: [
      {
        text: (
          <>
            <span className="font-medium">Up to 5 listings</span> · unlimited
            bookings
          </>
        ),
        included: true,
      },
      { text: "Everything in Basic", included: true },
      { text: "iCal sync with Airbnb & Booking.com", included: true },
      { text: "PayPal for international guests", included: true },
      { text: "3 staff seats & activity log", included: true },
      { text: "Custom domain", included: true },
    ],
  },
  {
    name: "Business",
    tagline: "For property managers",
    annual: { price: "R 1 199", sub: "Billed annually · R 1 499/mo monthly" },
    monthly: { price: "R 1 499", sub: "Billed monthly · R 1 199/mo annually" },
    cta: { label: "Talk to sales", primary: false },
    bullets: [
      {
        text: (
          <>
            <span className="font-medium">Unlimited listings</span> &amp;
            bookings
          </>
        ),
        included: true,
      },
      { text: "Everything in Pro", included: true },
      { text: "Unlimited staff seats", included: true },
      { text: "Priority support & onboarding call", included: true },
      { text: "White-label guest emails", included: true },
      { text: "API & webhook access", included: true },
    ],
  },
];

export function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  return (
    <section id="pricing" className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Pricing
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
            Flat fee. Forever.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-brand-mute">
            No commissions, no per-booking nibbling. Pick the plan that fits —
            change or cancel any time.
          </p>

          <div className="mt-7 inline-flex items-center gap-1 rounded-pill bg-brand-accent p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-pill px-4 py-1.5 text-xs ${
                billing === "monthly"
                  ? "bg-white font-semibold text-brand-dark shadow-card"
                  : "font-medium text-brand-mute"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-xs ${
                billing === "annual"
                  ? "bg-white font-semibold text-brand-dark shadow-card"
                  : "font-medium text-brand-mute"
              }`}
            >
              Annual
              <span className="rounded-pill bg-brand-secondary px-1.5 py-0.5 text-[9px] font-bold text-white">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3 lg:gap-5">
          {TIERS.map((tier) => {
            const isPopular = !!tier.popular;
            const price =
              billing === "annual" ? tier.annual.price : tier.monthly.price;
            const sub =
              billing === "annual" ? tier.annual.sub : tier.monthly.sub;
            return (
              <div
                key={tier.name}
                className={
                  isPopular
                    ? "relative flex flex-col rounded-card border-2 border-brand-primary bg-brand-light p-7 shadow-card"
                    : "flex flex-col rounded-card border border-brand-line bg-white p-7"
                }
              >
                {isPopular ? (
                  <span className="ribbon absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill px-3 py-1 text-[10px] font-bold tracking-wider">
                    MOST POPULAR
                  </span>
                ) : null}

                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isPopular ? "text-brand-primary" : "text-brand-mute"
                    }`}
                  >
                    {tier.name}
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-brand-dark">
                    {tier.tagline}
                  </div>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="num-display font-display text-5xl font-bold text-brand-dark">
                    {price}
                  </span>
                  <span className="text-sm text-brand-mute">/month</span>
                </div>
                <div className="mt-1 text-xs text-brand-mute">{sub}</div>

                <a
                  href="/register"
                  className={
                    tier.cta.primary
                      ? "mt-6 inline-flex items-center justify-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-dark"
                      : "mt-6 inline-flex items-center justify-center gap-1.5 rounded border border-brand-primary px-4 py-2.5 font-medium text-brand-primary transition-colors hover:bg-brand-accent"
                  }
                >
                  {tier.cta.label}
                  {tier.cta.primary ? <ArrowRight className="h-4 w-4" /> : null}
                </a>

                <ul className="mt-7 space-y-3 text-sm text-brand-dark">
                  {tier.bullets.map((b, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2.5 ${b.included ? "" : "text-brand-mute"}`}
                    >
                      {b.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                      ) : (
                        <Minus className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Free tier strip */}
        <div className="mx-auto mt-10 flex max-w-5xl flex-col gap-4 rounded-card border border-brand-line bg-brand-accent/40 p-5 md:flex-row md:items-center lg:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-brand-line bg-white text-brand-primary">
            <Gift className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display font-semibold text-brand-dark">
              Just starting out? There&rsquo;s a free tier.
            </div>
            <div className="mt-0.5 text-sm text-brand-mute">
              List 1 property in the Vilo Directory at no cost. Upgrade when
              you&rsquo;re ready to take direct bookings.
            </div>
          </div>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-dark"
          >
            See free tier <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
