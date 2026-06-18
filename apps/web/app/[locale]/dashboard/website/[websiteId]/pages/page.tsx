import { ChevronRight, FileText, Layers } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DuplicatePageButton } from "./DuplicatePageButton";
import { loadPagesList } from "./loadPagesList";

export const dynamic = "force-dynamic";

export default async function WebsitePagesList({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, pages] = await Promise.all([
    getTranslations("website"),
    loadPagesList(websiteId),
  ]);
  if (!pages) notFound();

  function pageTitle(kind: string, title: string | null, slug: string) {
    if (kind === "home") return t("pageHome");
    if (kind === "about") return t("pageAbout");
    return title || slug;
  }

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h2 className="font-display text-lg font-bold text-brand-ink">
          {t("pagesHeading")}
        </h2>
        <p className="mt-1 text-sm text-brand-mute">{t("pagesSub")}</p>
      </header>

      <ul className="space-y-2.5">
        {pages.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Link
              href={`/dashboard/website/${websiteId}/pages/${p.id}`}
              className="flex flex-1 items-center gap-3 rounded-card border border-brand-line bg-white p-4 transition hover:border-brand-mute hover:shadow-card"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-light text-brand-secondary">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-brand-ink">
                    {pageTitle(p.kind, p.title, p.slug)}
                  </span>
                  {p.publishedCount === 0 ? (
                    <span className="rounded-pill bg-brand-light px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-mute">
                      {t("notPublishedYet")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-brand-mute">
                  <Layers className="h-3.5 w-3.5" />
                  {t("sectionCount", { count: p.draftCount })}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-brand-mute" />
            </Link>
            <DuplicatePageButton websiteId={websiteId} pageId={p.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
