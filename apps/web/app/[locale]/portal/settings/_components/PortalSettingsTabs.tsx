"use client";

import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";
import { usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/portal/settings", label: "Profile", match: "exact" as const },
  {
    href: "/portal/settings/notifications",
    label: "Notifications",
    match: "prefix" as const,
  },
  {
    href: "/portal/settings/transactions",
    label: "Transactions",
    match: "prefix" as const,
  },
  {
    href: "/portal/settings/data",
    label: "Data & privacy",
    match: "prefix" as const,
  },
  {
    href: "/portal/settings/security",
    label: "Security",
    match: "prefix" as const,
  },
];

/**
 * Guest settings section nav. Uses the shared `RecordTabs` underline bar so it
 * matches every other tab strip on the platform (record pages, host settings,
 * admin settings) — it used to hand-roll solid pills, which was the odd one out.
 */
export function PortalSettingsTabs() {
  // next-intl's usePathname (not next/navigation's) returns the pathname WITHOUT
  // the locale prefix, so these locale-less hrefs match on /af/... too. The old
  // pill version compared against the raw pathname, so under localePrefix
  // "as-needed" no tab highlighted at all on any non-English locale.
  const path = usePathname();

  const activeHref =
    TABS.find((t) =>
      t.match === "exact"
        ? path === t.href
        : path === t.href || path.startsWith(`${t.href}/`),
    )?.href ?? TABS[0].href;

  return (
    <RecordTabs
      tabs={TABS.map((t) => ({ key: t.href, label: t.label, href: t.href }))}
      active={activeHref}
    />
  );
}
