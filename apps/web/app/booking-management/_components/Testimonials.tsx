import { Quote, Star } from "lucide-react";

export function Testimonials() {
  return (
    <section className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="mb-12 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              From the hosts
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              The kind of feedback we read three times.
            </h2>
          </div>
          <div className="flex lg:col-span-5 lg:items-end">
            <div className="grid w-full grid-cols-3 gap-6">
              <div>
                <div className="num-display font-display text-3xl font-bold text-brand-dark">
                  R 4.1m
                </div>
                <div className="mt-1 text-xs text-brand-mute">
                  in direct bookings this year
                </div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold text-brand-dark">
                  96%
                </div>
                <div className="mt-1 text-xs text-brand-mute">
                  would recommend to a host friend
                </div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold text-brand-dark">
                  1h 42m
                </div>
                <div className="mt-1 text-xs text-brand-mute">
                  avg. time to first booking
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col rounded-card border border-brand-line bg-brand-primary p-7 text-white md:col-span-2 lg:col-span-1">
            <Quote className="mb-4 h-6 w-6 text-brand-accent" />
            <p className="font-display text-lg leading-snug">
              I dropped Airbnb in month three. Vilo paid for itself in{" "}
              <span className="font-semibold text-white underline decoration-brand-accent decoration-2 underline-offset-4">
                eleven days.
              </span>{" "}
              My guests prefer the booking page — and I finally know their
              actual email address.
            </p>
            <div className="mt-auto flex items-center gap-3 pt-6">
              <div className="avatar h-10 w-10 rounded-full bg-brand-secondary text-xs text-white">
                LM
              </div>
              <div>
                <div className="text-sm font-semibold">Lerato Mahlangu</div>
                <div className="text-xs text-brand-accent/70">
                  Karoo Cottages · 3 listings
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-card border border-brand-line bg-white p-7">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <p className="mt-4 leading-relaxed text-brand-dark">
              The unified inbox is the killer feature. I used to lose an inquiry
              a week. Now my response time is under five minutes and my
              conversion went from 28% to 51%.
            </p>
            <div className="mt-auto flex items-center gap-3 pt-6">
              <div className="avatar h-10 w-10 rounded-full bg-brand-accent text-xs text-brand-primary">
                TK
              </div>
              <div>
                <div className="text-sm font-semibold text-brand-dark">
                  Thabo Khoza
                </div>
                <div className="text-xs text-brand-mute">
                  Tide &amp; Tarn · Wilderness
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-card border border-brand-line bg-white p-7">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <p className="mt-4 leading-relaxed text-brand-dark">
              I run six cabins. Before Vilo I had six spreadsheets, three OTAs,
              and one stress headache. Now it&rsquo;s one calendar and a flat R
              1 199 a month. Best switch I made all year.
            </p>
            <div className="mt-auto flex items-center gap-3 pt-6">
              <div className="avatar h-10 w-10 rounded-full bg-brand-dark text-xs text-white">
                NR
              </div>
              <div>
                <div className="text-sm font-semibold text-brand-dark">
                  Nia Roodt
                </div>
                <div className="text-xs text-brand-mute">
                  Drakensberg Lodge · 6 listings
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
