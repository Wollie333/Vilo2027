"use client";

import { Heart, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { VLogo } from "./VLogo";

const NAV = [
  { href: "#destinations", label: "Destinations" },
  { href: "#types", label: "Property types" },
  { href: "#deals", label: "Deals" },
  { href: "/booking-management", label: "For hosts" },
] as const;

export function SiteHeader() {
  const [elevated, setElevated] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function onScroll() {
      setElevated(window.scrollY > 520);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-40 border-b border-brand-line bg-white/90 backdrop-blur transition-shadow ${
        elevated ? "nav-elevated" : ""
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 lg:px-8">
        <Link
          href="/"
          aria-label="Vilo home"
          className="flex shrink-0 items-center gap-2.5"
        >
          <VLogo size={36} gradientId="home-nav-logo" />
          <div className="leading-none">
            <div className="font-display text-[18px] font-bold tracking-tight text-brand-ink">
              Vilo
            </div>
            <div className="mt-0.5 hidden text-[10px] text-brand-mute sm:block">
              Direct stays. Direct hosts.
            </div>
          </div>
        </Link>

        <button
          type="button"
          aria-label="Search stays"
          className={`hidden items-center gap-2 rounded-pill border border-brand-line bg-white py-1.5 pl-4 pr-1.5 text-sm text-brand-mute transition-shadow hover:shadow-card md:flex ${
            elevated ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <span className="font-medium text-brand-ink">Anywhere</span>
          <span className="h-4 w-px bg-brand-line" />
          <span>Any week</span>
          <span className="h-4 w-px bg-brand-line" />
          <span>Guests</span>
          <span className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white">
            <Search className="h-4 w-4" />
          </span>
        </button>

        <nav className="ml-auto hidden items-center gap-6 text-sm text-brand-mute lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-brand-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent md:inline-flex"
          >
            <Heart className="h-4 w-4" />
            Saved
          </button>
          <Link
            href="/login"
            className="hidden rounded px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
          >
            Join Vilo
          </Link>
        </div>
      </div>
    </header>
  );
}
