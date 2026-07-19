"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { DIRECTORY_COUNTRY_COOKIE } from "@/lib/geo/directoryCountryCookie";

import { useDirectoryCountry } from "./CountryProvider";

// Directory country picker, rendered in the site header left of the currency
// switcher. Options are the countries that actually have listings, plus "All
// destinations". Changing it persists the choice (cookie, 1 year) and refreshes
// so the server re-prioritises the directory. Auto-hides until there are ≥2
// countries to choose between.
export function CountrySelector({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const { country, countries } = useDirectoryCountry();
  const router = useRouter();
  const [pending, start] = useTransition();

  if (countries.length < 2) return null;

  // Only show the resolved country as selected when it actually has listings;
  // otherwise fall back to "All" so the control never shows an off-list value.
  const selected = countries.some((c) => c.iso2 === country) ? country : "";

  function onChange(value: string) {
    document.cookie = `${DIRECTORY_COUNTRY_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    start(() => router.refresh());
  }

  const dark = variant === "dark";
  return (
    <label className={`relative inline-flex items-center ${className ?? ""}`}>
      <span className="sr-only">Directory country</span>
      <Globe
        aria-hidden
        className={`pointer-events-none absolute h-3.5 w-3.5 ${
          dark ? "left-1 text-brand-accent/70" : "left-2.5 text-brand-mute"
        }`}
      />
      <select
        value={selected}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Directory country"
        title="Show stays in"
        className={
          dark
            ? "h-7 cursor-pointer appearance-none rounded bg-transparent pl-6 pr-5 text-[12px] font-medium text-brand-accent/90 outline-none transition hover:text-white focus:text-white"
            : "h-9 cursor-pointer appearance-none rounded-pill border border-brand-line bg-white pl-8 pr-7 text-[12.5px] font-semibold text-brand-ink outline-none transition hover:bg-brand-light focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        }
      >
        <option value="">All destinations</option>
        {countries.map((c) => (
          <option key={c.iso2} value={c.iso2} className="text-brand-ink">
            {c.name}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={`pointer-events-none absolute h-3.5 w-3.5 ${
          dark ? "right-0.5 text-brand-accent/70" : "right-2 text-brand-mute"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 9l5 5 5-5" />
      </svg>
    </label>
  );
}
