import type { Metadata } from "next";

import { BrowseResults } from "@/app/_components/browse/BrowseResults";
import { getBrowseAmenities } from "@/app/_components/browse/browseAmenities";
import { FilterSheet } from "@/app/_components/browse/FilterSheet";
import {
  searchListings,
  type BrowseSearchParams,
} from "@/app/_components/browse/searchListings";
import { getBrandName } from "@/lib/brand";
import { directoryPriorityCountry } from "@/lib/geo/directoryCountry";
import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { createServerClient } from "@/lib/supabase/server";

import { SearchBar } from "./SearchBar";
import { TypeChips } from "./TypeChips";

export const metadata: Metadata = {
  title: "Explore stays",
  description:
    "Search direct-booking stays across South Africa — book straight with the host.",
};

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: BrowseSearchParams;
}) {
  const supabase = createServerClient();
  const brandName = await getBrandName();
  const priorityCountry = await directoryPriorityCountry();
  const result = await searchListings(
    supabase,
    searchParams,
    "/explore",
    priorityCountry,
  );
  const amenityOptions = await getBrowseAmenities();

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      {/* Search bar */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
          <SearchBar
            where={result.where}
            guests={result.guests ?? 0}
            currentType={result.type}
            currentSort={result.sort}
          />
        </div>
      </section>

      {/* Type chips */}
      <section className="sticky top-16 z-20 border-b border-brand-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 lg:px-8">
          <div className="min-w-0 flex-1">
            <TypeChips currentType={result.type} />
          </div>
          <FilterSheet
            advanced={result.advanced}
            advancedCount={result.advancedCount}
            guests={result.guests}
            sort={result.sort}
            amenityOptions={amenityOptions}
          />
        </div>
      </section>

      {/* Results */}
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <BrowseResults
          result={result}
          basePath="/explore"
          brandName={brandName}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
