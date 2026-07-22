import { cookies } from "next/headers";
import type { ReactNode } from "react";

import {
  CurrencyProvider,
  DISPLAY_CCY_COOKIE,
} from "@/components/currency/CurrencyProvider";
import { getDisplayRates } from "@/lib/fx";

/**
 * Wraps a tenant micro-site subtree in a currency-switching context, ENABLED
 * regardless of the global `CURRENCY_SWITCHER_ENABLED` flag (which gates the
 * main Wielo app). Guests browsing a host's site can preview prices in their own
 * currency; the actual charge is always in the host's settlement currency (ZAR),
 * so converted amounts render with the "≈" estimate marker (see <Money>).
 *
 * This nests INSIDE the app-root CurrencyProvider (which stays disabled) and its
 * context wins for the tenant subtree — so the header switcher + every <Money>
 * inside light up without touching the app. Rates come from the daily fx cache
 * (never throws — falls back to seeds); the initial display currency is the
 * guest's saved cookie.
 *
 * Server component: fetches rates + reads the cookie, then hands both to the
 * client provider. Wrap the tenant page's render (header + content) in it.
 */
export async function SiteCurrencyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const rates = await getDisplayRates();
  const initialCurrency = cookies().get(DISPLAY_CCY_COOKIE)?.value ?? null;
  return (
    <CurrencyProvider initialCurrency={initialCurrency} rates={rates} enabled>
      {children}
    </CurrencyProvider>
  );
}
