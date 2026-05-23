import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { VLogo } from "./VLogo";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#directory", label: "Directory" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-line/70 bg-brand-light/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 lg:px-8">
        <Link
          href="/"
          aria-label="Vilo home"
          className="flex shrink-0 items-center gap-2.5"
        >
          <VLogo size="md" gradientId="bm-nav-logo" />
          <span className="font-display text-[17px] font-bold tracking-tight text-brand-ink">
            Vilo
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-brand-mute lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-brand-dark"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/login"
            className="hidden rounded px-3 py-2 text-sm font-medium text-brand-dark hover:bg-brand-accent md:inline-flex"
          >
            Log in
          </Link>
          <a
            href="#cta"
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
