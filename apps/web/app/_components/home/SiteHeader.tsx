import Link from "next/link";

import { VLogo } from "./VLogo";

const navLinks = [
  { href: "#hosts", label: "For hosts" },
  { href: "#guests", label: "For guests" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-line/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <VLogo className="h-8 w-8" gradientId="navLogoGradient" />
          <span className="font-display text-lg font-bold tracking-tight text-brand-ink">
            Vilo
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded px-3 py-2 text-sm font-medium text-brand-mute transition-colors duration-150 ease-out hover:bg-brand-accent hover:text-brand-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded px-4 py-2 text-sm font-medium text-brand-primary transition-colors duration-150 ease-out hover:bg-brand-accent sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-brand-dark"
          >
            Get started
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
