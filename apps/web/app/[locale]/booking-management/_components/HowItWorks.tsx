import { Sparkles } from "lucide-react";

import { getBrandName } from "@/lib/brand";

type Step = {
  n: number;
  label: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    label: "step one",
    title: "Claim your handle",
    body: "Pick the URL guests will use. Free for the trial — and yours forever.",
  },
  {
    n: 2,
    label: "step two",
    title: "Add your listing",
    body: "Drop in photos, pricing, policies. Import existing iCal feeds in one click.",
  },
  {
    n: 3,
    label: "step three",
    title: "Connect payments",
    body: "Link Paystack, PayPal, or your bank — guests can pay you any way they want.",
  },
];

export async function HowItWorks() {
  const brandName = await getBrandName();
  return (
    <section id="how" className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="mb-14 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
              How it works
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
              Live on {brandName} in{" "}
              <span className="text-brand-primary">under 20 minutes.</span>
            </h2>
          </div>
          <div className="flex lg:col-span-5 lg:items-end">
            <p className="leading-relaxed text-brand-mute">
              You don&rsquo;t need a developer, a brand book, or an agency. If
              you can fill in a form and upload a few photos, you&rsquo;re
              ninety percent of the way there.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-4 md:gap-3">
          {STEPS.map((step) => (
            <div key={step.n} className="step-line">
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
                  Share &amp; book
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
                  Share your link. {brandName} handles the rest — payments,
                  confirmations, reviews.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
