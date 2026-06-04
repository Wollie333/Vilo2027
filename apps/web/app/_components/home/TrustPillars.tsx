import {
  BadgeCheck,
  MessageSquare,
  Receipt,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { getBrandName } from "@/lib/brand";

type Pillar = { icon: LucideIcon; title: string; body: string };

const PILLARS: Pillar[] = [
  {
    icon: Receipt,
    title: "No guest fees",
    body: "The price you see is the price you pay. No service fees, no surprise charges at checkout.",
  },
  {
    icon: BadgeCheck,
    title: "Verified hosts",
    body: "Every host is ID-verified and payment-vetted before they can list. Look for the green tick.",
  },
  {
    icon: MessageSquare,
    title: "Talk to the host",
    body: "Message the actual host before you book. Real answers, no scripted call-centre replies.",
  },
  {
    icon: RotateCcw,
    title: "Honest cancellations",
    body: "Policies shown up-front with a one-tap refund preview. No hunting through fine print.",
  },
];

export async function TrustPillars() {
  const brandName = await getBrandName();
  return (
    <section className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Why book on {brandName}
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
            Direct stays, the way they should be.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-card border border-brand-line bg-white p-6"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded bg-brand-accent text-brand-secondary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="font-display text-lg font-semibold text-brand-ink">
                {title}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
