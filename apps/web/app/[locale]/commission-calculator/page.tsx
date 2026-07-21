import type { Metadata } from "next";
import { ArrowRight, Calculator, HandCoins, ShieldCheck } from "lucide-react";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { FunnelTracker } from "@/components/funnel/FunnelTracker";
import { Link } from "@/i18n/navigation";
import { getBrandName } from "@/lib/brand";
import { FUNNEL_CALCULATOR } from "@/lib/funnel/shared";
import {
  clampNumber,
  LISTINGS_MAX,
  LISTINGS_MIN,
  RATE_MAX,
  RATE_MIN,
  REVENUE_MAX,
  REVENUE_MIN,
} from "@/lib/products/commissionMath";
import { getPublicMembershipPricing } from "@/lib/products/membershipPublic";

import { CommissionCalculatorTool } from "./_components/CommissionCalculatorTool";

export const dynamic = "force-dynamic";

// WS-8 — the shareable commission-maths tool the partner pack links to. A host
// enters their revenue and sees, in rand, what commission costs them per year
// against Wielo's flat subscription. Prices come from the live products row.

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandName();
  return {
    title: `Commission calculator — what booking sites really cost you | ${brand}`,
    description:
      "Enter your monthly bookings revenue and see exactly what commission costs you every year, against a flat monthly fee with 0% commission.",
  };
}

const num = (
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
) => (raw === undefined ? fallback : clampNumber(Number(raw), min, max));

export default async function CommissionCalculatorPage({
  searchParams,
}: {
  searchParams: { revenue?: string; rate?: string; listings?: string };
}) {
  const [brand, pricing] = await Promise.all([
    getBrandName(),
    getPublicMembershipPricing(),
  ]);

  // Shareable: a partner sends a link with the numbers already dialled in.
  const initial = {
    revenue: num(searchParams.revenue, 65_000, REVENUE_MIN, REVENUE_MAX),
    rate: num(searchParams.rate, 17, RATE_MIN, RATE_MAX),
    listings: Math.round(
      num(searchParams.listings, 1, LISTINGS_MIN, LISTINGS_MAX),
    ),
  };

  return (
    <div className="bg-brand-light text-brand-ink">
      <FunnelTracker event="landing_view" funnel={FUNNEL_CALCULATOR} />
      <SiteHeader />

      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-brand-primary/25 bg-brand-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-secondary">
            <Calculator className="h-3.5 w-3.5" /> Commission calculator
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-brand-ink md:text-5xl">
            What is commission actually costing you?
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-mute">
            Every booking through a commission site quietly takes a slice of
            money you already earned. Put your real numbers in below — it works
            in rand, and it subtracts what {brand} costs, so the figure you see
            is the honest one.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
        <CommissionCalculatorTool pricing={pricing} initial={initial} />

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Fact
            icon={<HandCoins className="h-5 w-5 text-brand-primary" />}
            title="Guests pay you direct"
            body={`Card, EFT or PayPal straight into your account. ${brand} never sits between you and your money, and never takes a cut of a booking.`}
          />
          <Fact
            icon={<ShieldCheck className="h-5 w-5 text-brand-primary" />}
            title="One flat fee"
            body="You pay the same whether you take one booking a month or fifty. Extra places you rent out are charged per place — no surprises at the end of a good season."
          />
          <Fact
            icon={<Calculator className="h-5 w-5 text-brand-primary" />}
            title="The honest maths"
            body="The subscription is subtracted, not hidden. If your revenue is still small, the calculator tells you straight that commission is cheaper for now."
          />
        </div>

        <div className="mt-8 rounded-card border border-brand-line bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold text-brand-ink">
            How this is worked out
          </h2>
          <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-brand-mute">
            <li>
              • Commission is your monthly bookings revenue × the rate you set.
              The preset rates are the published headline rates; yours may
              differ, so type in your own.
            </li>
            <li>
              • {brand} is charged monthly: the base fee covers your first
              place, and each additional place adds a per-place amount.
            </li>
            <li>
              • Nothing here counts payment-processing fees — both a commission
              site and {brand} leave those with your payment provider, so they
              cancel out.
            </li>
          </ul>
          <Link
            href="/signup/host"
            className="mt-5 inline-flex items-center gap-2 rounded-[12px] bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-secondary"
          >
            List your place on {brand}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Fact({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      {icon}
      <div className="mt-2.5 font-display text-[15px] font-bold text-brand-ink">
        {title}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-mute">
        {body}
      </p>
    </div>
  );
}
