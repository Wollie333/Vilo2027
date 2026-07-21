import "server-only";

import { countryByIso } from "@/lib/phone/dialCodes";

import { resolveDirectoryCountry } from "./directoryCountry";
import { getListedCountries } from "./listedCountries";

export type RegionPhrase = {
  /** Bare region name(s) — "South Africa", "Namibia and South Africa", "6 countries". */
  label: string;
  /** Same thing with a preposition — "in South Africa", "across 6 countries". */
  scope: string;
};

/**
 * The region the directory can honestly claim to cover, derived from the
 * countries that actually have published listings (`getListedCountries`) rather
 * than asserted in copy. One country is named; two or three are named together;
 * beyond that we count them, because a list stops reading like a sentence.
 *
 * The visitor's priority country (cookie / edge geo) leads the list so the
 * wording matches the "prioritise, don't hide" ordering they see below it.
 * With nothing published yet we fall back to naming the country we would
 * prioritise, so the copy is never blank.
 */
export async function listedRegionPhrase(): Promise<RegionPhrase> {
  const listed = await getListedCountries();

  if (listed.length === 0) {
    const iso = resolveDirectoryCountry();
    const label = countryByIso(iso)?.name ?? "South Africa";
    return { label, scope: `in ${label}` };
  }

  if (listed.length > 3) {
    const label = `${listed.length} countries`;
    return { label, scope: `across ${label}` };
  }

  const priority = resolveDirectoryCountry();
  const names = [
    ...listed.filter((c) => c.iso2 === priority),
    ...listed.filter((c) => c.iso2 !== priority),
  ].map((c) => c.name);

  const label =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return { label, scope: `in ${label}` };
}
