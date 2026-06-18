import type { Metadata } from "next";
import {
  ArrowRight,
  Banknote,
  BadgeCheck,
  BarChart3,
  BatteryFull,
  BookOpen,
  CalendarCheck,
  Check,
  CheckCircle2,
  CreditCard,
  Flag,
  Flame,
  Gauge,
  Gift,
  Globe,
  Handshake,
  Heart,
  Lock,
  MapPin,
  Quote,
  RotateCcw,
  ShieldCheck,
  Signal,
  Sparkles,
  Star,
  Tag,
  UserPlus,
  Users,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";

import { Link } from "@/i18n/navigation";

import { VLogo } from "@/app/_components/home/VLogo";
import { getBrandName } from "@/lib/brand";

import { CommissionCalculator } from "./_components/CommissionCalculator";

// Founding-launch sales page (host acquisition). Distinct from the guest
// directory homepage at `/` — this is the long-form pitch that converts a host
// from "paying the OTA tax" to a founding Vilo subscriber. Mostly static; the
// commission calculator is the one interactive island. Brand name resolves live
// from platform_settings so the copy never goes stale.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandName();
  return {
    title: `${brand} — Take your bookings direct. Keep every rand.`,
    description: `${brand} gives South African guesthouses, B&Bs and lodges a branded booking site, guest CRM, synced calendars, full accounting and commission-free payments — in one place. Zero booking commission, ever.`,
  };
}

const CONTACT_EMAIL = "hello@viloplatform.com";

const STACK = [
  {
    icon: Globe,
    price: "normally R1 000/mo",
    title: "Your branded booking website",
    body: "Your own bookable site with photos, policies, instant-book and a custom URL. No developer, no agency invoice.",
  },
  {
    icon: CalendarCheck,
    price: "normally R900/mo",
    title: "Booking engine + calendar sync",
    body: "Two-way sync with the OTAs so double-bookings end here. Manage multiple rooms, listings and properties from one calendar.",
  },
  {
    icon: BookOpen,
    price: "normally R450/mo",
    title: "Full accounting ledger",
    body: "Accurate ledger plus invoices, receipts, credit notes and refund notes generated automatically. Your books, done as you go.",
  },
  {
    icon: Users,
    price: "normally R500/mo",
    title: "Guest CRM + unified inbox + quotes",
    body: "Every guest's details stored and yours forever. One inbox for every channel. Send an accurate quote, matched to live availability, in seconds.",
  },
  {
    icon: Tag,
    price: "normally R600/mo",
    title: "Revenue tools",
    body: "Dynamic seasonal rates, upsell add-ons at checkout, full-control coupon codes, and refund/cancellation policies you set.",
  },
  {
    icon: Star,
    price: "normally R300/mo",
    title: "Review manager",
    body: "Collect verified reviews after every stay and show them off anywhere — your site, your socials, your Google Business.",
  },
  {
    icon: BarChart3,
    price: "normally R300/mo",
    title: "Reporting + commission-saved tracker",
    body: "Occupancy, lifetime guest value, booking rates, website views, outstanding amounts — and a live tally of exactly how much commission Vilo has saved you.",
  },
  {
    icon: UserPlus,
    price: "normally R300/mo",
    title: "Staff & co-hosts",
    body: "Add cleaners, co-hosts and assistants with scoped permissions. They run bookings and the inbox — never your billing.",
  },
] as const;

const STEPS = [
  {
    n: "1",
    label: "step one",
    title: "Claim your handle",
    body: "Pick the URL your guests will use. Yours forever.",
  },
  {
    n: "2",
    label: "step two",
    title: "Add your listing",
    body: "Photos, pricing, policies. Import your existing calendars in one click.",
  },
  {
    n: "3",
    label: "step three",
    title: "Connect payments",
    body: "Link Paystack, PayPal or your bank. Guests pay the way they want.",
  },
] as const;

const FAQS = [
  {
    q: "Do I have to leave Airbnb, Booking.com or Lekkeslaap?",
    a: "No. Most hosts run Vilo alongside the OTAs at first and move guests to direct booking as the savings stack up. Two-way calendar sync prevents double-bookings while you transition.",
  },
  {
    q: "How does Vilo make money if there's no commission?",
    a: "Subscriptions only. One flat fee, and you keep 100% of every booking. Guest money goes straight from the guest to your Paystack or PayPal account — we never touch it.",
  },
  {
    q: "Why is the founding rate billed annually?",
    a: "Because founding pricing is a real commitment on both sides. Annual lets us lock your rate for life and gives you a full season to see the savings. And it's covered by the 90-day money-back guarantee, so it's risk-free either way. Month-to-month is available at the standard rate.",
  },
  {
    q: "Is it safe to pay annually for a new platform?",
    a: "That's exactly what the 90-day money-back guarantee is for. Run Vilo through real bookings for three months — if it hasn't earned its keep, you get every rand back, no questions.",
  },
  {
    q: "Why isn't there a free directory listing?",
    a: "Because a directory only works if guests trust it. The Vilo Directory is members-only and verified on purpose — no ghost listings, no abandoned accounts. That exclusivity is what makes a listing worth having.",
  },
  {
    q: "What payment methods can my guests use?",
    a: "Cards and instant EFT via Paystack. PayPal for international guests. Manual bank transfer with proof-of-payment upload. Local and overseas guests both pay the way they trust.",
  },
  {
    q: "How long does setup take?",
    a: "Under 20 minutes for most hosts. Import your existing listings and calendars in a click — no developer, no agency.",
  },
  {
    q: "Can I add my team?",
    a: "Yes — co-hosts, cleaners and assistants with scoped permissions. They handle bookings and the inbox, never your billing or your books.",
  },
] as const;

