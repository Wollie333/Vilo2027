import "server-only";

import { cookies, headers } from "next/headers";

import { countryByIso } from "@/lib/phone/dialCodes";

import { DIRECTORY_COUNTRY_COOKIE } from "./directoryCountryCookie";
import { getListedCountries } from "./listedCountries";

/**
 * The directory country for this request, as an uppercase ISO2 — or "" meaning
 * "All destinations" (no country prioritisation).
 *
 * Priority: the visitor's explicit pick (cookie) wins, even when it's the empty
 * "All" choice. With no cookie we auto-detect from the edge geo header
 * (Vercel `x-vercel-ip-country`, Cloudflare `cf-ipcountry`), falling back to ZA.
 * An unrecognised code resolves to "" so we never prioritise a bogus country.
 */
export function resolveDirectoryCountry(): string {
  const cookie = cookies().get(DIRECTORY_COUNTRY_COOKIE)?.value;
  if (cookie !== undefined) {
    const iso = cookie.toUpperCase();
    return iso && countryByIso(iso) ? iso : "";
  }
  const geo = (
    headers().get("x-vercel-ip-country") ??
    headers().get("cf-ipcountry") ??
    ""
  ).toUpperCase();
  if (geo && countryByIso(geo)) return geo;
  return "ZA";
}

/**
 * The country to prioritise in the directory for this request, or null to show
 * every country in the normal order. Null unless there are ≥2 countries with
 * listings AND the resolved country is one of them — so prioritisation is only
 * ever engaged when it can actually change what a visitor sees.
 */
export async function directoryPriorityCountry(): Promise<string | null> {
  const listed = await getListedCountries();
  if (listed.length < 2) return null;
  const resolved = resolveDirectoryCountry();
  return resolved && listed.some((c) => c.iso2 === resolved) ? resolved : null;
}
