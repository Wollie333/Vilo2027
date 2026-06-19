"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

// Editor tab bar. All tabs are now live (W6–W14).
const LIVE_TABS: Array<{ key: string; seg: string }> = [
  { key: "tabOverview", seg: "" },
  { key: "tabThemes", seg: "theme" },
  { key: "tabBrand", seg: "brand" },
  { key: "tabPages", seg: "pages" },
  { key: "tabRooms", seg: "rooms" },
  { key: "tabBlog", seg: "blog" },
  { key: "tabDomain", seg: "domain" },
  { key: "tabSeo", seg: "seo" },
  { key: "tabSettings", seg: "settings" },
];

const SOON_TABS: string[] = [];

export function WebsiteTabs({ websiteId }: { websiteId: string }) {
  const t = useTranslations("website");
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);
  const base = `/dashboard/website/${websiteId}`;

  const isActive = (seg: string) =>
    seg
      ? pathname.includes(`/${seg}`)
      : pathname === base || pathname.endsWith(`/website/${websiteId}`);

  function handleClick(e: React.MouseEvent, seg: string) {
    e.preventDefault();
    const href = seg ? `${base}/${seg}` : base;
    if (isActive(seg)) return; // Already on this tab
    setLoadingTab(seg);
    startTransition(() => {
      router.push(href);
    });
  }

  // Clear loading state when pathname changes
  if (loadingTab && isActive(loadingTab)) {
    setLoadingTab(null);
  }

  return (
    <nav className="border-b border-brand-line">
      <ol
        className="-mb-px flex items-stretch gap-6 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {LIVE_TABS.map((tab) => {
          const active = isActive(tab.seg);
          const loading = loadingTab === tab.seg && isPending;
          return (
            <li key={tab.key} className="shrink-0">
              <a
                href={tab.seg ? `${base}/${tab.seg}` : base}
                onClick={(e) => handleClick(e, tab.seg)}
                aria-current={active ? "page" : undefined}
                className={`group relative block whitespace-nowrap py-3 text-[14px] font-semibold transition-colors ${
                  active
                    ? "text-brand-secondary"
                    : "text-brand-mute hover:text-brand-ink"
                } ${loading ? "pointer-events-none" : ""}`}
              >
                <span className="flex items-center gap-1.5">
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {t(tab.key)}
                </span>
                {/* Active indicator */}
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
                ) : (
                  /* Hover indicator */
                  <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-line opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </a>
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
