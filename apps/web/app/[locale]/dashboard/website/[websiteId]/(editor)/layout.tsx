import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { loadWebsiteEditorData } from "../loadWebsiteEditorData";
import { PublishBar } from "../_components/PublishBar";
import { WebsiteTabs } from "../_components/WebsiteTabs";

export const dynamic = "force-dynamic";

const BADGE_KEY = {
  draft: "draftBadge",
  published: "publishedBadge",
  unpublished: "unpublishedBadge",
} as const;

/**
 * Editor layout with header, status, and tabs.
 * This wraps all tabbed website editor pages (overview, theme, pages, etc.)
 * but NOT Brand Studio, which sits outside this route group.
 */
export default async function EditorTabsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const [t, data] = await Promise.all([
    getTranslations("website"),
    loadWebsiteEditorData(websiteId),
  ]);
  if (!data) notFound();

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "vilo.site";
  const name = data.brand.name?.trim() || data.businessName || data.subdomain;

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/website"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute hover:text-brand-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("backToSites")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
              {name}
            </h1>
            <span className="rounded-pill bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
              {t(BADGE_KEY[data.status])}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-[12.5px] text-brand-mute">
            {data.subdomain}.{root}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/site?site=${data.subdomain}&preview=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
          >
            <ExternalLink className="h-4 w-4" />
            {t("previewCta")}
          </Link>
          <PublishBar
            websiteId={websiteId}
            status={data.status}
            isDirty={data.isDirty}
          />
        </div>
      </header>

      <WebsiteTabs websiteId={websiteId} />

      <div>{children}</div>
    </div>
  );
}
