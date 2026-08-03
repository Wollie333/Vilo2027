import type { Metadata } from "next";

import {
  fetchHelpArticles,
  fetchHelpCategoriesWithCounts,
  fetchHelpFaqs,
  fetchHelpSettings,
  fetchHelpVideos,
} from "@/lib/help/queries";
import type { HelpAudience } from "@/lib/help/types";
import { getBrandName } from "@/lib/brand";

import { SiteFooter } from "@/app/_components/home/SiteFooter";
import { SiteHeader } from "@/app/_components/home/SiteHeader";
import { ContactSupport } from "../dashboard/help/_components/ContactSupport";
import { FAQAccordion } from "../dashboard/help/_components/FAQAccordion";
import { FeedbackStrip } from "../dashboard/help/_components/FeedbackStrip";
import { HelpHero } from "../dashboard/help/_components/HelpHero";
import { PopularArticles } from "../dashboard/help/_components/PopularArticles";
import { QuickActions } from "../dashboard/help/_components/QuickActions";
import { TopicsGrid } from "../dashboard/help/_components/TopicsGrid";
import { VideoTutorials } from "../dashboard/help/_components/VideoTutorials";

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: "Help & docs",
    description: `Articles, video tutorials, and FAQ for hosts and guests on ${brandName}. Direct-booking management for South African accommodation.`,
  };
}

export const dynamic = "force-dynamic";

const BASE_PATH = "/help";
const SEARCH_PATH = "/help/search";

type SearchParams = { as?: string };

function resolveAudience(value: string | undefined): HelpAudience {
  return value === "guest" ? "guest" : "host";
}

export default async function PublicHelpPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const audience = resolveAudience(searchParams?.as);

  const [categories, popular, newest, updated, videos, faqs, settings] =
    await Promise.all([
      fetchHelpCategoriesWithCounts(audience),
      fetchHelpArticles({ audience, sort: "popular", limit: 6 }),
      fetchHelpArticles({ audience, sort: "newest", limit: 6 }),
      fetchHelpArticles({ audience, sort: "updated", limit: 6 }),
      fetchHelpVideos(audience, 4),
      fetchHelpFaqs(audience, true, 6),
      fetchHelpSettings(),
    ]);

  const categoryLabel = Object.fromEntries(
    categories.map((c) => [c.id, c.name]),
  );

  return (
    <div className="bg-brand-light text-brand-ink">
      <SiteHeader />

      <main className="mx-auto max-w-[1400px] space-y-6 px-5 py-8 lg:space-y-8 lg:px-8 lg:py-10">
        <HelpHero
          greeting={null}
          audience={audience}
          trending={settings.trending}
          basePath={BASE_PATH}
          searchPath={SEARCH_PATH}
        />

        <QuickActions
          basePath={BASE_PATH}
          supportEmail={settings.contact.support_email}
        />

        {/* Only categories with published articles — reflects real activity. */}
        <TopicsGrid
          categories={categories.filter((c) => c.article_count > 0)}
          basePath={BASE_PATH}
        />

        <PopularArticles
          basePath={BASE_PATH}
          popular={popular}
          newest={newest}
          updated={updated}
          categoryLabel={categoryLabel}
        />

        <VideoTutorials
          videos={videos}
          basePath={BASE_PATH}
          categoryLabel={categoryLabel}
        />

        <FAQAccordion faqs={faqs} basePath={BASE_PATH} />

        <ContactSupport supportEmail={settings.contact.support_email} />

        <FeedbackStrip supportEmail={settings.contact.support_email} />
      </main>

      <SiteFooter />
    </div>
  );
}
