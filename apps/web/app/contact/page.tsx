import type { Metadata } from "next";
import { Building2, Mail, MessageSquare } from "lucide-react";

import { SiteFooter } from "../_components/home/SiteFooter";
import { SiteHeader } from "../_components/home/SiteHeader";

export const metadata: Metadata = {
  title: "Contact — Vilo",
  description:
    "Get in touch with the Vilo team — support, partnerships, press, or just to say hi.",
};

const CONTACTS: Array<{
  label: string;
  description: string;
  email: string;
  icon: typeof Mail;
}> = [
  {
    label: "Support",
    description: "Help with your account, booking, payment, or listing.",
    email: "hello@viloplatform.com",
    icon: MessageSquare,
  },
  {
    label: "Privacy / POPIA",
    description: "Data subject requests, deletion, anything privacy.",
    email: "privacy@viloplatform.com",
    icon: Building2,
  },
  {
    label: "Press & partnerships",
    description: "Brand collabs, journalists, integration partners.",
    email: "hello@viloplatform.com",
    icon: Mail,
  },
];

export default function ContactPage() {
  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
            Contact
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-brand-ink sm:text-5xl">
            Talk to a real person
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-brand-mute">
            No tier-1 chatbot, no ticket system. The team is small and you
            usually hear back within one working day.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {CONTACTS.map((c) => (
            <a
              key={c.label}
              href={`mailto:${c.email}`}
              className="group flex items-start gap-3 rounded-card border border-brand-line bg-white p-5 shadow-card transition-colors hover:border-brand-primary"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
                <c.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-base font-semibold text-brand-ink">
                  {c.label}
                </div>
                <p className="mt-1 text-[13px] text-brand-mute">
                  {c.description}
                </p>
                <div className="mt-2 truncate font-mono text-xs text-brand-primary group-hover:underline">
                  {c.email}
                </div>
              </div>
            </a>
          ))}
        </div>

        <section className="mt-12 rounded-card border border-brand-line bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold text-brand-ink">
            Where we are
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-brand-mute">
            Vilo Platform (Pty) Ltd is based in Cape Town, South Africa. Our
            infrastructure currently runs in Frankfurt (with a planned migration
            to Cape Town before public launch — see our{" "}
            <a
              href="/privacy"
              className="text-brand-primary underline-offset-2 hover:underline"
            >
              privacy policy
            </a>
            ).
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
