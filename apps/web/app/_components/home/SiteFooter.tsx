import Link from "next/link";

import { VLogo } from "./VLogo";

const columns: { heading: string; links: { label: string; href: string }[] }[] =
  [
    {
      heading: "Product",
      links: [
        { label: "For hosts", href: "#hosts" },
        { label: "For guests", href: "#guests" },
        { label: "Pricing", href: "#pricing" },
        { label: "Design system", href: "/DESIGN_SYSTEM.HTML" },
      ],
    },
    {
      heading: "Hosts",
      links: [
        { label: "List your stay", href: "/register" },
        { label: "Sign in", href: "/login" },
        { label: "Calendar sync", href: "#hosts" },
        { label: "Payments", href: "#hosts" },
      ],
    },
    {
      heading: "Guests",
      links: [
        { label: "Browse stays", href: "#guests" },
        { label: "Book direct", href: "#guests" },
        { label: "Why Vilo?", href: "#guests" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "Status", href: "/status" },
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ];

export function SiteFooter() {
  return (
    <footer className="bg-brand-dark text-brand-accent">
      <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <VLogo className="h-9 w-9" gradientId="footerLogoGradient" />
              <span className="font-display text-lg font-bold text-white">
                Vilo
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-brand-accent/70">
              Direct-booking management for South African hosts and the guests
              who travel with them.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {column.heading}
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-brand-accent/80 transition-colors duration-150 ease-out hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-brand-accent/60 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Vilo. All rights reserved.</span>
          <Link
            href="/status"
            className="inline-flex items-center gap-2 text-brand-accent/70 transition-colors duration-150 ease-out hover:text-white"
          >
            <span className="h-1.5 w-1.5 rounded-pill bg-brand-primary" />
            All systems operational
          </Link>
        </div>
      </div>
    </footer>
  );
}
