import { Features } from "./_components/home/Features";
import { Hero } from "./_components/home/Hero";
import { HowItWorks } from "./_components/home/HowItWorks";
import { Pricing } from "./_components/home/Pricing";
import { SiteFooter } from "./_components/home/SiteFooter";
import { SiteHeader } from "./_components/home/SiteHeader";

export const metadata = {
  title: "Vilo — Direct-booking management for South African hosts",
  description:
    "Vilo is a direct-booking platform for South African accommodation hosts and the guests who travel with them. One subscription, zero booking fees.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-brand-light text-brand-ink">
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
      </main>
      <SiteFooter />
    </div>
  );
}
