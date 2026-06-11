import {
  BadgeCheck,
  BatteryFull,
  Heart,
  RotateCcw,
  Search,
  ShieldCheck,
  Signal,
  Star,
  Wifi,
  Zap,
} from "lucide-react";

import { getBrandName } from "@/lib/brand";

const TRUST_POINTS = [
  {
    icon: Zap,
    iconClass: "text-brand-secondary",
    title: "Instant Book",
    body: "Approved guests confirm in one tap, no back-and-forth.",
  },
  {
    icon: ShieldCheck,
    iconClass: "text-brand-primary",
    title: "Verified hosts",
    body: "ID-checked operators get the trust badge — and more bookings.",
  },
  {
    icon: RotateCcw,
    iconClass: "text-brand-primary",
    title: "Clear policies",
    body: "Cancellation rules shown up-front with one-tap refund preview.",
  },
  {
    icon: Search,
    iconClass: "text-brand-primary",
    title: "Vilo Directory",
    body: "Get listed for free in our public directory — extra discovery, no fees.",
  },
] as const;

export async function ProductShowcase() {
  const brandName = await getBrandName();
  return (
    <section id="directory" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Phone mock */}
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
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
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
                        <div className="text-[10px] text-brand-mute">from</div>
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
                      You won&rsquo;t be charged yet
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-6 top-20 hidden rounded-pill border border-brand-line bg-white px-3 py-1.5 font-mono text-[11px] text-brand-dark shadow-card md:block">
                <span className="text-brand-primary">●</span> Live page · public
              </div>
            </div>
          </div>

          {/* Copy */}
          <div className="order-1 lg:order-2 lg:col-span-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              The guest experience
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              A booking page guests actually trust.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-mute">
              Clean. Fast. Honest pricing — no surprise fees on the checkout
              screen. Mobile-first so the 70% of guests who book from their
              phone never bounce.
            </p>

            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              {TRUST_POINTS.map(({ icon: Icon, iconClass, title, body }) => (
                <div
                  key={title}
                  className="rounded-card border border-brand-line p-4"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${iconClass}`} />
                    <div className="text-sm font-semibold text-brand-dark">
                      {title.replace("Vilo", brandName)}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-brand-mute">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
