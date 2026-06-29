import type { ReactNode } from "react";
import { ChevronsUpDown, ExternalLink } from "lucide-react";
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

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";
  const name = data.brand.name?.trim() || data.businessName || data.subdomain;
  const glyph = (name[0] || "·").toUpperCase();
  const statusTone =
    data.status === "published"
      ? "green"
      : data.status === "draft"
        ? "gray"
        : "amber";

  return (
    <div className="space-y-5">
      <div className="wielo-cms">
        <div className="flex flex-wrap items-center gap-3">
          {/* Site switcher → back to the portfolio of all sites */}
          <Link href="/dashboard/website" className="siteswitch">
            <span className="sg" style={{ background: "#064E3B" }}>
              {glyph}
            </span>
            <span style={{ textAlign: "left" }}>
              <span className="sn">{name}</span>
              <span className="sd">
                {data.subdomain}.{root}
              </span>
            </span>
            <ChevronsUpDown
              style={{ width: 15, height: 15, color: "#9DB4A8" }}
            />
          </Link>

          <span className={`tag ${statusTone}`}>
            <span className="d" />
            {t(BADGE_KEY[data.status])}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/site?site=${data.subdomain}&preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <ExternalLink
                style={{ width: 15, height: 15, color: "var(--mute)" }}
              />
              {t("previewCta")}
            </Link>
            <PublishBar
              websiteId={websiteId}
              status={data.status}
              isDirty={data.isDirty}
            />
          </div>
        </div>

        <div className="mt-2">
          <WebsiteTabs websiteId={websiteId} />
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}
