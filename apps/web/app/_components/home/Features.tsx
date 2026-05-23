import {
  CalendarSync,
  CreditCard,
  MapPin,
  MessageCircle,
  Search,
  Shield,
  Smartphone,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const hostFeatures: Feature[] = [
  {
    icon: Wallet,
    title: "Zero commission",
    body: "Flat monthly subscription. Every rand a guest pays lands in your account.",
  },
  {
    icon: CalendarSync,
    title: "Two-way calendar sync",
    body: "iCal in and out for Airbnb, Booking.com, Vrbo. No double bookings.",
  },
  {
    icon: CreditCard,
    title: "Local payments, your way",
    body: "Paystack, PayPal, or manual EFT with proof-of-payment upload.",
  },
];

const guestFeatures: Feature[] = [
  {
    icon: Search,
    title: "Direct from the host",
    body: "Browse real listings without marketplace mark-ups or middlemen.",
  },
  {
    icon: MessageCircle,
    title: "Talk to a real person",
    body: "Real-time inbox with the host themselves — no scripted call centre.",
  },
  {
    icon: Shield,
    title: "Cancellation you can read",
    body: "Every booking shows the policy that applied — frozen at the moment you paid.",
  },
];

const universal: Feature[] = [
  {
    icon: Smartphone,
    title: "Mobile-first, by default",
    body: "Hosts run their inbox from their phone. Guests browse from their phone. So we built phone-first.",
  },
  {
    icon: MapPin,
    title: "Made in South Africa",
    body: "Rand pricing, EFT, Paystack, local POPIA-aware data handling. Frankfurt-hosted for now, af-south-1 on the roadmap.",
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <div className="rounded-card border border-brand-line bg-white p-6 transition-colors duration-150 ease-out hover:border-brand-primary/40">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-brand-dark">
        {feature.title}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-brand-mute">
        {feature.body}
      </p>
    </div>
  );
}

export function Features() {
  return (
    <section className="border-b border-brand-line bg-brand-light/40">
      <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
        <div className="mb-10 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            What you get
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-brand-dark sm:text-4xl">
            Built for both sides of the booking.
          </h2>
          <p className="mt-3 text-brand-mute">
            Hosts run the whole business. Guests get a calm, honest place to
            book. One platform, two front doors.
          </p>
        </div>

        <div id="hosts" className="grid scroll-mt-24 gap-8 md:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-pill bg-brand-accent px-3 py-1 text-xs font-medium text-brand-primary">
              <span className="h-1.5 w-1.5 rounded-pill bg-brand-primary" />
              For hosts
            </div>
            <div className="grid gap-4">
              {hostFeatures.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>

          <div id="guests" className="scroll-mt-24">
            <div className="mb-4 inline-flex items-center gap-2 rounded-pill bg-brand-secondary/10 px-3 py-1 text-xs font-medium text-brand-secondary">
              <span className="h-1.5 w-1.5 rounded-pill bg-brand-secondary" />
              For guests
            </div>
            <div className="grid gap-4">
              {guestFeatures.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {universal.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
