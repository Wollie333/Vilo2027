import type { Metadata } from "next";

import { CategoryChips } from "@/app/_components/home/CategoryChips";
import { DealsBanner } from "@/app/_components/home/DealsBanner";
import { FeaturedListings } from "@/app/_components/home/FeaturedListings";
import { Hero } from "@/app/_components/home/Hero";
import { HostCTA } from "@/app/_components/home/HostCTA";
import { RecentReviews } from "@/app/_components/home/RecentReviews";
import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { TrendingDestinations } from "@/app/_components/home/TrendingDestinations";
import { TrustPillars } from "@/app/_components/home/TrustPillars";
import { getHomeData } from "@/app/_components/home/home-data";
import { listedRegionPhrase } from "@/lib/geo/regionPhrase";

/** Region wording follows the countries that actually have listings, so the
 *  directory never claims a footprint it doesn't have — or hides one it does. */
export async function generateMetadata(): Promise<Metadata> {
  const region = await listedRegionPhrase();
  return {
    title: `Direct booking directory ${region.scope}`,
    description: `Book verified stays ${region.scope} straight with the host. No middle-man, no booking fees, no fine print.`,
  };
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />
      <Hero stats={data.stats} popularCities={data.popularCities} />
      <CategoryChips chips={data.chips} />
      <FeaturedListings listings={data.featured} totalStays={data.totalStays} />
      <TrendingDestinations destinations={data.destinations} />
      <DealsBanner />
      <TrustPillars />
      <RecentReviews reviews={data.reviews} />
      <HostCTA />
      <SiteFooter />
    </div>
  );
}