const COMPARISON_ROWS = [
  {
    label: "Booking commission",
    vilo: "0%",
    airbnb: "~15%",
    booking: "~15–22%",
    lekke: "15% + VAT",
    own: "0%",
  },
  {
    label: "Own the guest relationship",
    vilo: true,
    airbnb: false,
    booking: false,
    lekke: false,
    own: true,
  },
  {
    label: "Branded booking website",
    vilo: true,
    airbnb: false,
    booking: false,
    lekke: false,
    own: "DIY",
  },
  {
    label: "Calendar sync (anti double-booking)",
    vilo: true,
    airbnb: true,
    booking: true,
    lekke: true,
    own: "DIY",
  },
  {
    label: "Guest CRM",
    vilo: true,
    airbnb: false,
    booking: false,
    lekke: false,
    own: "DIY",
  },
  {
    label: "Full accounting ledger",
    vilo: true,
    airbnb: false,
    booking: false,
    lekke: false,
    own: "DIY",
  },
  {
    label: "Paystack, PayPal & EFT",
    vilo: true,
    airbnb: "card only",
    booking: "card only",
    lekke: "limited",
    own: "DIY",
  },
  {
    label: "Unified inbox",
    vilo: true,
    airbnb: "in-app only",
    booking: "in-app only",
    lekke: "in-app only",
    own: "DIY",
  },
] as const;

const MARQUEE = [
  "Guesthouses",
  "B&Bs",
  "LODGES",
  "Self-catering",
  "Boutique hotels",
  "Farm stays",
] as const;

const PAGE_CSS = `
  .launch-dotgrid { background-image: radial-gradient(rgba(16,185,129,0.14) 1px, transparent 1px); background-size: 22px 22px; }
  .launch-img-ph {
    background: repeating-linear-gradient(135deg, #D1FAE5 0 14px, #BBF3D4 14px 28px);
    color: #064E3B; font-family: var(--font-jetbrains-mono), monospace; font-size: 11px; letter-spacing: 0.04em;
    display:flex; align-items:center; justify-content:center;
  }
  .marquee-track { animation: launch-scroll 38s linear infinite; }
  @keyframes launch-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  details summary::-webkit-details-marker { display:none; }
  details[open] .acc-icon { transform: rotate(45deg); }
  .acc-icon { transition: transform .2s ease; }
  .num-display { font-feature-settings: "tnum" 1; }
  .calc-input { font-feature-settings: "tnum" 1; }
  .calc-input::placeholder { color: #4A7C6A; opacity: 0.5; }
  .step-line::after {
    content:""; position:absolute; left: 50%; top: 28px; width: calc(100% - 8px);
    height: 1px; background-image: linear-gradient(to right, #DCEAE0 50%, transparent 0%);
    background-size: 8px 1px; background-repeat: repeat-x;
  }
  @media (max-width: 767px) { .step-line::after { display:none; } }
  .vilo-range { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; height: 28px; }
  .vilo-range:focus { outline: none; }
  .vilo-range::-webkit-slider-runnable-track { height: 8px; border-radius: 9999px; background: linear-gradient(to right, #10B981 0 var(--val,30%), #D1FAE5 var(--val,30%) 100%); }
  .vilo-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 9999px; background: #ffffff; border: 2px solid #10B981; margin-top: -6px; }
  .vilo-range:focus::-webkit-slider-thumb { box-shadow: 0 0 0 4px rgba(16,185,129,0.15); }
  .vilo-range::-moz-range-track { height: 8px; border-radius: 9999px; background: #D1FAE5; }
  .vilo-range::-moz-range-progress { height: 8px; border-radius: 9999px; background: #10B981; }
  .vilo-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 9999px; border: 2px solid #10B981; background: #ffffff; }
  .vilo-range:focus::-moz-range-thumb { box-shadow: 0 0 0 4px rgba(16,185,129,0.15); }
  @media (prefers-reduced-motion: no-preference) {
    .rise { animation: launch-rise .6s cubic-bezier(.16,1,.3,1) both; }
    @keyframes launch-rise { from { transform: translateY(14px); } to { transform: translateY(0); } }
  }
  #launch-page section[id] { scroll-margin-top: 84px; }
`;

function Cmp({ value }: { value: string | boolean }) {
  if (value === true)
    return <CheckCircle2 className="h-5 w-5 text-status-confirmed" />;
  if (value === false)
    return <XCircle className="h-5 w-5 text-status-cancelled" />;
  return <span className="text-xs text-brand-mute">{value}</span>;
}

