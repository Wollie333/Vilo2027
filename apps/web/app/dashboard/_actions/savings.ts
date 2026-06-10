"use server";

import { getHostSavings } from "@/lib/savings/getHostSavings";
import { computeSavings } from "@/lib/savings/ota-competitors";

export interface SavingsSummary {
  savedSoFar: number;
  directRevenue: number;
  bookingCount: number;
  currency: string;
}

/**
 * Lightweight summary for the header "$" badge modal. Fetched lazily on click
 * so the figure never loads on every dashboard navigation. Returns null when
 * the caller isn't a host.
 */
export async function fetchMySavingsSummary(): Promise<SavingsSummary | null> {
  const savings = await getHostSavings();
  if (!savings) return null;

  const { savedSoFar } = computeSavings(savings.direct_revenue);
  return {
    savedSoFar,
    directRevenue: savings.direct_revenue,
    bookingCount: savings.booking_count,
    currency: savings.currency,
  };
}
