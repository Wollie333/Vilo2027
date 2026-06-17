"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

// Editor tab bar. Overview/Brand/Theme are live (W6/W7); the rest are shown as
// disabled "coming soon" tabs so the shell reads as the full builder it will
// become (Pages → W8, Rooms → W9, Blog → W12, Domain → W13, SEO → W14).
const LIVE_TABS: Array<{ key: string; seg: string }> = [
  { key: "tabOverview", seg: "" },
  { key: "tabBrand", seg: "brand" },
  { key: "tabTheme", seg: "theme" },
];

const SOON_TABS = ["tabPages", "tabRooms", "tabBlog", "tabDomain", "tabSeo"];

export function WebsiteTabs({ websiteId }: { websiteId: string }) {
  const t = useTranslations("website");
  const pathname = usePathname();
  const base = `/dashboard/website/${websiteId}`;

  const isActive = (seg: string) =>
    seg
      ? pathname.endsWith(`/${seg}`)
      : pathname === base || pathname.endsWith(`/website/${websiteId}`);

  return (
    <nav className="border-b border-brand-line">
      <ol
        className="-mb-px flex items-stretch gap-6 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {LIVE_TABS.map((tab) => {
          const active = isActive(tab.seg);
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.seg ? `${base}/${tab.seg}` : base}
                aria-current={active ? "page" : undefined}
                className={`relative block whitespace-nowrap py-3 text-[14px] font-semibold transition ${
                  active
                    ? "text-brand-secondary"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {t(tab.key)}
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
                ) : null}
              </Link>
            </li>
          );
        })}
        {SOON_TABS.map((key) => (
          <li key={key} className="shrink-0">
            <span
              title={t("comingSoon")}
              className="block cursor-not-allowed whitespace-nowrap py-3 text-[14px] font-semibold text-brand-mute/40"
            >
              {t(key)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
