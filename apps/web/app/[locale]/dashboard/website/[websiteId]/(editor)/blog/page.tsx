import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BlogManager } from "./BlogManager";
import { loadBlogEditor } from "./loadBlogEditor";

export const dynamic = "force-dynamic";

export default async function WebsiteBlogPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadBlogEditor(websiteId),
  ]);
  if (!data) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("blogHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("blogSub")}</p>
      </header>

      <BlogManager
        websiteId={websiteId}
        initialPosts={data.posts}
        initialCategories={data.categories}
        initialAuthors={data.authors}
      />
    </div>
  );
}
