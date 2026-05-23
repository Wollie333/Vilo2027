import {
  CalendarCheck,
  Check,
  CreditCard,
  Home as HomeIcon,
  MessageSquare,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
  bullets: [string, string];
};

const FEATURES: Feature[] = [
  {
    icon: HomeIcon,
    title: "Branded booking page",
    body: (
      <>
        Your own URL —{" "}
        <span className="font-mono text-xs text-brand-dark">
          viloplatform.com/your-handle
        </span>
        . Photos, policies, instant book toggle.
      </>
    ),
    bullets: ["Drop-and-go photo gallery", "Custom domain on Pro"],
  },
  {
    icon: CalendarCheck,
    title: "Calendar that syncs",
    body: (
      <>
        Two-way iCal with Airbnb &amp; Booking.com. One calendar to rule them
        all — double-bookings end here.
      </>
    ),
    bullets: ["15-minute auto-sync", "Manual block & price overrides"],
  },
  {
    icon: MessageSquare,
    title: "Unified inbox",
    body: (
      <>
        Every inquiry, every channel — one realtime feed. Reply from your phone
        in seconds, never miss a booking.
      </>
    ),
    bullets: ["Push to iOS & Android", "Saved replies & templates"],
  },
  {
    icon: CreditCard,
    title: "Payments, three ways",
    body: (
      <>
        Paystack for cards &amp; instant EFT. PayPal for international. Manual
        EFT with proof-of-payment workflow.
      </>
    ),
    bullets: ["Money in your account, not ours", "Refund Manager built in"],
  },
  {
    icon: Star,
    title: "Reviews that travel",
    body: (
      <>
        Collect verified reviews after every stay. Embed them anywhere — your
        site, your Instagram bio, your Google Business.
      </>
    ),
    bullets: ["Automated request emails", "Public reply with one tap"],
  },
  {
    icon: Users,
    title: "Staff & co-hosts",
    body: (
      <>
        Add cleaners, co-hosts and assistants with scoped permissions. They
        handle bookings &amp; inbox — never billing.
      </>
    ),
    bullets: ["Granular role permissions", "Activity log & audit trail"],
  },
];

export function Features() {
  return (
    <section id="features" className="border-b border-brand-line">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <div className="mb-14 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Everything in one place
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-brand-dark md:text-4xl lg:text-5xl">
            Six tools, one tidy dashboard.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-brand-mute">
            Stop juggling email, WhatsApp, OTA inboxes and a paper diary. Vilo
            gives you the operating system serious hosts have been asking for.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, bullets }) => (
            <div
              key={title}
              className="group rounded-card border border-brand-line bg-white p-6 transition-shadow hover:shadow-card"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-brand-dark">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-mute">
                {body}
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-brand-mute">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
