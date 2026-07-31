import { Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getFunnelBySlug } from "@/lib/funnels/getFunnel";

import { FunnelForm } from "../_components/FunnelForm";

// Public Hosts lead-magnet landing page (/go/hosts). Locale-free functional route
// (see middleware FUNCTIONAL). Design direction: founder mockup — dark hero, a
// white capture card with inline success, and a 3-step strip. Copy is DB-driven
// (funnels row) so it's editable without a deploy; bullets/steps are static for now.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wielo · Free Direct Booking Starter Kit for Hosts",
  robots: { index: false, follow: false },
};

const BULLETS = [
  "A 14-page playbook you can work through in one evening",
  "Rate & occupancy calculator (Google Sheet, ready to copy)",
  "7 guest enquiry reply templates that convert",
];

const STEPS = [
  {
    n: "01",
    t: "Download the kit",
    d: "Arrives by email the second you submit — no waiting list, no sales call first.",
  },
  {
    n: "02",
    t: "Try the moves",
    d: "Work through the pricing and enquiry sections on your own listing this week.",
  },
  {
    n: "03",
    t: "We check in once",
    d: "One short email a week later asking what worked. Reply, or don't — your call.",
  },
];

export default async function HostsFunnelPage() {
  const funnel = await getFunnelBySlug("hosts");
  if (!funnel) notFound();

  return (
    <main className="min-h-screen bg-brand-light text-brand-ink">
      {/* Header (dark) */}
      <header className="bg-brand-dark">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <span className="font-display text-[17px] font-extrabold tracking-tight text-white">
            Wielo
          </span>
          <a
            href="/login"
            className="text-[13.5px] font-medium text-[#A7D2C1] hover:text-white"
          >
            Already a host? Sign in
          </a>
        </div>
      </header>

      {/* Hero (dark) */}
      <section className="bg-brand-dark">
        <div className="mx-auto grid max-w-[1120px] gap-14 px-6 pb-16 pt-14 md:grid-cols-[1fr_428px]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-brand-accent">
              Free for South African hosts
            </span>
            <h1 className="mt-5 font-display text-[38px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white md:text-[52px]">
              {funnel.headline ?? "Get more direct bookings. Keep every rand."}
            </h1>
            {funnel.subcopy ? (
              <p className="mt-[18px] max-w-[46ch] text-[17.5px] leading-relaxed text-[#C7E4D7]">
                {funnel.subcopy}
              </p>
            ) : null}
            <ul className="mt-7 grid max-w-[44ch] gap-3">
              {BULLETS.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-[11px] text-[15px] text-[#DFF3E9]"
                >
                  <span className="flex h-[22px] w-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand-primary/20 text-[#6EE7B7]">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] font-semibold text-[#8FC4AE]">
              <span>Zero commission. Ever.</span>
              <span>·</span>
              <span>No card required</span>
              <span>·</span>
              <span>Instant download</span>
            </div>
          </div>

          <FunnelForm slug="hosts" />
        </div>
      </section>

      {/* 3-step strip */}
      <section className="border-t border-brand-line bg-white">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-6 py-11 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="font-mono text-[12px] font-semibold text-brand-primary">
                {s.n}
              </div>
              <h3 className="mb-1.5 mt-2.5 font-display text-[16px] font-bold">
                {s.t}
              </h3>
              <p className="text-[13.5px] leading-relaxed text-brand-mute">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white">
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-4 px-6 pb-10 pt-2 text-[12.5px] text-brand-mute">
          <span>© 2026 Wielo · Hosts keep 100% of what guests pay.</span>
          <span className="flex gap-[18px]">
            <a href="/legal/privacy" className="hover:text-brand-primary">
              Privacy
            </a>
            <a href="/legal/terms" className="hover:text-brand-primary">
              Terms
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}
