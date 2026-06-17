import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { getBrandName } from "@/lib/brand";

/**
 * Listing breadcrumb: Vilo › Country › Province › City › Listing.
 * Region segments are plain labels (no destination pages yet); only the
 * Vilo root links home. Matches the design's breadcrumb row.
 */
export async function Breadcrumb({
  country,
  province,
  city,
  name,
}: {
  country?: string | null;
  province?: string | null;
  city?: string | null;
  name: string;
}) {
  const brandName = await getBrandName();
  const countryLabel = country === "ZA" ? "South Africa" : (country ?? null);
  const crumbs = [countryLabel, province, city].filter(Boolean) as string[];

  return (
    <div className="border-b border-brand-line bg-white">
      <nav
        aria-label="Breadcrumb"
        className="hscroll mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-5 py-3 text-[12px] text-brand-mute lg:px-8"
      >
        <Link href="/" className="shrink-0 hover:text-brand-ink">
          {brandName}
        </Link>
        {crumbs.map((c) => (
          <span key={c} className="flex shrink-0 items-center gap-1.5">
            <ChevronRight className="h-3 w-3" />
            <span>{c}</span>
          </span>
        ))}
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span className="truncate font-medium text-brand-ink">{name}</span>
      </nav>
    </div>
  );
}
