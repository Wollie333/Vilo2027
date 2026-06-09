import type { Metadata } from "next";

import { AppNewsletter } from "./_components/home/AppNewsletter";
import { BrowseByType } from "./_components/home/BrowseByType";
import { CategoryChips } from "./_components/home/CategoryChips";
import { DealsBanner } from "./_components/home/DealsBanner";
import { FeaturedListings } from "./_components/home/FeaturedListings";
import { Hero } from "./_components/home/Hero";
import { HostCTA } from "./_components/home/HostCTA";
import { RecentReviews } from "./_components/home/RecentReviews";
import { SiteFooter } from "./_components/home/SiteFooter";
import { SiteHeader } from "./_components/home/SiteHeader";
import { TrendingDestinations } from "./_components/home/TrendingDestinations";
import { TrustPillars } from "./_components/home/TrustPillars";
import { UtilityBar } from "./_components/home/UtilityBar";
import { getHomeData } from "./_components/home/home-data";

export const metadata: Metadata = {
  title: "South Africa's direct booking directory",
  description:
    "From a cottage in the Karoo to a lodge in the Drakensberg — every booking goes straight to the host. No middle-man, no booking fees, no fine print.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <div className="bg-brand-light text-brand-ink">
      <UtilityBar />
      <SiteHeader />
      <Hero stats={data.stats} popularCities={data.popularCities} />
      <CategoryChips chips={data.chips} />
      <TrendingDestinations destinations={data.destinations} />
      <FeaturedListings listings={data.featured} totalStays={data.totalStays} />
      <TrustPillars />
      <BrowseByType types={data.browseTypes} />
      <DealsBanner />
      <RecentReviews reviews={data.reviews} />
      <AppNewsletter />
      <HostCTA />
      <SiteFooter />
    </div>
  );
}
