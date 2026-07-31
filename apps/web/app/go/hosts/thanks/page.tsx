import { ArrowRight, Check, Download, Play } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { funnelBrochureUrl, getFunnelBySlug } from "@/lib/funnels/getFunnel";
import { toEmbed } from "@/lib/website/videoEmbed";

// Public thank-you / resource page (/go/hosts/thanks). Design direction: founder
// mockup — dark hero with the resource cards overlapping it. Kept GENERIC (no
// name/email in the URL — privacy): the personalised receipt lives inline on the
// landing page. Placeholder-safe when brochure/video aren't set yet.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wielo · Your Direct Booking Starter Kit is ready",
  robots: { index: false, follow: false },
};

const INCLUDED = [
  "Pricing worksheet with SA seasonality",
  "Photo shot-list you can do on a phone",
  "Enquiry-to-booking follow-up sequence",
];

export default async function HostsThanksPage() {
  const funnel = await getFunnelBySlug("hosts");
  if (!funnel) notFound();

  const brochureUrl = funnelBrochureUrl(funnel.brochure_path);
  const embed = funnel.video_url ? toEmbed(funnel.video_url) : null;

  return (
    <main className="min-h-screen bg-brand-light text-brand-ink">
      {/* Header */}
      <header className="bg-brand-dark">
        <div className="mx-auto flex h-16 max-w-[1060px] items-center justify-between px-6">
          <span className="font-display text-[17px] font-extrabold tracking-tight text-white">
            Wielo
          </span>
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#A7D2C1]">
            <Check className="h-4 w-4 text-brand-primary" />
            Step 2 of 2 · Access
          </span>
        </div>
      </header>

      {/* Dark hero */}
      <section className="bg-brand-dark px-6 pb-24 pt-11 text-center">
        <div className="mx-auto max-w-[1060px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#6EE7B7]/30 bg-brand-primary/[0.16] px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#6EE7B7]">
            <Check className="h-3.5 w-3.5" />
            You&apos;re in
          </span>
          <h1 className="mx-auto mt-4 max-w-[20ch] font-display text-[32px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white md:text-[42px]">
            Your Starter Kit is ready.
          </h1>
          <p className="mx-auto mt-3.5 max-w-[56ch] text-[16.5px] leading-relaxed text-[#C7E4D7]">
            Watch the walkthrough first, then download the kit.{" "}
            <b className="text-white">We&apos;ve also emailed you the link.</b>
          </p>
        </div>
      </section>

      {/* Cards overlapping the hero */}
      <div className="mx-auto max-w-[1060px] px-6">
        <div className="-mt-[72px] grid items-start gap-[22px] md:grid-cols-[1fr_350px]">
          {/* Video */}
          <div className="overflow-hidden rounded-card border border-brand-line bg-white shadow-[0_10px_34px_-14px_rgba(6,78,59,0.18)]">
            {embed ? (
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={embed}
                  title="Direct booking walkthrough"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="relative flex aspect-video w-full items-center justify-center bg-[#0F241B]">
                <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-brand-primary text-white shadow-[0_14px_40px_-12px_rgba(16,185,129,0.7)]">
                  <Play className="h-7 w-7" fill="currentColor" />
                </span>
                <span className="absolute bottom-14 left-0 right-0 text-center font-mono text-[10.5px] uppercase tracking-wide text-[#D1FAE5]/60">
                  Walkthrough video coming soon
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div>
                <h2 className="font-display text-[19px] font-extrabold tracking-tight">
                  Watch this first
                </h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-brand-mute">
                  How to use the kit on your own listing this week: price,
                  photos, and the follow-up that wins the booking.
                </p>
              </div>
            </div>
          </div>

          {/* Download */}
          <div className="rounded-card border border-brand-line bg-white p-[22px] shadow-[0_10px_34px_-14px_rgba(6,78,59,0.18)]">
            <div className="flex items-center gap-3.5">
              <div className="h-[92px] w-[70px] min-w-[70px] rounded-lg bg-[#0F241B] shadow-[0_8px_20px_-10px_rgba(6,78,59,0.5)]" />
              <div>
                <h2 className="font-display text-[17px] font-extrabold tracking-tight">
                  Direct Booking Starter Kit
                </h2>
                <p className="mt-1 text-[12.5px] text-brand-mute">
                  {funnel.brochure_name || "14-page PDF"}
                </p>
              </div>
            </div>

            {brochureUrl ? (
              <a
                href={brochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-[18px] flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand-primary text-[15px] font-bold text-white transition hover:bg-brand-secondary"
              >
                <Download className="h-[17px] w-[17px]" />
                Download the kit
              </a>
            ) : (
              <p className="mt-[18px] rounded-[10px] border border-dashed border-brand-line bg-brand-light py-3 text-center text-[13px] text-brand-mute">
                Your kit is on its way to your inbox.
              </p>
            )}

            <ul className="mt-[18px] grid gap-2.5 border-t border-brand-line pt-4">
              {INCLUDED.map((i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px]">
                  <span className="flex h-[19px] w-[19px] min-w-[19px] items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
                    <Check className="h-[11px] w-[11px]" />
                  </span>
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Next-step CTA */}
        <div className="mt-[22px] grid items-center gap-5 rounded-card border border-brand-line bg-white p-[22px] shadow-[0_1px_2px_rgba(6,78,59,0.05)] md:grid-cols-[1fr_auto]">
          <div>
            <h3 className="font-display text-[17px] font-extrabold tracking-tight">
              Want the kit set up for you?
            </h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-brand-mute">
              Build your booking site, calendar and direct checkout on Wielo —
              no commission, no service fee. Your payout is exactly what the
              guest pays.
            </p>
          </div>
          <a
            href="/signup/host"
            className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-brand-secondary px-[22px] text-[14.5px] font-bold text-white transition hover:bg-brand-primary"
          >
            Start free
            <ArrowRight className="h-[17px] w-[17px]" />
          </a>
        </div>

        <footer className="flex flex-wrap justify-between gap-4 px-1 pb-10 pt-6 text-[12.5px] text-brand-mute">
          <span>© 2026 Wielo · Hosts keep 100% of what guests pay.</span>
          <span className="flex gap-[18px]">
            <a href="/legal/privacy" className="hover:text-brand-primary">
              Privacy
            </a>
            <a href="/legal/terms" className="hover:text-brand-primary">
              Terms
            </a>
          </span>
        </footer>
      </div>
    </main>
  );
}
