import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  fetchGettingStartedState,
  fetchHelpArticles,
  fetchHelpCategoriesWithCounts,
  fetchHelpFaqs,
  fetchHelpSettings,
  fetchHelpVideos,
  fetchSavedArticles,
} from "@/lib/help/queries";
import type { HelpAudience } from "@/lib/help/types";
import { createServerClient } from "@/lib/supabase/server";

import { ContactSupport } from "./_components/ContactSupport";
import { FAQAccordion } from "./_components/FAQAccordion";
import { FeedbackStrip } from "./_components/FeedbackStrip";
import { GettingStarted } from "./_components/GettingStarted";
import { HelpHero } from "./_components/HelpHero";
import { PopularArticles } from "./_components/PopularArticles";
import { QuickActions } from "./_components/QuickActions";
import { SavedArticles } from "./_components/SavedArticles";
import { TopicsGrid } from "./_components/TopicsGrid";
import { VideoTutorials } from "./_components/VideoTutorials";
import { TourButton } from "../_components/tour/TourButton";

export const metadata: Metadata = {
  title: "Help & docs",
};

export const dynamic = "force-dynamic";

const BASE_PATH = "/dashboard/help";
const SEARCH_PATH = "/dashboard/help/search";

type SearchParams = { as?: string };

function resolveAudience(value: string | undefined): HelpAudience {
  return value === "guest" ? "guest" : "host";
}

export default async function HelpPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${BASE_PATH}`);

  const audience = resolveAudience(searchParams?.as);

  const [
    categories,
    popular,
    newest,
    updated,
    videos,
    faqs,
    settings,
    gettingStarted,
    profile,
    savedArticles,
  ] = await Promise.all([
    fetchHelpCategoriesWithCounts(audience),
    fetchHelpArticles({ audience, sort: "popular", limit: 6 }),
    fetchHelpArticles({ audience, sort: "newest", limit: 6 }),
    fetchHelpArticles({ audience, sort: "updated", limit: 6 }),
    fetchHelpVideos(audience, 4),
    fetchHelpFaqs(audience, true, 6),
    fetchHelpSettings(),
    fetchGettingStartedState(user.id),
    supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then((r) => r.data as { full_name?: string | null } | null),
    fetchSavedArticles(user.id),
  ]);

  const greeting =
    (profile?.full_name ?? "").split(" ")[0]?.trim() ||
    user.email?.split("@")[0] ||
    "host";

  const categoryLabel = Object.fromEntries(
    categories.map((c) => [c.id, c.name]),
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <HelpHero
        greeting={greeting}
        audience={audience}
        trending={settings.trending}
        basePath={BASE_PATH}
        searchPath={SEARCH_PATH}
      />

      <QuickActions
        basePath={BASE_PATH}
        supportEmail={settings.contact.support_email}
      />

      {audience === "host" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div>
            <div className="font-display text-[15px] font-bold text-brand-ink">
              New here?
            </div>
            <p className="mt-0.5 text-[13px] text-brand-mute">
              Take the 2-minute guided tour of your dashboard.
            </p>
          </div>
          <TourButton />
        </div>
      ) : null}

      {/* Only show categories that actually have published articles, so the
          page reflects real activity (feature categories light up as their
          articles land — see RULES.md §9). */}
      <TopicsGrid
        categories={categories.filter((c) => c.article_count > 0)}
        basePath={BASE_PATH}
      />

      <SavedArticles
        basePath={BASE_PATH}
        articles={savedArticles}
        categoryLabel={categoryLabel}
      />

      {audience === "host" ? (
        <section className="grid gap-3 lg:grid-cols-3 lg:gap-4">
          <div className="lg:col-span-2">
            <PopularArticles
              basePath={BASE_PATH}
              popular={popular}
              newest={newest}
              updated={updated}
              categoryLabel={categoryLabel}
            />
          </div>
          <GettingStarted state={gettingStarted} />
        </section>
      ) : (
        <PopularArticles
          basePath={BASE_PATH}
          popular={popular}
          newest={newest}
          updated={updated}
          categoryLabel={categoryLabel}
        />
      )}

      <VideoTutorials
        videos={videos}
        basePath={BASE_PATH}
        categoryLabel={categoryLabel}
      />

      <FAQAccordion faqs={faqs} basePath={BASE_PATH} />

      <ContactSupport supportEmail={settings.contact.support_email} />

      <FeedbackStrip supportEmail={settings.contact.support_email} />

      <div className="h-4" />
    </div>
  );
}
