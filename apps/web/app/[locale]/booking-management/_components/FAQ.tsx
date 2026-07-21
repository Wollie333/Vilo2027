import { CONTACT_EMAIL } from "@/lib/contact";
import { getBrandName } from "@/lib/brand";

type Item = {
  q: string;
  a: string;
};

const ITEMS: Item[] = [
  {
    q: "Do I have to leave Airbnb or Booking.com?",
    a: "No — most hosts run Wielo alongside the OTAs at first, and migrate guests over to direct booking as the savings stack up. Two-way iCal sync prevents double-bookings.",
  },
  {
    q: "How does Wielo make money if there's no commission?",
    a: "Subscriptions only. Pick a plan, pay a flat monthly fee, keep 100% of every booking. We never see a cent of guest money — it goes directly from the guest to your Paystack or PayPal account.",
  },
  {
    q: "What payment methods can guests use?",
    a: "Card and instant EFT via Paystack (Africa). PayPal for international guests on Pro and above. Manual bank transfer with proof-of-payment upload on every plan.",
  },
  {
    q: "Is there really a free tier?",
    a: "Yes. List one property in the Wielo Directory at no cost. You won't get the dashboard, inbox or direct-booking page — those are the paid tools — but you'll get discovery for free.",
  },
  {
    q: "Can I bring my team in?",
    a: "Pro includes 3 staff seats with scoped permissions — they can manage bookings and the inbox, but never billing or listing deletion. Business gives you unlimited seats and a full activity log.",
  },
  {
    q: "What about mobile?",
    a: "Native iOS and Android apps with push notifications for new bookings and messages. Same login as the web app — your inbox follows you everywhere.",
  },
];

export async function FAQ() {
  const brandName = await getBrandName();
  return (
    <section id="faq" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              Common questions
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl">
              Anything else?
            </h2>
            <p className="mt-5 leading-relaxed text-brand-mute">
              Can&rsquo;t find what you&rsquo;re looking for? Email{" "}
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
            {ITEMS.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                  <span className="font-display text-base font-semibold text-brand-dark md:text-lg">
                    {item.q.replace("Wielo", brandName)}
                  </span>
                  <span className="acc-icon mt-1 text-2xl leading-none text-brand-primary">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-prose leading-relaxed text-brand-mute">
                  {item.a.replace("Wielo", brandName)}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
