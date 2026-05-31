import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Home,
  Luggage,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Create your Vilo account",
  description:
    "Pick how you want to use Vilo — book stays as a guest, or host your own property.",
};

export default function SignupChoicePage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.05fr_1fr]">
      <Showcase />

      <main className="relative flex min-w-0 items-stretch justify-center bg-brand-light/50 p-6 lg:items-center lg:p-10 xl:p-12">
        <div className="w-full max-w-[520px] py-10 lg:py-0">
          <div className="vilo-fade-up">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-primary">
              Get started
            </div>
            <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-tight text-brand-ink sm:text-[36px]">
              How do you want to use Vilo?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-brand-mute">
              Pick one — you can always add the other later from your settings.
            </p>
          </div>

          <div className="vilo-fade-up vilo-delay-1 mt-7 space-y-3">
            <ChoiceCard
              href="/signup/guest"
              icon={<Luggage className="h-6 w-6" />}
              eyebrow="For travellers"
              title="I want to book stays"
              desc="Discover hosts, book direct with no booking fees, and chat to the host before you arrive."
            />
            <ChoiceCard
              href="/signup/host"
              icon={<Home className="h-6 w-6" />}
              eyebrow="For property owners"
              title="I want to host my property"
              desc="List a guesthouse, B&B, lodge or cottage. Take direct bookings on a flat monthly fee."
            />
          </div>

          <div className="vilo-fade-up vilo-delay-2 mt-7 border-t border-brand-line pt-6 text-center text-[13px] text-brand-mute">
            Already have an account?
            <Link
              href="/login"
              className="ml-1 font-semibold text-brand-ink underline decoration-brand-line underline-offset-4 hover:text-brand-primary"
            >
              Sign in
            </Link>
          </div>

          <div className="vilo-fade-up vilo-delay-3 mt-6 flex items-center justify-center gap-5 text-[10.5px] text-brand-mute">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" /> 256-bit
              TLS
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-brand-primary" /> POPIA
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function ChoiceCard({
  href,
  icon,
  eyebrow,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-card border border-brand-line bg-white p-5 transition hover:-translate-y-px hover:border-brand-primary hover:shadow-lift"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand-accent text-brand-secondary transition group-hover:bg-brand-primary group-hover:text-white">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">
          {eyebrow}
        </div>
        <div className="mt-1 font-display text-lg font-bold text-brand-ink">
          {title}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-brand-mute">{desc}</p>
      </div>
      <ArrowRight className="mt-3 h-5 w-5 shrink-0 text-brand-mute transition group-hover:translate-x-0.5 group-hover:text-brand-primary" />
    </Link>
  );
}

function Showcase() {
  return (
    <aside className="relative flex min-h-[260px] flex-col overflow-hidden bg-brand-gradient-dark p-8 text-white lg:min-h-0 lg:p-14 xl:p-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-25"
      />
      <span className="vilo-orb vilo-orb-1" aria-hidden />
      <span className="vilo-orb vilo-orb-2" aria-hidden />
      <span className="vilo-orb vilo-orb-3" aria-hidden />

      <div className="relative flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <svg
            className="vilo-logo-pulse h-10 w-10 rounded-md"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="signup-logoG"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#064E3B" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" rx="22" fill="url(#signup-logoG)" />
            <path
              d="M50 76L20 32H36L50 56L64 32H80L50 76Z"
              fill="white"
              opacity="0.4"
            />
            <path
              d="M50 66L26 32H38L50 50L62 32H74L50 66Z"
              fill="white"
              opacity="0.7"
            />
            <path d="M50 56L32 32H40L50 46L60 32H68L50 56Z" fill="white" />
          </svg>
          <div className="leading-none">
            <div className="font-display text-[19px] font-bold tracking-tight">
              Vilo
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-300/80">
              Direct booking platform
            </div>
          </div>
        </Link>
        <Link
          href="/"
          className="hidden items-center gap-1.5 text-[12px] text-emerald-200/70 transition-colors hover:text-white lg:inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to homepage
        </Link>
      </div>

      <div className="relative flex max-w-md flex-1 flex-col justify-center py-8 lg:py-12">
        <div className="inline-flex items-center gap-1.5 self-start rounded-pill bg-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200/95 ring-1 ring-white/15 backdrop-blur-sm">
          <Sparkles className="h-3 w-3" /> One platform, two sides
        </div>
        <h2 className="mt-5 font-display text-3xl font-bold leading-[1.1] tracking-tight lg:text-4xl xl:text-[44px]">
          Direct bookings. No commission.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-emerald-100/75">
          Guests pay zero booking fees. Hosts keep 100% of what guests pay — one
          flat subscription, no commission per booking.
        </p>
      </div>

      <div className="relative grid grid-cols-3 gap-3">
        {[
          { v: "12k+", l: "Properties" },
          { v: "0%", l: "Booking fee" },
          { v: "4.9★", l: "Avg rating" },
        ].map((s) => (
          <div
            key={s.l}
            className="rounded-card border border-white/10 bg-white/[0.04] p-3 text-center"
          >
            <div className="font-display text-xl font-bold text-white">
              {s.v}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-emerald-200/70">
              {s.l}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-8 flex items-center justify-between text-[11px] text-emerald-200/55">
        <div>© 2026 Vilo Platform (Pty) Ltd</div>
        <div className="flex gap-4">
          <Link href="/help" className="hover:text-white">
            Help
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
        </div>
      </div>
    </aside>
  );
}
