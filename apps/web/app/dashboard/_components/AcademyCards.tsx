import { Camera, RefreshCw, Tag } from "lucide-react";
import Link from "next/link";

const CARDS = [
  {
    Icon: Camera,
    badge: "Photo",
    readTime: "5-min read",
    title: "Photos that get bookings",
    body: "Light, angle, composition. Phone-camera shots that look professional — without buying gear.",
    href: "/help",
  },
  {
    Icon: Tag,
    badge: "Pricing",
    readTime: "7-min read",
    title: "Price for your market",
    body: "Cape Town vs Pretoria vs Kruger fringe. How to read demand and set weekend uplift.",
    href: "/help",
  },
  {
    Icon: RefreshCw,
    badge: "Sync",
    readTime: "4-min read",
    title: "Sync with Airbnb & Booking.com",
    body: "Two-way iCal in three clicks. Never get a double booking again.",
    href: "/dashboard/calendar-sync",
  },
] as const;

export function AcademyCards() {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Vilo Academy
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            Hosting essentials, while you set up
          </h3>
        </div>
        <Link
          href="/help"
          className="text-[12px] font-medium text-brand-primary hover:underline"
        >
          See all guides →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CARDS.map(({ Icon, badge, readTime, title, body, href }) => (
          <Link
            key={title}
            href={href}
            className="group block overflow-hidden rounded-card border border-brand-line bg-white shadow-card transition hover:-translate-y-px hover:shadow-lg"
          >
            <div className="relative flex aspect-[16/10] items-center justify-center bg-brand-accent/60">
              <Icon className="h-12 w-12 text-brand-secondary opacity-70 transition-transform duration-500 group-hover:scale-110" />
              <span className="absolute left-3 top-3 rounded-pill bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-secondary backdrop-blur">
                {badge}
              </span>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
                {readTime}
              </div>
              <div className="mt-1 font-display text-[15px] font-semibold leading-tight text-brand-ink">
                {title}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-mute">
                {body}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
