"use client";

import { createContext, useContext } from "react";

import type { ListedCountry } from "@/lib/geo/listedCountries";

// The directory's country context, seeded once at the root layout from the
// resolved cookie/geo + the list of countries that have listings. Consumed by
// the header CountrySelector. Purely for the picker UI — the actual
// prioritisation runs server-side off the same cookie.
type CountryCtx = {
  /** Resolved ISO2, or "" for All destinations. */
  country: string;
  /** Countries that currently have published listings. */
  countries: ListedCountry[];
};

const CountryContext = createContext<CountryCtx>({
  country: "",
  countries: [],
});

export function CountryProvider({
  country,
  countries,
  children,
}: {
  country: string;
  countries: ListedCountry[];
  children: React.ReactNode;
}) {
  return (
    <CountryContext.Provider value={{ country, countries }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useDirectoryCountry(): CountryCtx {
  return useContext(CountryContext);
}
