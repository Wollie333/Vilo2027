"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

// Editor tab bar — the canonical 8 tabs from the approved mockups, in order.
// Theme + Brand are NOT tabs: they're reached from Settings → Branding (Brand
// Studio + Theme links) and the Overview set-up checklist. Their routes still
// exist; they're just not top-level tabs.
const LIVE_TABS: Array<{ key: string; seg: string }> = [
  { key: "tabOverview", seg: "" },
  { key: "tabPages", seg: "pages" },
  { key: "tabMedia", seg: "media" },
  { key: "tabBlog", seg: "blog" },
  { key: "tabNavigation", seg: "navigation" },
  { key: "tabForms", seg: "forms" },
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
    <nav
      className="wielo-cms thin-scroll -mb-px overflow-x-auto border-b"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="flex min-w-max items-center">
        {LIVE_TABS.map((tab) => {
          const active = isActive(tab.seg);
          const loading = loadingTab === tab.seg && isPending;
          return (
            <a
              key={tab.key}
              href={tab.seg ? `${base}/${tab.seg}` : base}
              onClick={(e) => handleClick(e, tab.seg)}
              aria-current={active ? "page" : undefined}
              className={`ctab ${active ? "active" : ""} ${
                loading ? "pointer-events-none" : ""
              }`}
            >
              {loading ? (
                <Loader2
                  className="animate-spin"
                  style={{ width: 14, height: 14 }}
                />
              ) : null}
              {t(tab.key)}
            </a>
          );
        })}
        {SOON_TABS.map((key) => (
          <span
            key={key}
            title={t("comingSoon")}
            className="ctab"
            style={{ opacity: 0.4, cursor: "not-allowed" }}
          >
            {t(key)}
          </span>
        ))}
      </div>
    </nav>
  );
}
