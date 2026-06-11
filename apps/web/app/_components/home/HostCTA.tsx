import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { getBrandName } from "@/lib/brand";

export async function HostCTA() {
  const brandName = await getBrandName();
  return (
    <section className="relative overflow-hidden border-b border-brand-line bg-brand-dark text-white">
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 py-14 lg:grid-cols-12 lg:px-8 lg:py-16">
        <div className="lg:col-span-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            For hosts
          </div>
          <h2 className="mt-2 max-w-2xl font-display text-2xl font-bold leading-tight tracking-tight text-white md:text-3xl lg:text-4xl">
            Got a place to share? List it on {brandName}.
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-brand-accent/80">
            Branded booking page, calendar that syncs with Airbnb &amp;
            Booking.com, unified inbox, payments via Paystack or PayPal. Flat
            monthly fee. Zero commissions.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:col-span-4">
          <Link
            href="/booking-management#cta"
            className="inline-flex items-center justify-center gap-2 rounded bg-brand-primary px-5 py-3 font-medium text-white transition-colors hover:bg-white hover:text-brand-secondary"
          >
            List your property
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/booking-management"
            className="inline-flex items-center justify-center gap-2 rounded border border-white/25 px-5 py-3 font-medium text-white transition-colors hover:bg-white/10"
          >
            See how {brandName} works
          </Link>
        </div>
      </div>
    </section>
  );
}
