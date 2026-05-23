import Link from "next/link";
import { Check } from "lucide-react";

type Tier = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

const tiers: Tier[] = [
  {
    name: "Basic",
    price: "R299",
    cadence: "/ month",
    blurb: "For the host with one place to fill.",
    features: [
      "1 listing",
      "1 staff seat",
      "Direct payments (Paystack, PayPal, EFT)",
      "Two-way calendar sync",
      "Guest inbox",
    ],
    cta: "Start free trial",
  },
  {
    name: "Pro",
    price: "R599",
    cadence: "/ month",
    blurb: "For the host running it as a real business.",
    features: [
      "Up to 5 listings",
      "3 staff seats",
      "Everything in Basic",
      "Policy templates & snapshots",
      "Custom Vilo profile URL",
      "Priority support",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Business",
    price: "R1,199",
    cadence: "/ month",
    blurb: "For agencies and multi-property operators.",
    features: [
      "Unlimited listings",
      "10 staff seats",
      "Everything in Pro",
      "Role-based access control",
      "Bulk pricing & policies",
      "Account manager",
    ],
    cta: "Start free trial",
  },
];

function TierCard({ tier }: { tier: Tier }) {
  const borderClass = tier.highlight
    ? "border-brand-primary ring-1 ring-brand-primary/30"
    : "border-brand-line";
  const ctaClass = tier.highlight
    ? "bg-brand-primary text-white hover:bg-brand-dark"
    : "border border-brand-primary text-brand-primary hover:bg-brand-accent";
  return (
    <div
      className={`relative flex flex-col rounded-card border bg-white p-6 sm:p-8 ${borderClass}`}
    >
      {tier.highlight && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-pill bg-brand-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-glow">
          Most popular
        </span>
      )}
      <div>
        <h3 className="font-display text-xl font-bold text-brand-dark">
          {tier.name}
        </h3>
        <p className="mt-1 text-sm text-brand-mute">{tier.blurb}</p>
      </div>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold text-brand-dark">
          {tier.price}
        </span>
        <span className="text-sm text-brand-mute">{tier.cadence}</span>
      </div>

      <ul className="mt-6 space-y-2.5 text-sm">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-brand-ink">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/register"
        className={`mt-8 inline-flex items-center justify-center gap-2 rounded px-5 py-2.5 text-sm font-medium transition-colors duration-150 ease-out ${ctaClass}`}
      >
        {tier.cta}
      </Link>
    </div>
  );
}

export function Pricing() {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-b border-brand-line bg-brand-light/40"
    >
      <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
        <div className="mb-12 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Pricing
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-brand-dark sm:text-4xl">
            One flat fee. Zero booking commission.
          </h2>
          <p className="mt-3 text-brand-mute">
            Hosts pay. Guests don&apos;t. Every plan starts with a 14-day free
            trial — annual billing gets you two months free.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-brand-mute">
          Prices in ZAR, exclusive of any payment-processor fees. Suggested
          launch pricing — see your billing settings for the rate on the day you
          sign up.
        </p>
      </div>
    </section>
  );
}
