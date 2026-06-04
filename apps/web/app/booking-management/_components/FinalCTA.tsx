import { ArrowRight } from "lucide-react";

import { getBrandName } from "@/lib/brand";

export async function FinalCTA() {
  const brandName = await getBrandName();
  return (
    <section
      id="cta"
      className="relative overflow-hidden border-b border-brand-line bg-brand-primary text-white"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
              Take it back
            </div>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-[1.04] tracking-tight text-white md:text-4xl lg:text-[56px]">
              The next booking should be yours.{" "}
              <span className="font-semibold text-brand-accent">
                All of it.
              </span>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-accent/85">
              Set up in twenty minutes. Free for fourteen days. No card, no
              commitments, no commission — now or ever.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-card bg-white p-6 text-brand-dark shadow-card">
              <div className="text-xs font-medium uppercase tracking-wider text-brand-mute">
                Claim your URL now
              </div>
              <form
                className="mt-3 flex items-stretch gap-2 rounded-card border border-brand-line bg-brand-light p-1.5 focus-within:ring-2 focus-within:ring-brand-primary/30"
                action="/signup/host"
                method="get"
              >
                <div className="flex shrink-0 items-center pl-3 pr-1 font-mono text-sm text-brand-mute">
                  vilo.com/
                </div>
                <input
                  type="text"
                  name="handle"
                  placeholder="your-handle"
                  aria-label={`Choose your ${brandName} handle`}
                  className="min-w-0 flex-1 bg-transparent font-mono text-sm text-brand-dark outline-none placeholder:text-brand-mute/60"
                />
              </form>
              <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-brand-primary px-4 py-3 font-medium text-white transition-colors hover:bg-brand-dark">
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs font-semibold text-brand-dark">
                    14 days
                  </div>
                  <div className="text-[10px] text-brand-mute">free</div>
                </div>
                <div className="border-x border-brand-line">
                  <div className="text-xs font-semibold text-brand-dark">
                    No card
                  </div>
                  <div className="text-[10px] text-brand-mute">required</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-brand-dark">
                    Cancel
                  </div>
                  <div className="text-[10px] text-brand-mute">anytime</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
