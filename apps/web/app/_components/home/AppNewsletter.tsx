import { Check, Smartphone } from "lucide-react";

export function AppNewsletter() {
  return (
    <section className="border-b border-brand-line">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-12 lg:px-8 lg:py-20">
        <div className="lg:col-span-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            The Vilo Weekly
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-brand-ink md:text-3xl lg:text-4xl">
            New stays in your inbox every Friday.
          </h2>
          <p className="mt-4 max-w-lg leading-relaxed text-brand-mute">
            Six hand-picked stays a week. Honest reviews from real guests. Zero
            spam, one-click unsubscribe — and no, we won&rsquo;t sell your email
            to anyone.
          </p>

          <form
            className="mt-6 flex max-w-md items-stretch gap-2 rounded-card border border-brand-line bg-white p-1.5 focus-within:ring-2 focus-within:ring-brand-primary/40"
            action="#"
            method="post"
          >
            <input
              type="email"
              name="email"
              placeholder="you@email.com"
              aria-label="Email"
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-brand-ink outline-none placeholder:text-brand-mute/60"
            />
            <button
              type="submit"
              className="rounded bg-brand-primary px-5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
            >
              Subscribe
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-brand-mute">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-brand-primary" /> 18 240
              subscribers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-brand-primary" /> One email per
              week
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-brand-primary" /> Unsubscribe
              in one click
            </span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-card border border-brand-line bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-mute">
              Get the app
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-brand-ink">
              Book on the way to the airport.
            </div>
            <p className="mt-2 text-sm leading-relaxed text-brand-mute">
              Native iOS and Android apps. Save listings, message hosts, manage
              your bookings — all in your pocket.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded bg-brand-ink px-4 py-3 text-white transition-colors hover:bg-brand-secondary"
              >
                <Smartphone className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider opacity-70">
                    Download on
                  </div>
                  <div className="text-sm font-semibold leading-tight">
                    App Store
                  </div>
                </div>
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded bg-brand-ink px-4 py-3 text-white transition-colors hover:bg-brand-secondary"
              >
                <Smartphone className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider opacity-70">
                    Get it on
                  </div>
                  <div className="text-sm font-semibold leading-tight">
                    Google Play
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
