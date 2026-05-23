import type { Metadata } from "next";
import { ExternalLink, LifeBuoy, Mail } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help & docs · Vilo",
};

const LINKS = [
  {
    label: "How Vilo works",
    href: "/booking-management",
    external: false,
  },
  {
    label: "Pricing",
    href: "/booking-management#pricing",
    external: false,
  },
  {
    label: "FAQ",
    href: "/booking-management#faq",
    external: false,
  },
  {
    label: "Changelog",
    href: "/change-log",
    external: false,
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
          Help &amp; docs
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          The fastest way to get unstuck. The full help centre lands closer to
          public launch.
        </p>
      </header>

      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-base font-semibold text-brand-ink">
              Email a real person
            </div>
            <p className="mt-1 text-sm text-brand-mute">
              Beta-phase support is a single inbox we read every day. Reply
              under one hour during SA business hours.
            </p>
            <a
              href="mailto:hello@viloplatform.com"
              className="mt-3 inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
            >
              <Mail className="h-4 w-4" />
              hello@viloplatform.com
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-base font-semibold text-brand-ink">
              Marketing pages &amp; the changelog
            </div>
            <p className="mt-1 text-sm text-brand-mute">
              While the help centre is being written, the public site covers
              most &ldquo;how does Vilo do X&rdquo; questions.
            </p>
            <ul className="mt-4 space-y-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    target={l.external ? "_blank" : undefined}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:underline"
                  >
                    {l.label}
                    {l.external ? (
                      <ExternalLink className="h-3.5 w-3.5" />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
