import { Link } from "@/i18n/navigation";

import {
  getBrandName,
  getCompanyLegalName,
  getCompanyLocation,
} from "@/lib/brand";

import { VLogo } from "./VLogo";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Directory", href: "#directory" },
  { label: "Mobile apps", href: "#" },
  { label: "Changelog", href: "/change-log" },
] as const;

const HOST_LINKS = [
  { label: "Start trial", href: "/signup/host" },
  { label: "Migration guide", href: "#" },
  { label: "Help centre", href: "#" },
  { label: "API docs", href: "#" },
] as const;

const COMPANY_LINKS = [
  { label: "About", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Contact", href: "#" },
] as const;

const LEGAL_LINKS = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Security", href: "#" },
  { label: "POPIA", href: "#" },
] as const;

export async function PageFooter() {
  const [brand, companyName, companyLocation] = await Promise.all([
    getBrandName(),
    getCompanyLegalName(),
    getCompanyLocation(),
  ]);
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-dark text-brand-accent/80">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5">
              <VLogo size="md" gradientId="bm-footer-logo" />
              <span className="font-display text-[17px] font-bold tracking-tight text-white">
                {brand}
              </span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              Direct-booking management for accommodation hosts. Built in South
              Africa, for the world.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-accent"
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
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-accent"
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
                aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 transition-colors hover:border-brand-accent"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Hosts" links={HOST_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs md:flex-row md:items-center">
          <div>
            © {year} {companyName}. {companyLocation}.
          </div>
          <div className="flex items-center gap-3 font-mono md:ml-auto">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed" />
              All systems operational
            </span>
            <span className="text-white/30">·</span>
            <Link href="/change-log" className="hover:text-white">
              v1.0.0
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
  links: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <div className="md:col-span-2">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-brand-accent">
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
