import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { funnelBrochureUrl, getFunnelBySlug } from "@/lib/funnels/getFunnel";
import { toEmbed } from "@/lib/website/videoEmbed";

// Public thank-you page (/go/hosts/thanks). Shows the resource (brochure + video)
// inline and confirms it was emailed. Placeholder-safe: renders a friendly
// "we'll email it" state when no brochure/video is set yet.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're in — Wielo Host Guide",
  robots: { index: false, follow: false },
};

export default async function HostsThanksPage() {
  const funnel = await getFunnelBySlug("hosts");
  if (!funnel) notFound();

  const brochureUrl = funnelBrochureUrl(funnel.brochure_path);
  const embed = funnel.video_url ? toEmbed(funnel.video_url) : null;

  return (
    <main className="min-h-screen bg-brand-light text-brand-ink">
      <header className="border-b border-brand-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
          <span className="font-display text-lg font-bold text-brand-secondary">
            Wielo
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-center gap-2 text-brand-primary">
          <span
            aria-hidden
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-accent text-sm"
          >
            ✓
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide">
            You&apos;re in
          </span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold text-brand-secondary">
          Here&apos;s your Host Guide
        </h1>
        <p className="mt-2 text-brand-mute">
          We&apos;ve also emailed these to you.
        </p>

        {/* Resource block */}
        <div className="mt-8 rounded-card border border-brand-line bg-white p-5 md:p-6">
          {embed ? (
            <div className="aspect-video w-full overflow-hidden rounded-[10px] bg-black">
              <iframe
                src={embed}
                title="Wielo Host Guide video"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-[10px] border border-dashed border-brand-line bg-brand-light text-sm text-brand-mute">
              Video coming soon
            </div>
          )}

          <div className="mt-5">
            {brochureUrl ? (
              <a
                href={brochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-[10px] bg-brand-primary px-4 py-2.5 font-semibold text-white transition hover:opacity-90"
              >
                Download the brochure (PDF)
              </a>
            ) : (
              <p className="text-sm text-brand-mute">
                Your guide is on its way to your inbox.
              </p>
            )}
          </div>
        </div>

        {/* Next step */}
        <div className="mt-8 text-center">
          <a
            href="/signup/host"
            className="inline-block rounded-[10px] border border-brand-primary px-5 py-2.5 font-semibold text-brand-primary transition hover:bg-brand-accent"
          >
            Start your free host account →
          </a>
        </div>
      </div>

      <footer className="border-t border-brand-line bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs text-brand-mute">
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
