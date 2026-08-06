"use client";

import { DirectorySearchBar } from "@/app/_components/browse/DirectorySearchBar";

/**
 * The /explore + /portal/browse search bar. A thin adapter over the shared
 * DirectorySearchBar: type is chosen via the TypeChips row here (not a dropdown),
 * so the bar shows Where · Dates · Guests · Sort. The current `type` param is
 * preserved on submit because DirectorySearchBar starts from the live URL.
 */
export function SearchBar({
  where,
  guests,
  currentSort,
  checkin = "",
  checkout = "",
  basePath = "/explore",
}: {
  where: string;
  guests: number;
  currentType: string;
  currentSort: string;
  checkin?: string;
  checkout?: string;
  basePath?: string;
}) {
  return (
    <DirectorySearchBar
      typeOptions={[]}
      where={where}
      guests={guests}
      checkin={checkin}
      checkout={checkout}
      sort={currentSort}
      basePath={basePath}
      variant="inline"
      showType={false}
      showSort
    />
  );
}
