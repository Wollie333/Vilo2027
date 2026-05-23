type Step = {
  title: string;
  body: string;
};

const hostSteps: Step[] = [
  {
    title: "Build your listing",
    body: "Photos, pricing, policies, calendar — set up in one sitting, edit any time.",
  },
  {
    title: "Sync your calendar",
    body: "Plug in your Airbnb / Booking.com iCal feeds and stop juggling spreadsheets.",
  },
  {
    title: "Get paid direct",
    body: "Paystack for cards, PayPal for international, EFT for the locals who prefer it.",
  },
];

const guestSteps: Step[] = [
  {
    title: "Find a stay",
    body: "Search the Vilo directory or land on a host's own Vilo page from their socials.",
  },
  {
    title: "Book directly",
    body: "Pick your dates, pay in Rand, and skip the marketplace surcharge.",
  },
  {
    title: "Stay in touch",
    body: "Use the in-app inbox to chat with the host — before, during, and after your stay.",
  },
];

function StepList({
  steps,
  accent,
}: {
  steps: Step[];
  accent: "primary" | "secondary";
}) {
  const numberClasses =
    accent === "primary"
      ? "border-brand-primary text-brand-primary"
      : "border-brand-secondary text-brand-secondary";
  return (
    <ol className="space-y-6">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border-2 bg-white font-display text-sm font-bold ${numberClasses}`}
          >
            {i + 1}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h4 className="font-display text-base font-semibold text-brand-dark">
              {step.title}
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-brand-mute">
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorks() {
  return (
    <section className="border-b border-brand-line bg-white">
      <div className="mx-auto max-w-5xl px-6 py-20 lg:px-10">
        <div className="mb-12 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            How it works
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-brand-dark sm:text-4xl">
            Three steps. Either side of the booking.
          </h2>
        </div>

        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          <div className="rounded-card border border-brand-line bg-brand-light/40 p-6 sm:p-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-pill bg-brand-accent px-3 py-1 text-xs font-medium text-brand-primary">
              For hosts
            </div>
            <StepList steps={hostSteps} accent="primary" />
          </div>
          <div className="rounded-card border border-brand-line bg-brand-light/40 p-6 sm:p-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-pill bg-brand-secondary/10 px-3 py-1 text-xs font-medium text-brand-secondary">
              For guests
            </div>
            <StepList steps={guestSteps} accent="secondary" />
          </div>
        </div>
      </div>
    </section>
  );
}
