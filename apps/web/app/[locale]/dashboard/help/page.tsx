import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  fetchGettingStartedState,
  fetchHelpArticles,
  fetchHelpCategoriesWithCounts,
  fetchHelpFaqs,
  fetchHelpSettings,
  fetchHelpStatus,
  fetchHelpVideos,
} from "@/lib/help/queries";
import type { HelpAudience, HelpStatusComponentStatus } from "@/lib/help/types";
import { createServerClient } from "@/lib/supabase/server";

import { CommunityCard } from "./_components/CommunityCard";
import { ContactSupport } from "./_components/ContactSupport";
import { FAQAccordion } from "./_components/FAQAccordion";
import { FeedbackStrip } from "./_components/FeedbackStrip";
import { GettingStarted } from "./_components/GettingStarted";
import { HelpHero } from "./_components/HelpHero";
import { PopularArticles } from "./_components/PopularArticles";
import { QuickActions } from "./_components/QuickActions";
import { SystemStatusPanel } from "./_components/SystemStatusPanel";
import { TopicsGrid } from "./_components/TopicsGrid";
import { VideoTutorials } from "./_components/VideoTutorials";

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

function deriveOverallStatus(
  components: { status: HelpStatusComponentStatus }[],
): HelpStatusComponentStatus {
  if (components.some((c) => c.status === "incident")) return "incident";
  if (components.some((c) => c.status === "degraded")) return "degraded";
  if (components.some((c) => c.status === "maintenance")) return "maintenance";
  return "normal";
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
    statusComponents,
    settings,
    gettingStarted,
    profile,
  ] = await Promise.all([
    fetchHelpCategoriesWithCounts(audience),
    fetchHelpArticles({ audience, sort: "popular", limit: 6 }),
    fetchHelpArticles({ audience, sort: "newest", limit: 6 }),
    fetchHelpArticles({ audience, sort: "updated", limit: 6 }),
    fetchHelpVideos(audience, 4),
    fetchHelpFaqs(audience, true, 6),
    fetchHelpStatus(),
    fetchHelpSettings(),
    fetchGettingStartedState(user.id),
    supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then((r) => r.data as { full_name?: string | null } | null),
  ]);

  const overall = deriveOverallStatus(statusComponents);
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

      <QuickActions contact={settings.contact} overallStatus={overall} />

      {/* Only show categories that actually have published articles, so the
          page reflects real activity (feature categories light up as their
          articles land — see RULES.md §9). */}
      <TopicsGrid
        categories={categories.filter((c) => c.article_count > 0)}
        basePath={BASE_PATH}
      />

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
        {audience === "host" ? (
          <GettingStarted state={gettingStarted} />
        ) : (
          <CommunityCard threads={settings.community} />
        )}
      </section>

      <VideoTutorials
        videos={videos}
        basePath={BASE_PATH}
        categoryLabel={categoryLabel}
      />

      <section className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        <div className="lg:col-span-2">
          <FAQAccordion faqs={faqs} basePath={BASE_PATH} />
        </div>
        <SystemStatusPanel components={statusComponents} overall={overall} />
      </section>

      <section className="grid gap-3 lg:grid-cols-5 lg:gap-4">
        <div className="lg:col-span-3">
          <ContactSupport contact={settings.contact} />
        </div>
        <div className="lg:col-span-2">
          <CommunityCard threads={settings.community} />
        </div>
      </section>

      <FeedbackStrip supportEmail={settings.contact.support_email} />

      <div className="h-4" />
    </div>
  );
}
