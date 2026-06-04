"use client";

import { createContext, useContext } from "react";

// Makes the configurable brand name available to client components. The value
// is resolved server-side (lib/brand.ts#getBrandName) and injected once at the
// root layout, so client code never queries it. Use:
//   const brand = useBrandName();           // "Vilo" (or the configured name)
//   <BrandName />                            // renders the name as text

const BrandContext = createContext<string>("Vilo");

export function BrandProvider({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={name}>{children}</BrandContext.Provider>;
}

export function useBrandName(): string {
  return useContext(BrandContext);
}

export function BrandName() {
  return <>{useContext(BrandContext)}</>;
}
