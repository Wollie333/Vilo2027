import type { Metadata } from "next";

import { Comparison } from "./_components/Comparison";
import { DirectoryStrip } from "./_components/DirectoryStrip";
import { FAQ } from "./_components/FAQ";
import { Features } from "./_components/Features";
import { FinalCTA } from "./_components/FinalCTA";
import { Hero } from "./_components/Hero";
import { HowItWorks } from "./_components/HowItWorks";
import { PageFooter } from "./_components/PageFooter";
import { Pricing } from "./_components/Pricing";
import { ProductShowcase } from "./_components/ProductShowcase";
import { SiteHeader } from "./_components/SiteHeader";
import { Testimonials } from "./_components/Testimonials";
import { TrustMarquee } from "./_components/TrustMarquee";
import { ValueProp } from "./_components/ValueProp";

// Hero reads the live platform-wide commission-saved total from Supabase;
// without this the value would be frozen into the Data Cache at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Direct booking management for hosts",
  description:
    "Direct-booking management for accommodation hosts. Branded booking page, unified inbox, calendar that syncs — for one flat monthly fee.",
};

export default function BookingManagementPage() {
  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />
      <Hero />
      <TrustMarquee />
      <ValueProp />
      <Features />
      <HowItWorks />
      <ProductShowcase />
      <DirectoryStrip />
      <Pricing />
      <Testimonials />
      <Comparison />
      <FAQ />
      <FinalCTA />
      <PageFooter />
    </div>
  );
}