export default async function LaunchPage() {
  const brand = await getBrandName();

  return (
    <div id="launch-page" className="bg-brand-light text-brand-ink antialiased">
      <style>{PAGE_CSS}</style>

      {/* ========== NAV ========== */}
      <header className="sticky top-0 z-40 border-b border-brand-line/70 bg-brand-light/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 lg:px-8">
          <a
            href="#top"
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${brand} home`}
          >
            <VLogo size={32} gradientId="launch-nav-logo" />
            <span className="font-display text-[17px] font-bold tracking-tight text-brand-ink">
              {brand}
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-brand-mute lg:flex">
            <a
              href="#problem"
              className="transition-colors hover:text-brand-dark"
            >
              The OTA tax
            </a>
            <a
              href="#stack"
              className="transition-colors hover:text-brand-dark"
            >
              What you get
            </a>
            <a href="#how" className="transition-colors hover:text-brand-dark">
              How it works
            </a>
            <a
              href="#pricing"
              className="transition-colors hover:text-brand-dark"
            >
              Founding offer
            </a>
            <a href="#faq" className="transition-colors hover:text-brand-dark">
              FAQ
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href="/login"
              className="hidden rounded px-3 py-2 text-sm font-medium text-brand-dark hover:bg-brand-accent md:inline-flex"
            >
              Log in
            </Link>
            <a
              href="#scorecard"
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Take the Scorecard
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section
        id="top"
        className="relative overflow-hidden bg-brand-dark text-white"
      >
        <div className="absolute inset-0 bg-brand-gradient-dark" />
        <div className="launch-dotgrid absolute inset-0 opacity-[0.16]" />
        <div className="pointer-events-none absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-primary/25 blur-[120px]" />
        <div className="pointer-events-none absolute -right-24 top-1/4 h-[34rem] w-[34rem] rounded-full bg-emerald-500/20 blur-[150px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 pb-24 pt-14 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pb-32 lg:pt-20">
          <div className="rise lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/[0.06] px-3 py-1.5 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-white">
                Now open to South African hosts
              </span>
              <span className="text-white/25">·</span>
              <span className="text-xs text-emerald-200/80">
                Paystack & PayPal ready
              </span>
            </div>

            <h1 className="mt-7 font-display text-[42px] font-extrabold leading-[1.0] tracking-tight text-white md:text-6xl lg:text-[66px]">
              Take your bookings{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-emerald-300">direct.</span>
                <span className="absolute bottom-2 left-0 right-0 -z-0 h-3 rounded-sm bg-emerald-400/20" />
              </span>
              <br />
              Keep every rand.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-emerald-50/70">
              {brand} gives your guesthouse, B&amp;B or lodge a branded booking
              site, a guest CRM, synced calendars, full accounting and
              commission-free payments — everything you need to run a profitable
              establishment, in one place.{" "}
              <span className="font-medium text-white">
                Zero booking commission. Ever.
              </span>
            </p>

            <div className="mt-8">
              <a
                href="#scorecard"
                className="inline-flex items-center gap-2 rounded-pill bg-brand-primary px-6 py-3.5 text-base font-semibold text-brand-dark shadow-glow transition-colors hover:bg-emerald-400"
              >
                Take the 2-minute Scorecard <ArrowRight className="h-4 w-4" />
              </a>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/55">
                See exactly what the OTAs are costing you — and how ready you
                are to take it back. No card. Free.
              </p>
            </div>

            <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-2 text-xs text-white/65">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>Built in South Africa, for South African hosts</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-white/65">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Paystack · PayPal · EFT — guests pay the way they trust
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-white/65">
                <Flag className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>Founding cohort now open — first 100 hosts only</span>
              </div>
            </div>
          </div>

          <div className="rise relative lg:col-span-6">
            <div className="relative mx-auto max-w-[500px]">
              <div className="relative overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1582719508461-905c673771fd?w=900&q=80&auto=format&fit=crop"
                  alt={`A ${brand} host's guesthouse`}
                  className="aspect-[4/5] w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/75 via-brand-dark/5 to-transparent" />
                <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                  <Zap className="h-3 w-3 text-emerald-300" /> Instant Book
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-200/80">
                      Guesthouse · Knysna
                    </div>
                    <div className="truncate font-display text-xl font-bold leading-tight text-white">
                      Featherstone Guesthouse
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-white/60">from</div>
                    <div className="num-display font-display text-lg font-bold text-white">
                      R 1 200
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-3 -top-5 w-[196px] rounded-2xl border border-brand-line bg-white p-4 shadow-xl md:-right-9">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">
                  {brand} kept in your pocket
                </div>
                <div className="num-display mt-1 font-display text-2xl font-extrabold text-brand-dark">
                  R 2 847
                </div>
                <div className="mt-0.5 text-[10px] text-brand-mute">
                  commission saved · this month
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-pill bg-brand-accent">
                  <div
                    className="h-full bg-brand-primary"
                    style={{ width: "78%" }}
                  />
                </div>
              </div>

              <div className="absolute -bottom-7 -left-3 w-[236px] rounded-2xl border border-white/40 bg-white/95 p-3.5 shadow-2xl backdrop-blur md:-left-10">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-primary">
                    <Check className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-brand-dark">
                      New direct booking
                    </div>
                    <div className="truncate font-mono text-[11px] text-brand-mute">
                      VILO-2026-AB3471 · 4 nights
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-brand-line pt-2.5">
                  <span className="text-[11px] text-brand-mute">
                    Payout to you
                  </span>
                  <span className="num-display font-display text-sm font-bold text-brand-primary">
                    R 4 800
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TRUST MARQUEE ========== */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-5 py-10 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              The founding cohort
            </div>
            <div className="mt-1 font-display text-lg font-semibold leading-snug text-brand-dark">
              Hosts from Cape Town to Kruger.
            </div>
          </div>
          <div className="relative overflow-hidden lg:col-span-9">
            <div className="absolute bottom-0 left-0 top-0 z-10 w-12 bg-gradient-to-r from-white to-transparent" />
            <div className="absolute bottom-0 right-0 top-0 z-10 w-12 bg-gradient-to-l from-white to-transparent" />
            <div className="marquee-track flex items-center gap-12 whitespace-nowrap will-change-transform">
              {[...MARQUEE, ...MARQUEE].map((label, i) => (
                <div key={i} className="flex items-center gap-12">
                  <span className="font-display text-2xl font-semibold text-brand-mute">
                    {label}
                  </span>
                  <span className="text-brand-line">●</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== PROBLEM + CALCULATOR ========== */}
      <section id="problem" className="border-b border-brand-line">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                The OTA tax
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-[44px]">
                Lekkeslaap takes 15% + VAT. Booking.com takes its cut. Airbnb
                takes theirs.{" "}
                <span className="text-brand-primary">{brand} takes R0.</span>
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-brand-mute">
                You built the business. You answered the late-night WhatsApp.
                You scrubbed the bathroom at 11pm. So why are you handing a
                fifth of every booking to a platform that won&apos;t even give
                you your own guest&apos;s email address?
              </p>
              <p className="mt-4 max-w-md leading-relaxed text-brand-mute">
                Every booking through an OTA costs you twice: the commission you
                pay today, and the guest you never get to keep. You&apos;re
                renting customers you already earned.
              </p>
              <p className="mt-4 max-w-md font-medium leading-relaxed text-brand-dark">
                {brand} flips it. Pay one flat fee. Own the guest. Get paid in
                full — and get them back next season without paying a cent to
                anyone.
              </p>
            </div>

            <CommissionCalculator />
          </div>
        </div>
      </section>

      {/* ========== REFRAME ========== */}
      <section className="relative overflow-hidden border-b border-brand-line bg-brand-dark text-white">
        <div className="absolute inset-0 bg-brand-gradient-dark" />
        <div className="launch-dotgrid absolute inset-0 opacity-[0.1]" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Not just another channel manager
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.06] tracking-tight text-white md:text-4xl lg:text-[46px]">
                {brand} isn&apos;t a listing site. It&apos;s the{" "}
                <span className="text-emerald-300">operating system</span> for
                your whole establishment.
              </h2>
            </div>
            <div className="lg:col-span-6 lg:pt-4">
              <p className="text-lg leading-relaxed text-emerald-50/75">
                Most tools give you one piece. A channel manager syncs your
                calendar. A web designer builds your site. A bookkeeper sorts
                your invoices. A CRM stores your guests. You end up stitching
                five subscriptions together — and still paying commission on
                top.
              </p>
              <p className="mt-5 text-lg leading-relaxed text-emerald-50/75">
                {brand} is the lot, in one login: the booking site{" "}
                <span className="font-medium text-white">and</span> the calendar
                sync <span className="font-medium text-white">and</span> the
                accounting ledger{" "}
                <span className="font-medium text-white">and</span> the guest
                CRM <span className="font-medium text-white">and</span> the
                payments — built for the way a real, hands-on host works.
              </p>
              <p className="mt-5 font-display text-xl font-semibold text-white">
                You&apos;re not adding another tool. You&apos;re replacing the
                pile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== VALUE STACK ========== */}
      <section id="stack" className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="mb-12 max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              One platform, everything in it
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              Everything serious hosts have been asking for — in one tidy
              dashboard.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-brand-mute">
              Here&apos;s what you&apos;d otherwise buy separately — and what it
              would cost you every month. With {brand}, it&apos;s all included.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {STACK.map((item) => (
              <div
                key={item.title}
                className="group flex flex-col rounded-card border border-brand-line bg-white p-6 transition-shadow hover:shadow-card"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-[11px] text-brand-mute">
                    {item.price}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-brand-dark">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
                  {item.body}
                </p>
              </div>
            ))}

            <div className="flex flex-col justify-center rounded-card border-2 border-brand-primary bg-brand-secondary p-6 text-white">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/90">
                Add it all up
              </div>
              <div className="num-display mt-2 font-display text-3xl font-extrabold">
                Over R4 000<span className="text-lg font-bold">/mo</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-emerald-50/80">
                of tools you&apos;d otherwise juggle — and pay commission on top
                of. On {brand}, it&apos;s one login and one flat fee.
              </p>
            </div>
          </div>

          <ScorecardCta />
        </div>
      </section>

      {/* ========== ROI ========== */}
      <section className="border-b border-brand-line bg-brand-light">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                The math that matters
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
                This doesn&apos;t cost you money. It hands money back.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-mute">
                A host doing around R200k a year through the OTAs gives away R30
                000+ in commission annually. On {brand}, that&apos;s R0. So your
                subscription doesn&apos;t sit in the &quot;expenses&quot; column
                — it sits in the &quot;things that paid for themselves in the
                first month&quot; column.
              </p>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-brand-mute">
                And it keeps proving it. Then it compounds: because you own the
                guest, next season&apos;s booking is direct too —
                commission-free, forever.
              </p>
              <div className="mt-8">
                <a
                  href="#scorecard"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-dark"
                >
                  See your payback in numbers — take the Scorecard
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative overflow-hidden rounded-card border border-brand-line bg-brand-dark p-7 text-white shadow-lift lg:p-8">
                <div className="absolute inset-0 bg-brand-gradient-dark" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                      Your dashboard, every login
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-pill border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{" "}
                      LIVE
                    </span>
                  </div>
                  <div className="mt-5 rounded-card border border-white/10 bg-white/[0.06] p-5">
                    <div className="text-sm text-emerald-50/70">
                      {brand} kept in your pocket this month
                    </div>
                    <div className="num-display mt-1 font-display text-4xl font-extrabold text-emerald-300">
                      R 2 847
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-white/10">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: "82%" }}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-white/45">
                      vs the OTA cut on the same bookings
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-card border border-white/10 bg-white/[0.06] p-4">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                        Saved this year
                      </div>
                      <div className="num-display mt-1 font-display text-2xl font-bold">
                        R 31 200
                      </div>
                    </div>
                    <div className="rounded-card border border-white/10 bg-white/[0.06] p-4">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                        Paid {brand} this year
                      </div>
                      <div className="num-display mt-1 font-display text-2xl font-bold">
                        R 11 988
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-center text-sm font-medium text-emerald-300">
                    Net in your pocket:{" "}
                    <span className="num-display">+R 19 212</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== INTERNATIONAL ========== */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="order-2 lg:order-1 lg:col-span-6">
              <div className="rounded-card border border-brand-line bg-brand-light p-7 shadow-card">
                <div className="mb-4 text-[11px] font-medium uppercase tracking-wider text-brand-mute">
                  Checkout · international guest
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-brand-dark">
                        Paystack
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        Cards & instant EFT
                      </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-status-confirmed" />
                  </div>
                  <div className="flex items-center gap-3 rounded-card border-2 border-brand-primary bg-white p-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                      <Globe className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-brand-dark">
                        PayPal
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        For your overseas guests
                      </div>
                    </div>
                    <span className="rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white">
                      Trusted
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-card border border-brand-line bg-white p-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                      <Banknote className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-brand-dark">
                        Manual EFT
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        Proof-of-payment upload
                      </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-status-confirmed" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-brand-line pt-4">
                  <span className="text-sm text-brand-mute">Booking total</span>
                  <span className="num-display font-display text-lg font-bold text-brand-dark">
                    R 6 400
                  </span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 lg:col-span-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                For hosts who get overseas guests
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-[44px]">
                Take direct bookings from anywhere — in the currency your guests
                already trust.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-mute">
                Here&apos;s where hosts near Kruger, the Panorama Route and the
                Winelands quietly bleed the most: international guests. An
                overseas traveller can&apos;t easily pay a South African host
                direct — so they retreat to Booking.com, where they feel safe,
                and you pay full freight on your most valuable bookings.
              </p>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-brand-mute">
                {brand} closes that gap. Paystack handles cards and instant EFT.
                PayPal handles your international guests in a checkout they
                recognise and trust. The booking you used to lose to the OTA,
                you now take yourself.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-brand-mute/90">
                There are always processing fees — there are on every platform.
                The difference is what it unlocks: direct international bookings
                you simply couldn&apos;t capture before.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how" className="border-b border-brand-line bg-brand-light">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="mb-14 grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                No developer. No agency. No brand book.
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
                Live on {brand} in{" "}
                <span className="text-brand-secondary">under 20 minutes.</span>
              </h2>
            </div>
            <div className="flex lg:col-span-5 lg:items-end">
              <p className="leading-relaxed text-brand-mute">
                If you can fill in a form and upload a few photos, you&apos;re
                ninety percent there. We do the heavy lifting on setup — import
                your existing listings, and you&apos;re running.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-3">
            {STEPS.map((step) => (
              <div key={step.n} className="step-line relative">
                <div className="flex items-center gap-4 md:block">
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
                    <span className="font-display text-xl font-bold">
                      {step.n}
                    </span>
                  </div>
                  <div className="md:mt-5">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-brand-mute">
                      {step.label}
                    </div>
                    <h3 className="mt-0.5 font-display text-lg font-semibold text-brand-dark">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
                      {step.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div className="relative">
              <div className="flex items-center gap-4 md:block">
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-white">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="md:mt-5">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-secondary/90">
                    step four
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-brand-dark">
                    Share & book
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
                    Share your link. {brand} handles payments, confirmations,
                    reviews and the books.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ScorecardCta />
        </div>
      </section>

      {/* ========== GUEST EXPERIENCE ========== */}
      <section className="border-b border-brand-line">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="order-2 flex justify-center lg:order-1 lg:col-span-5">
              <div className="relative">
                <div className="w-[280px] rounded-[40px] bg-brand-dark p-2.5 shadow-lift">
                  <div className="overflow-hidden rounded-[32px] bg-white">
                    <div className="flex items-center justify-between px-6 pb-2 pt-3 text-[10px] font-semibold text-brand-dark">
                      <span>9:41</span>
                      <div className="flex items-center gap-1">
                        <Signal className="h-3 w-3" />
                        <Wifi className="h-3 w-3" />
                        <BatteryFull className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="relative aspect-[4/3] overflow-hidden bg-brand-accent">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80&auto=format&fit=crop"
                        alt="Karoo Cottage exterior"
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill bg-brand-secondary px-2 py-0.5 text-[10px] font-bold text-white">
                        <Zap className="h-3 w-3" /> Instant Book
                      </span>
                      <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
                        <Heart className="h-3.5 w-3.5 text-brand-primary" />
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-display text-base font-semibold leading-tight text-brand-dark">
                            Karoo Cottage
                          </div>
                          <div className="mt-0.5 text-[11px] text-brand-mute">
                            Prince Albert · sleeps 4
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] text-brand-mute">
                            from
                          </div>
                          <div className="num-display font-display text-base font-bold text-brand-primary">
                            R 1 200
                          </div>
                          <div className="text-[10px] text-brand-mute">
                            /night
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-[11px] font-medium text-brand-dark">
                          4.9
                        </span>
                        <span className="text-[11px] text-brand-mute">
                          (34 reviews)
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-brand-primary">
                          <BadgeCheck className="h-3 w-3" /> Verified host
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded border border-brand-line p-2">
                          <div className="text-[9px] font-medium uppercase tracking-wider text-brand-mute">
                            Check in
                          </div>
                          <div className="mt-0.5 text-xs font-medium text-brand-dark">
                            Fri, 14 Nov
                          </div>
                        </div>
                        <div className="rounded border border-brand-line p-2">
                          <div className="text-[9px] font-medium uppercase tracking-wider text-brand-mute">
                            Check out
                          </div>
                          <div className="mt-0.5 text-xs font-medium text-brand-dark">
                            Mon, 17 Nov
                          </div>
                        </div>
                      </div>
                      <button className="mt-3 w-full rounded bg-brand-primary py-3 text-sm font-medium text-white">
                        Reserve · R 3 600
                      </button>
                      <div className="mt-2 text-center text-[10px] text-brand-mute">
                        No surprise fees · you won&apos;t be charged yet
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -right-6 top-20 hidden rounded-pill border border-brand-line bg-white px-3 py-1.5 font-mono text-[11px] text-brand-dark shadow-card md:block">
                  <span className="text-brand-primary">●</span> Live page ·
                  public
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                What your guests see
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
                A booking page guests actually trust.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-mute">
                Clean, fast, honest pricing — no surprise fees on the checkout
                screen. Mobile-first, because most guests book from their phone
                and a clunky page sends them straight back to the OTA.
              </p>

              <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-card border border-brand-line p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-brand-secondary" />
                    <div className="text-sm font-semibold text-brand-dark">
                      Instant Book
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-brand-mute">
                    Approved guests confirm in one tap, no back-and-forth.
                  </p>
                </div>
                <div className="rounded-card border border-brand-line p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand-primary" />
                    <div className="text-sm font-semibold text-brand-dark">
                      Verified host badge
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-brand-mute">
                    ID-checked operators earn trust, and more bookings.
                  </p>
                </div>
                <div className="rounded-card border border-brand-line p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-brand-primary" />
                    <div className="text-sm font-semibold text-brand-dark">
                      Clear policies
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-brand-mute">
                    Cancellation rules and refund preview shown up front.
                  </p>
                </div>
                <div className="rounded-card border border-brand-line p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-brand-primary" />
                    <div className="text-sm font-semibold text-brand-dark">
                      A name they can trust
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-brand-mute">
                    Listed on the curated {brand} Directory alongside other
                    vetted hosts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== DIRECTORY ========== */}
      <section className="relative overflow-hidden border-b border-brand-line bg-brand-secondary text-white">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                The {brand} Directory
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-4xl lg:text-[44px]">
                A directory guests trust — because not just anyone gets in.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-emerald-50/80">
                The {brand} Directory isn&apos;t a free-for-all listings dump.
                Every property on it is a real, verified, paying host running
                their business properly. That&apos;s the point: when a guest
                browses {brand}, they know they&apos;re looking at serious
                operators — not abandoned listings and ghost accounts.
              </p>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-emerald-50/80">
                Your directory listing comes with your membership. It&apos;s
                extra discovery, commission-free — and it stays exclusive
                precisely because it&apos;s earned, not given away.
              </p>
              <div className="mt-7 inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/10 px-4 py-2 text-sm">
                <Lock className="h-4 w-4 text-emerald-300" /> Members only ·
                verified hosts · no free tier
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="grid grid-cols-2 items-stretch gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <article
                    key={i}
                    className="flex flex-col overflow-hidden rounded-card border border-brand-line bg-white shadow-lift"
                  >
                    <div className="launch-img-ph relative aspect-[4/3]">
                      <span>LISTING PHOTO</span>
                      {i === 2 ? (
                        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-pill bg-brand-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                          Featured
                        </span>
                      ) : (
                        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-pill border border-brand-line bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-brand-mute">
                          <BadgeCheck className="h-3 w-3 text-brand-primary" />{" "}
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="h-3 w-2/3 rounded-pill bg-brand-line" />
                      <div className="mt-2 h-2.5 w-2/5 rounded-pill bg-brand-line/60" />
                    </div>
                  </article>
                ))}
              </div>
              <p className="mt-4 font-mono text-[11px] text-emerald-50/55">
                Placeholder slots · filled with real listing cards as founding
                hosts go live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== COMPARISON ========== */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="mb-12 max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Side by side
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              How {brand} stacks up.
            </h2>
          </div>

          <div className="overflow-x-auto rounded-card border border-brand-line">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-brand-line bg-brand-light/60">
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-brand-mute">
                    Feature
                  </th>
                  <th className="px-5 py-4 text-left font-display font-semibold text-brand-primary">
                    {brand}
                  </th>
                  <th className="px-5 py-4 text-left font-display font-medium text-brand-mute">
                    Airbnb
                  </th>
                  <th className="px-5 py-4 text-left font-display font-medium text-brand-mute">
                    Booking.com
                  </th>
                  <th className="px-5 py-4 text-left font-display font-medium text-brand-mute">
                    Lekkeslaap
                  </th>
                  <th className="px-5 py-4 text-left font-display font-medium text-brand-mute">
                    Your own site
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="px-5 py-4 font-medium text-brand-dark">
                      {row.label}
                    </td>
                    <td className="px-5 py-4 font-semibold text-brand-primary">
                      <Cmp value={row.vilo} />
                    </td>
                    <td className="px-5 py-4 font-medium text-brand-dark">
                      <Cmp value={row.airbnb} />
                    </td>
                    <td className="px-5 py-4 font-medium text-brand-dark">
                      <Cmp value={row.booking} />
                    </td>
                    <td className="px-5 py-4 font-medium text-brand-dark">
                      <Cmp value={row.lekke} />
                    </td>
                    <td className="px-5 py-4 text-brand-mute">
                      <Cmp value={row.own} />
                    </td>
                  </tr>
                ))}
                <tr className="bg-brand-accent/30">
                  <td className="px-5 py-4 font-medium text-brand-dark">
                    What it costs
                  </td>
                  <td className="px-5 py-4 font-display text-base font-bold text-brand-primary">
                    flat fee
                  </td>
                  <td className="px-5 py-4 font-display text-xs font-medium text-brand-mute">
                    a cut of everything
                  </td>
                  <td className="px-5 py-4 font-display text-xs font-medium text-brand-mute">
                    a bigger cut
                  </td>
                  <td className="px-5 py-4 font-display text-xs font-medium text-brand-mute">
                    a cut + VAT
                  </td>
                  <td className="px-5 py-4 font-display text-xs font-medium text-brand-mute">
                    your time
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ScorecardCta />
        </div>
      </section>

      {/* ========== FOUNDING OFFER ========== */}
      <section
        id="pricing"
        className="border-b border-brand-line bg-brand-light"
      >
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Founding members only
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              Get everything. Pay founding-member rates. Lock them in.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-brand-mute">
              We&apos;re opening {brand} to a first cohort of 100 founding
              hosts. You get the entire platform — every tool above, the
              website, the directory listing — at a price the public will never
              see again.
            </p>
          </div>

          <div className="mx-auto max-w-3xl overflow-hidden rounded-card border-2 border-brand-primary bg-white shadow-lift">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="border-b border-brand-line p-7 md:border-b-0 md:border-r lg:p-9">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-brand-mute">
                      The value (tools, built in)
                    </span>
                    <span className="num-display font-display font-semibold text-brand-mute line-through">
                      R4 000+/mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-brand-mute">
                      Fair price after launch
                    </span>
                    <span className="num-display font-display font-semibold text-brand-mute line-through">
                      R2 499/mo
                    </span>
                  </div>
                  <div className="h-px bg-brand-line" />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
                      Your founding rate
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="num-display font-display text-6xl font-extrabold text-brand-dark">
                        R999
                      </span>
                      <span className="text-sm text-brand-mute">/month</span>
                    </div>
                    <div className="mt-1 text-xs text-brand-mute">
                      Locked for as long as you stay · billed annually
                    </div>
                  </div>

                  <div className="rounded-card bg-brand-secondary p-4 text-white">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/90">
                      <Flame className="h-4 w-4 text-emerald-300" /> First 10
                      hosts
                    </div>
                    <div className="num-display mt-1 font-display text-2xl font-bold">
                      R499<span className="text-sm font-semibold">/month</span>{" "}
                      — locked for life
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-50/70">
                      The bravest backers get the best deal.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col p-7 lg:p-9">
                <ul className="space-y-3 text-sm text-brand-dark">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />{" "}
                    The entire platform — every tool, the website, the directory
                    listing
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />{" "}
                    Founding rate locked for life — the public never sees it
                    again
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />{" "}
                    A direct line to the team & first say on new features
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />{" "}
                    Month-to-month available at the standard rate
                  </li>
                </ul>

                <div className="mt-6 flex items-start gap-3 rounded-card border border-brand-line bg-brand-light p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-display text-sm font-semibold text-brand-dark">
                      90-day money-back guarantee
                    </div>
                    <div className="mt-0.5 text-xs text-brand-mute">
                      Run it through real bookings. If {brand} hasn&apos;t
                      earned its keep in 90 days, we refund you in full. The
                      only risk is staying where you are.
                    </div>
                  </div>
                </div>

                <Link
                  href="/signup/host"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-pill bg-brand-primary px-5 py-3.5 font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Claim your founding spot <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="mt-3 text-center text-xs text-brand-mute">
                  Create your host account and lock in your founding rate.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 bg-brand-dark px-7 py-4 text-xs text-white sm:flex-row sm:items-center">
              <span className="inline-flex items-center gap-2">
                <Flame className="h-4 w-4 text-emerald-300" /> First 10 founding
                spots at R499
              </span>
              <span className="hidden text-white/25 sm:inline">·</span>
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-300" /> 100 founding
                spots total
              </span>
              <span className="hidden text-white/25 sm:inline">·</span>
              <span className="inline-flex items-center gap-2 font-medium text-emerald-300 sm:ml-auto">
                then the rate goes to R2 499
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOUNDING PROMISE ========== */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                What it means to be founding
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
                Get in early. Get looked after.
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-brand-mute">
                Founding members aren&apos;t just early customers — they&apos;re
                the hosts who build {brand} with us. So the deal runs both ways.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
              <div className="rounded-card border border-brand-line bg-brand-light p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-primary text-white">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="font-display text-lg font-semibold text-brand-dark">
                  You get
                </div>
                <ul className="mt-3 space-y-2.5 text-sm text-brand-mute">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />{" "}
                    Your founding rate locked for life
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />{" "}
                    A direct line to the team
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />{" "}
                    First say on new features
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />{" "}
                    A featured spot in the Directory
                  </li>
                </ul>
              </div>
              <div className="rounded-card border border-brand-line bg-white p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-secondary text-white">
                  <Handshake className="h-5 w-5" />
                </div>
                <div className="font-display text-lg font-semibold text-brand-dark">
                  We ask
                </div>
                <p className="mt-3 text-sm leading-relaxed text-brand-mute">
                  That once {brand} is saving you real money, you let us tell
                  your story — a short testimonial, your before-and-after
                  numbers, and the occasional &quot;yes, you can call me&quot;
                  for a fellow host weighing it up.
                </p>
                <p className="mt-3 text-sm font-medium text-brand-dark">
                  Founding rate, in exchange for helping the next host trust
                  what you already proved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SOCIAL PROOF ========== */}
      <section className="border-b border-brand-line bg-brand-light">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="mb-12 max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              From the founding hosts
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              Real hosts. Real numbers.
            </h2>
            <p className="mt-5 leading-relaxed text-brand-mute">
              We launched from zero, on purpose — so we won&apos;t show you
              invented traction. This is where our founding cohort&apos;s
              stories and savings will live as they come in.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              "Founding host quote — dropped an OTA, Vilo paid for itself in X days, finally owns guest emails.",
              "Founding host quote — the unified inbox and accounting saved hours every week.",
              "Founding host quote — took their first international direct booking via PayPal.",
            ].map((quote, i) => (
              <div
                key={i}
                className="flex flex-col rounded-card border border-dashed border-brand-line bg-white/60 p-7"
              >
                <Quote className="mb-4 h-6 w-6 text-brand-primary/40" />
                <p className="font-display text-lg italic leading-snug text-brand-mute/70">
                  {quote}
                </p>
                <div className="mt-auto flex items-center gap-3 pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent text-xs font-semibold text-brand-primary">
                    —
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-brand-mute/70">
                      Name
                    </div>
                    <div className="text-xs text-brand-mute/60">
                      Property · Town
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-dashed border-brand-line bg-white/60 p-6 text-center">
              <div className="num-display font-display text-3xl font-bold text-brand-mute/60">
                R—
              </div>
              <div className="mt-1 text-xs text-brand-mute/70">
                in commission saved across founding hosts
              </div>
            </div>
            <div className="rounded-card border border-dashed border-brand-line bg-white/60 p-6 text-center">
              <div className="font-display text-3xl font-bold text-brand-mute/60">
                —
              </div>
              <div className="mt-1 text-xs text-brand-mute/70">
                avg. time to first direct booking
              </div>
            </div>
            <div className="rounded-card border border-dashed border-brand-line bg-white/60 p-6 text-center">
              <div className="font-display text-3xl font-bold text-brand-mute/60">
                —%
              </div>
              <div className="mt-1 text-xs text-brand-mute/70">
                would recommend to a host friend
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section id="faq" className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                Straight answers
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl">
                Anything else?
              </h2>
              <p className="mt-5 leading-relaxed text-brand-mute">
                Can&apos;t find what you&apos;re looking for? Email{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-brand-primary underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                — a real person replies in under an hour.
              </p>
            </div>

            <div className="divide-y divide-brand-line border-b border-t border-brand-line lg:col-span-8">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                    <span className="font-display text-base font-semibold text-brand-dark md:text-lg">
                      {faq.q}
                    </span>
                    <span className="acc-icon mt-1 text-2xl leading-none text-brand-primary">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-prose leading-relaxed text-brand-mute">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA / SCORECARD ========== */}
      <section
        id="scorecard"
        className="relative overflow-hidden bg-brand-gradient text-white"
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
                Take it back
              </div>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-[1.04] tracking-tight text-white md:text-4xl lg:text-[56px]">
                The next booking should be yours.{" "}
                <span className="font-semibold underline decoration-brand-accent decoration-2 underline-offset-4">
                  All of it.
                </span>
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-accent/85">
                Every rand, every guest, every season — yours. One flat founding
                rate, locked for life. 90 days to prove it, fully refundable.
                And only 100 founding spots before the rate doubles.
              </p>
              <p className="mt-4 max-w-xl text-lg font-medium text-white">
                Start with your score. It takes two minutes and tells you
                exactly what you&apos;re losing today.
              </p>
            </div>
            <div className="lg:col-span-5">
              <div className="rounded-card bg-white p-7 text-brand-dark shadow-card">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
                  <Gauge className="h-4 w-4" /> The Direct Booking Scorecard
                </div>
                <div className="mt-2 font-display text-2xl font-bold leading-tight text-brand-dark">
                  Your 2-minute Direct Booking Health Check.
                </div>
                <p className="mt-2 text-sm leading-relaxed text-brand-mute">
                  See your score, your exact annual commission leak, and confirm
                  your founding rate.
                </p>
                <Link
                  href="/signup/host"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand-primary px-4 py-3.5 font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Claim your founding spot <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-xs font-semibold text-brand-dark">
                      No card
                    </div>
                    <div className="text-[10px] text-brand-mute">to start</div>
                  </div>
                  <div className="border-x border-brand-line">
                    <div className="text-xs font-semibold text-brand-dark">
                      2 mins
                    </div>
                    <div className="text-[10px] text-brand-mute">to finish</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-brand-dark">
                      Free
                    </div>
                    <div className="text-[10px] text-brand-mute">always</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-brand-dark text-brand-accent/80">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <div className="flex items-center gap-2.5">
                <VLogo size={32} gradientId="launch-footer-logo" />
                <span className="font-display text-[17px] font-bold tracking-tight text-white">
                  {brand}
                </span>
              </div>
              <p className="mt-5 max-w-xs text-sm leading-relaxed">
                The operating system for your whole establishment. Built in
                South Africa, for South African hosts. Zero booking commission.
                Ever.
              </p>
              <a
                href="#scorecard"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:text-white"
              >
                Take the 2-minute Scorecard <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <FooterCol
              title="Product"
              links={[
                { href: "#stack", label: "What you get" },
                { href: "#pricing", label: "Founding offer" },
                { href: "#problem", label: "The OTA tax" },
                { href: "#how", label: "How it works" },
              ]}
            />
            <FooterCol
              title="Hosts"
              links={[
                { href: "#scorecard", label: "Take the Scorecard" },
                { href: "/help", label: "Migration guide", internal: true },
                { href: "/help", label: "Help centre", internal: true },
                { href: "#faq", label: "FAQ" },
              ]}
            />
            <FooterCol
              title="Company"
              links={[
                { href: "/about", label: "About", internal: true },
                { href: "/change-log", label: "Blog", internal: true },
                { href: "/contact", label: "Contact", internal: true },
              ]}
            />
            <FooterCol
              title="Legal"
              links={[
                { href: "/terms", label: "Terms", internal: true },
                { href: "/privacy", label: "Privacy", internal: true },
                { href: "/privacy", label: "POPIA", internal: true },
              ]}
            />
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs md:flex-row md:items-center">
            <div>© 2026 Vilo Platform (Pty) Ltd. Cape Town, South Africa.</div>
            <div className="flex items-center gap-3 font-mono md:ml-auto">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />{" "}
                Founding cohort open
              </span>
              <span className="text-white/30">·</span>
              <span>v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ScorecardCta() {
  return (
    <div className="mt-14 flex flex-col items-center text-center">
      <a
        href="#scorecard"
        className="inline-flex items-center gap-2 rounded-pill bg-brand-primary px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        Take the 2-minute Scorecard <ArrowRight className="h-4 w-4" />
      </a>
      <p className="mt-3 text-xs text-brand-mute">
        See your score + your exact annual commission leak. No card. Free.
      </p>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string; internal?: boolean }>;
}) {
  return (
    <div className="md:col-span-2">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
        {title}
      </div>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            {l.internal ? (
              <Link href={l.href} className="hover:text-white">
                {l.label}
              </Link>
            ) : (
              <a href={l.href} className="hover:text-white">
                {l.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
