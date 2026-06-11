import type { Metadata } from "next";
import Link from "next/link";

import { getBrandName } from "@/lib/brand";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: "About",
    description: `${brandName} is South Africa's direct-stay platform. Hosts keep more, guests pay less, and bookings don't get lost in inbox roulette.`,
  };
}

export default async function AboutPage() {
  const brandName = await getBrandName();
  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
            About {brandName}
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-brand-ink sm:text-5xl">
            Direct bookings.{" "}
            <span className="text-brand-primary">Fair fees. Local hosts.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-brand-mute">
            {brandName} is built for South African accommodation hosts who want
            to take bookings on their own terms — without handing 18% off the
            top to a global marketplace.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="space-y-12">
          <Section
            title="Why we exist"
            body={
              <>
                <p>
                  The dominant booking platforms work — for the platforms. For a
                  small lodge owner in Hogsback, they mean handing over a 15-18%
                  cut, fighting opaque suspensions, and never actually owning
                  the guest relationship. We thought there was room for
                  something flatter.
                </p>
                <p>
                  {brandName} gives every host a public profile, a direct
                  booking engine, and the boring infrastructure (payments,
                  calendars, invoices, reviews, refunds) that running a
                  hospitality business actually requires. Hosts keep the guest,
                  the margin, and the brand.
                </p>
              </>
            }
          />

          <Section
            title="What we believe"
            body={
              <>
                <ul className="ml-5 list-disc space-y-2">
                  <li>
                    <strong className="text-brand-ink">
                      Hosts deserve their margin.
                    </strong>{" "}
                    A flat subscription, not a per-booking cut, beats the
                    marketplace tax on every level above ~3 bookings a month.
                  </li>
                  <li>
                    <strong className="text-brand-ink">Local first.</strong> ZAR
                    pricing. Paystack, PayPal and manual EFT. SA bank holidays
                    on the calendar.
                  </li>
                  <li>
                    <strong className="text-brand-ink">
                      Transparency cuts both ways.
                    </strong>{" "}
                    Guests see the host&apos;s actual cancellation policy. Hosts
                    see everything we know about the guest. No mystery margins.
                  </li>
                  <li>
                    <strong className="text-brand-ink">Boring is good.</strong>{" "}
                    Invoices, banking, audit logs, GDPR / POPIA tooling, real
                    refund flows — the unsexy stuff a real business needs.
                  </li>
                </ul>
              </>
            }
          />

          <Section
            title="What we're building"
            body={
              <p>
                A direct booking platform that does the basics well: a listing
                editor that lets you describe what you actually have, a calendar
                that syncs both ways with Airbnb / Booking.com, an inbox that
                doesn&apos;t scatter conversations across email and WhatsApp,
                and a host page worth sending guests to.
              </p>
            }
          />

          <Section
            title="Where we are"
            body={
              <p>
                {brandName} is in pre-launch — built by a single founder in Cape
                Town, getting the platform to production-ready before the first
                beta hosts come on. Follow along on the{" "}
                <Link
                  href="/change-log"
                  className="text-brand-primary underline-offset-2 hover:underline"
                >
                  changelog
                </Link>
                .
              </p>
            }
          />

          <Section
            title="Get in touch"
            body={
              <p>
                Questions, partnerships, or you want to be one of the first
                hosts? Mail{" "}
                <a
                  href="mailto:hello@viloplatform.com"
                  className="text-brand-primary underline-offset-2 hover:underline"
                >
                  hello@viloplatform.com
                </a>{" "}
                — replies within one working day.
              </p>
            }
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Section({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold tracking-tight text-brand-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-[15.5px] leading-relaxed text-brand-mute">
        {body}
      </div>
    </section>
  );
}
