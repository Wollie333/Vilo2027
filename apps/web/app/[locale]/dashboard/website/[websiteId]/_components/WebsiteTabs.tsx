"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

// Editor tab bar. Only Overview is built in W6; the rest are shown as disabled
// "coming soon" tabs so the shell reads as the full builder it will become
// (Brand → W7, Pages → W8, Rooms → W9, Blog → W12, Domain → W13, SEO → W14).
export function WebsiteTabs({ websiteId }: { websiteId: string }) {
  const t = useTranslations("website");
  const pathname = usePathname();
  const base = `/dashboard/website/${websiteId}`;
  const overviewActive =
    pathname === base || pathname.endsWith(`/website/${websiteId}`);

  const soon: Array<{ key: string }> = [
    { key: "tabBrand" },
    { key: "tabTheme" },
    { key: "tabPages" },
    { key: "tabRooms" },
    { key: "tabBlog" },
    { key: "tabDomain" },
    { key: "tabSeo" },
  ];

  return (
    <nav className="border-b border-brand-line">
      <ol
        className="-mb-px flex items-stretch gap-6 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        <li className="shrink-0">
          <Link
            href={base}
            aria-current={overviewActive ? "page" : undefined}
            className={`relative block whitespace-nowrap py-3 text-[14px] font-semibold transition ${
              overviewActive
                ? "text-brand-secondary"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            {t("tabOverview")}
            {overviewActive ? (
              <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
            ) : null}
          </Link>
        </li>
        {soon.map((tab) => (
          <li key={tab.key} className="shrink-0">
            <span
              title={t("comingSoon")}
              className="block cursor-not-allowed whitespace-nowrap py-3 text-[14px] font-semibold text-brand-mute/40"
            >
              {t(tab.key)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
