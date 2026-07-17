"use client";

import { createContext, useContext } from "react";

// Makes the configurable brand + company identity available to client
// components. Values are resolved server-side (lib/brand.ts) and injected once
// at the root layout, so client code never queries them. Use:
//   const brand = useBrandName();        // "Wielo" (or the configured name)
//   <BrandName />                        // renders the brand name as text
//   const co = useCompanyName();         // "Wielo Platform (Pty) Ltd"
//   const loc = useCompanyLocation();    // "Cape Town, South Africa"

export type Branding = {
  brandName: string;
  companyName: string;
  companyLocation: string;
};

const DEFAULTS: Branding = {
  brandName: "Wielo",
  companyName: "Wielo Platform (Pty) Ltd",
  companyLocation: "Cape Town, South Africa",
};

const BrandContext = createContext<Branding>(DEFAULTS);

export function BrandProvider({
  value,
  children,
}: {
  value: Branding;
  children: React.ReactNode;
}) {
  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
}

export function useBrandName(): string {
  return useContext(BrandContext).brandName;
}

export function useCompanyName(): string {
  return useContext(BrandContext).companyName;
}

export function useCompanyLocation(): string {
  return useContext(BrandContext).companyLocation;
}

export function BrandName() {
  return <>{useContext(BrandContext).brandName}</>;
}
