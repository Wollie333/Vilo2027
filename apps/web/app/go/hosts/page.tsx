import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getFunnelBySlug } from "@/lib/funnels/getFunnel";

import { FunnelForm } from "../_components/FunnelForm";

// Public Hosts landing page (/go/hosts). Locale-free functional route (see
// middleware FUNCTIONAL). Minimal, on-brand scaffold — the real design drops in
// later; the form + submit spine are what matter here.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wielo for Hosts — List once, keep 100%, book direct",
  robots: { index: false, follow: false }, // funnel page, not for search
};

const BENEFITS = [
  "0% commission — keep 100% of your booking money",
  "Direct bookings with card, PayPal & EFT",
  "Calendar, policies & guest messaging in one place",
];

export default async function HostsFunnelPage() {
  const funnel = await getFunnelBySlug("hosts");
  if (!funnel) notFound();

  return (
    <main className="min-h-screen bg-brand-light text-brand-ink">
      {/* Compact top bar — minimise exits. */}
      <header className="border-b border-brand-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-display text-lg font-bold text-brand-secondary">
            Wielo
          </span>
          <a
            href="/login"
            className="text-sm font-medium text-brand-mute hover:text-brand-ink"
          >
            Sign in
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
        {/* Left: pitch */}
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight text-brand-secondary md:text-4xl">
            {funnel.headline ?? "List once. Keep 100%. Book direct."}
          </h1>
          {funnel.subcopy ? (
            <p className="mt-4 text-lg text-brand-mute">{funnel.subcopy}</p>
          ) : null}
          <ul className="mt-6 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-brand-ink">
                <span
                  aria-hidden
                  className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-primary"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-brand-mute">
            No commission • Direct bookings • Made in South Africa
          </p>
        </div>

        {/* Right: capture card */}
        <div className="rounded-card border border-brand-line bg-white p-5 shadow-sm md:p-6">
          <h2 className="font-display text-xl font-bold text-brand-secondary">
            Get the free Host Guide
          </h2>
          <p className="mt-1 text-sm text-brand-mute">
            See how direct bookings work on Wielo.
          </p>
          <div className="mt-4">
            <FunnelForm
              slug="hosts"
              showAddress
              submitLabel="Get the free Host Guide"
            />
          </div>
        </div>
      </div>

      <footer className="border-t border-brand-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-brand-mute">
          <a href="/legal/privacy" className="hover:text-brand-ink">
            Privacy
          </a>{" "}
          ·{" "}
          <a href="/legal/terms" className="hover:text-brand-ink">
            Terms
          </a>
        </div>
      </footer>
    </main>
  );
}
