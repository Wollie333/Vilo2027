import { EarningsCalculator } from "./EarningsCalculator";

export function ValueProp() {
  return (
    <section className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="grid items-start gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              The OTA tax
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              Airbnb keeps 18%.
              <br />
              Booking.com keeps 22%.
              <br />
              <span className="text-brand-primary">Vilo keeps R0.</span>
            </h2>
            <p className="mt-6 max-w-md leading-relaxed text-brand-mute">
              You built the business. You answered the late-night WhatsApp. You
              scrubbed the bathroom at 11pm. You shouldn&rsquo;t be losing a
              fifth of every booking to a platform that won&rsquo;t even share
              your guest&rsquo;s email.
            </p>
            <p className="mt-4 max-w-md leading-relaxed text-brand-mute">
              Vilo flips it. Pay a flat fee. Own the relationship. Get paid in
              full.
            </p>
          </div>

          <EarningsCalculator />
        </div>
      </div>
    </section>
  );
}
