import Link from "next/link";

import { VLogo } from "./VLogo";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-brand-line bg-white">
      <div aria-hidden className="absolute inset-0 bg-dot-grid opacity-60" />
      <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28 lg:px-10">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Vilo Platform
          </span>
          <span className="text-brand-line">/</span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-brand-mute">
            South Africa
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-6">
          <VLogo
            className="h-20 w-20 shrink-0 lg:h-24 lg:w-24"
            gradientId="heroLogoGradient"
            withGlow
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-brand-ink md:text-5xl lg:text-6xl">
              Book direct.{" "}
              <span className="text-brand-primary">Keep the commission.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base text-brand-mute sm:text-lg">
              Vilo is a direct-booking platform for South African accommodation
              hosts, experience operators, and the guests who travel with them.
              One subscription. Zero booking fees. Ever.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded bg-brand-primary px-6 py-3 text-base font-medium text-white shadow-glow transition-colors duration-150 ease-out hover:bg-brand-dark"
          >
            List your stay
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="#guests"
            className="inline-flex items-center gap-2 rounded border border-brand-primary px-6 py-3 text-base font-medium text-brand-primary transition-colors duration-150 ease-out hover:bg-brand-accent"
          >
            Browse stays
          </Link>
          <span className="ml-1 inline-flex items-center gap-2 text-xs text-brand-mute">
            <span className="h-1.5 w-1.5 rounded-pill bg-brand-primary" />
            14-day free trial · no card surcharge · cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}
