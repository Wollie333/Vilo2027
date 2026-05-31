import {
  ArrowRight,
  CalendarCheck,
  Check,
  CreditCard,
  Home as HomeIcon,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Star,
  TrendingUp,
  Calendar as CalendarIcon,
} from "lucide-react";

import { VLogo } from "./VLogo";

const HERO_BOOKINGS = [
  {
    image:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=80&q=70&auto=format&fit=crop",
    alt: "Karoo Cottage",
    guest: "Anna Mokoena · Karoo Cottage",
    ref: "VILO-2026-AB3471 · 4 nights",
    status: "confirmed" as const,
  },
  {
    image:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=80&q=70&auto=format&fit=crop",
    alt: "Tide Beach House",
    guest: "Jordan Visser · Tide Beach House",
    ref: "VILO-2026-CD9210 · 2 nights",
    status: "pending" as const,
  },
  {
    image:
      "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=80&q=70&auto=format&fit=crop",
    alt: "Drakensberg Lodge",
    guest: "Sam Khumalo · Drakensberg Lodge",
    ref: "VILO-2026-EF5582 · 6 nights",
    status: "confirmed" as const,
  },
];

const STATUS_STYLES = {
  confirmed: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
} as const;

const INBOX = [
  {
    initials: "TR",
    name: "Thandi R.",
    when: "2m",
    msg: "Hi! Is the Karoo cottage free 14–17 Dec?",
    bg: "bg-brand-primary text-white",
    highlighted: true,
  },
  {
    initials: "EM",
    name: "Erik M.",
    when: "1h",
    msg: "Booking confirmed — see you Friday!",
    bg: "bg-brand-accent text-brand-primary",
    highlighted: false,
  },
  {
    initials: "NP",
    name: "Nia P.",
    when: "3h",
    msg: "Can we add a late check-out?",
    bg: "bg-brand-mute text-white",
    highlighted: false,
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-brand-line">
      <div aria-hidden className="dotgrid absolute inset-0 opacity-50" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-16 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
        {/* LEFT — copy + URL grabber + social proof */}
        <div className="lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-pill border border-brand-line bg-white px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
            <span className="text-xs font-medium text-brand-dark">
              Now live for South African hosts
            </span>
            <span className="text-brand-line">·</span>
            <span className="text-xs text-brand-mute">
              Paystack &amp; PayPal ready
            </span>
          </div>

          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.04] tracking-tight text-brand-dark md:text-5xl lg:text-[64px]">
            Take your bookings{" "}
            <span className="relative inline-block">
              <span className="relative z-10">direct.</span>
              <span className="absolute bottom-1 left-0 right-0 -z-0 h-3 bg-brand-primary/25" />
            </span>
            <br />
            Keep <span className="text-brand-primary">every rand</span>.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-mute">
            Vilo gives accommodation hosts a branded booking page, a single
            inbox, and a calendar that syncs with the OTAs — for one flat
            monthly fee.{" "}
            <span className="font-medium text-brand-dark">
              Zero booking commissions. Ever.
            </span>
          </p>

          {/* URL grabber */}
          <form
            className="mt-8 flex max-w-md items-stretch gap-2 rounded-card border border-brand-line bg-white p-1.5 shadow-card focus-within:ring-2 focus-within:ring-brand-primary/40"
            action="/signup/host"
            method="get"
          >
            <div className="flex shrink-0 items-center pl-3 pr-1 font-mono text-sm text-brand-mute">
              viloplatform.com/
            </div>
            <input
              type="text"
              name="handle"
              placeholder="your-handle"
              aria-label="Choose your Vilo handle"
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-brand-dark outline-none placeholder:text-brand-mute/60"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Claim it
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-brand-mute">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-brand-primary" /> 14-day free
              trial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-brand-primary" /> No card
              needed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-brand-primary" /> Cancel
              anytime
            </span>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="avatar h-9 w-9 rounded-full bg-brand-secondary text-xs text-white ring-2 ring-brand-light">
                LM
              </div>
              <div className="avatar h-9 w-9 rounded-full bg-brand-primary text-xs text-brand-dark ring-2 ring-brand-light">
                TK
              </div>
              <div className="avatar h-9 w-9 rounded-full bg-brand-dark text-xs text-white ring-2 ring-brand-light">
                NR
              </div>
              <div className="avatar h-9 w-9 rounded-full bg-brand-mute text-xs text-white ring-2 ring-brand-light">
                PS
              </div>
              <div className="avatar h-9 w-9 rounded-full bg-brand-accent text-[11px] font-semibold text-brand-primary ring-2 ring-brand-light">
                +212
              </div>
            </div>
            <div className="text-sm">
              <div className="flex items-center gap-1 text-brand-dark">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
                <span className="ml-1 font-medium text-brand-dark">4.9</span>
              </div>
              <div className="text-xs text-brand-mute">
                216 hosts already on Vilo
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — stacked mockups */}
        <div className="relative lg:col-span-6">
          {/* Browser dashboard */}
          <div className="relative overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
            <div className="flex h-9 items-center gap-2 border-b border-brand-line bg-brand-light/60 px-4">
              <div className="chrome-dot bg-[#FF5F57]" />
              <div className="chrome-dot bg-[#FEBC2E]" />
              <div className="chrome-dot bg-[#28C840]" />
              <div className="ml-4 flex h-6 max-w-[260px] flex-1 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3">
                <Lock className="h-3 w-3 text-brand-mute" />
                <span className="truncate font-mono text-[11px] text-brand-mute">
                  viloplatform.com/dashboard
                </span>
              </div>
            </div>

            <div className="grid grid-cols-12">
              <aside className="hidden border-r border-brand-line bg-brand-light/50 px-3 py-4 md:col-span-3 md:block">
                <div className="mb-3 flex items-center gap-2 px-2 py-1.5">
                  <VLogo size="sm" gradientId="bm-mock-logo" />
                  <span className="font-display text-xs font-bold text-brand-dark">
                    Vilo
                  </span>
                </div>
                <div className="space-y-0.5 text-[11px]">
                  <div className="flex items-center gap-2 rounded bg-brand-accent px-2 py-1.5 font-medium text-brand-primary">
                    <LayoutDashboard className="h-3.5 w-3.5" /> Overview
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-brand-mute">
                    <CalendarCheck className="h-3.5 w-3.5" /> Bookings{" "}
                    <span className="ml-auto font-mono">7</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-brand-mute">
                    <MessageSquare className="h-3.5 w-3.5" /> Inbox{" "}
                    <span className="ml-auto font-mono">3</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-brand-mute">
                    <HomeIcon className="h-3.5 w-3.5" /> Listings
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-brand-mute">
                    <CalendarIcon className="h-3.5 w-3.5" /> Calendar
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 text-brand-mute">
                    <CreditCard className="h-3.5 w-3.5" /> Payments
                  </div>
                </div>
              </aside>

              <div className="col-span-12 p-4 md:col-span-9 md:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                      Tuesday · 17 Nov
                    </div>
                    <div className="mt-0.5 font-display text-lg font-bold text-brand-dark md:text-xl">
                      Welcome back, Lerato
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-pill bg-brand-accent px-2 py-0.5 text-[10px] font-semibold text-brand-secondary">
                      PRO
                    </span>
                    <div className="avatar h-7 w-7 rounded-full bg-brand-primary text-[10px] text-white">
                      L
                    </div>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2.5">
                  <div className="rounded-card border border-brand-line p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                      This month
                    </div>
                    <div className="num-display mt-1 font-display text-xl font-bold text-brand-dark">
                      R 48 200
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-status-confirmed">
                      <TrendingUp className="h-3 w-3" /> +24%
                    </div>
                  </div>
                  <div className="rounded-card border border-brand-line p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                      Bookings
                    </div>
                    <div className="mt-1 font-display text-xl font-bold text-brand-dark">
                      14
                    </div>
                    <div className="mt-0.5 text-[10px] text-brand-mute">
                      7 confirmed · 3 pending
                    </div>
                  </div>
                  <div className="rounded-card border border-brand-line p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-brand-mute">
                      Occupancy
                    </div>
                    <div className="mt-1 font-display text-xl font-bold text-brand-dark">
                      82%
                    </div>
                    <div className="mt-0.5 text-[10px] text-brand-mute">
                      Nov projection
                    </div>
                  </div>
                </div>

                <div className="rounded-card border border-brand-line">
                  <div className="flex items-center justify-between border-b border-brand-line px-3 py-2">
                    <div className="text-xs font-semibold text-brand-dark">
                      Recent bookings
                    </div>
                    <div className="text-[10px] font-medium text-brand-mute">
                      See all →
                    </div>
                  </div>
                  <div className="divide-y divide-brand-line">
                    {HERO_BOOKINGS.map((b) => (
                      <div
                        key={b.ref}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.image}
                          alt={b.alt}
                          loading="lazy"
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-brand-dark">
                            {b.guest}
                          </div>
                          <div className="font-mono text-[10px] text-brand-mute">
                            {b.ref}
                          </div>
                        </div>
                        <span
                          className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[b.status]}`}
                        >
                          {b.status === "confirmed" ? "Confirmed" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating mobile inbox */}
          <div className="absolute -bottom-10 -left-4 hidden w-[240px] overflow-hidden rounded-card border border-brand-line bg-white shadow-lift sm:block md:-left-8 lg:-left-10">
            <div className="flex items-center justify-between border-b border-brand-line px-3 py-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-brand-primary" />
                <span className="text-xs font-semibold text-brand-dark">
                  Inbox
                </span>
              </div>
              <span className="rounded-pill bg-brand-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
                3 new
              </span>
            </div>
            <div className="divide-y divide-brand-line">
              {INBOX.map((row) => (
                <div
                  key={row.initials}
                  className={`px-3 py-2.5 ${row.highlighted ? "bg-brand-accent/60" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`avatar h-6 w-6 rounded-full text-[9px] ${row.bg}`}
                    >
                      {row.initials}
                    </div>
                    <div
                      className={`flex-1 text-xs ${row.highlighted ? "font-semibold" : "font-medium"} text-brand-dark`}
                    >
                      {row.name}
                    </div>
                    <span className="font-mono text-[9px] text-brand-mute">
                      {row.when}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] leading-snug text-brand-mute">
                    {row.msg}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Floating mini stat */}
          <div className="absolute -right-3 -top-4 hidden w-[180px] rounded-card border border-brand-line bg-white p-3 shadow-lift sm:block md:-right-6">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
              Commission saved
            </div>
            <div className="num-display mt-0.5 font-display text-2xl font-bold text-brand-primary">
              R 11 240
            </div>
            <div className="mt-0.5 text-[10px] text-brand-mute">
              vs. Airbnb 18% · this month
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-pill bg-brand-line">
              <div
                className="h-full bg-brand-secondary"
                style={{ width: "78%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
