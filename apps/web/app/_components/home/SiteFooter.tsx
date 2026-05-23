import Link from "next/link";

import { VLogo } from "./VLogo";

const EXPLORE = [
  { href: "#destinations", label: "Destinations" },
  { href: "#types", label: "Property types" },
  { href: "#deals", label: "Deals" },
  { href: "#", label: "Group stays" },
  { href: "#", label: "Gift cards" },
] as const;

const GUESTS = [
  { href: "/login", label: "Sign in" },
  { href: "/dashboard", label: "My bookings" },
  { href: "#", label: "Help centre" },
  { href: "#", label: "Refund policy" },
  { href: "#", label: "Cancel a booking" },
] as const;

const HOSTS = [
  { href: "/booking-management", label: "List your property" },
  { href: "/booking-management#how", label: "How Vilo works" },
  { href: "/booking-management#pricing", label: "Pricing" },
  { href: "#", label: "Host academy" },
  { href: "#", label: "Migration guide" },
] as const;

const COMPANY = [
  { href: "#", label: "About" },
  { href: "#", label: "Blog" },
  { href: "#", label: "Careers" },
  { href: "#", label: "Press" },
  { href: "#", label: "Contact" },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-brand-dark text-brand-accent/80">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5">
              <VLogo size={32} gradientId="home-footer-logo" />
              <span className="font-display text-[17px] font-bold tracking-tight text-white">
                Vilo
              </span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              South Africa&rsquo;s direct-stay platform. Book directly with the
              host. Pay the price you see.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="X"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M18.244 2H21l-6.52 7.45L22 22h-6.781l-5.32-6.957L3.8 22H1.04l6.974-7.969L1.5 2h6.96l4.81 6.36L18.244 2zm-2.376 18h1.875L7.21 4H5.197L15.868 20z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>

          <FooterColumn title="Explore" links={EXPLORE} />
          <FooterColumn title="Guests" links={GUESTS} />
          <FooterColumn title="Hosts" links={HOSTS} />
          <FooterColumn title="Company" links={COMPANY} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs md:flex-row md:items-center">
          <div>© 2026 Vilo Platform (Pty) Ltd · Cape Town, South Africa</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:ml-auto">
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <a href="#" className="hover:text-white">
              POPIA
            </a>
            <Link href="/cookies" className="hover:text-white">
              Cookies
            </Link>
            <Link
              href="/change-log"
              className="inline-flex items-center gap-1.5 font-mono hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              All systems operational
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div className="md:col-span-2">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
        {title}
      </div>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
