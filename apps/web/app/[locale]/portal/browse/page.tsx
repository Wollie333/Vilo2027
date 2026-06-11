import type { Metadata } from "next";

import { BrowseResults } from "@/app/_components/browse/BrowseResults";
import {
  searchListings,
  type BrowseSearchParams,
} from "@/app/_components/browse/searchListings";
import { SearchBar } from "@/app/[locale]/explore/SearchBar";
import { TypeChips } from "@/app/[locale]/explore/TypeChips";
import { getBrandName } from "@/lib/brand";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Browse stays",
};

export const dynamic = "force-dynamic";

// Same search experience as the public /explore page, rendered inside the
// guest portal shell (no marketing header/footer) so a guest can find and
// book another stay without leaving the portal. Shares searchListings +
// BrowseResults + SearchBar + TypeChips; only the basePath differs.
export default async function PortalBrowsePage({
  searchParams,
}: {
  searchParams?: BrowseSearchParams;
}) {
  const supabase = createServerClient();
  const brandName = await getBrandName();
  const result = await searchListings(supabase, searchParams, "/portal/browse");

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
          Browse stays
        </h1>
        <p className="mt-2 text-sm text-brand-mute">
          Find your next stay and book directly with the host.
        </p>
      </header>

      <div className="mb-4">
        <SearchBar
          where={result.where}
          guests={result.guests ?? 0}
          currentType={result.type}
          currentSort={result.sort}
          basePath="/portal/browse"
        />
      </div>

      <div className="mb-6 border-b border-brand-line">
        <TypeChips currentType={result.type} basePath="/portal/browse" />
      </div>

      <BrowseResults
        result={result}
        basePath="/portal/browse"
        brandName={brandName}
      />
    </div>
  );
}
