"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  labelKey: string;
  match: "exact" | "prefix";
};

const TABS: Tab[] = [
  { href: "/dashboard/settings", labelKey: "tabProfile", match: "exact" },
  {
    href: "/dashboard/settings/businesses",
    labelKey: "tabBusinesses",
    match: "prefix",
  },
  {
    href: "/dashboard/settings/banking",
    labelKey: "tabCardPayments",
    match: "prefix",
  },
  {
    href: "/dashboard/settings/subscription",
    labelKey: "tabSubscription",
    match: "prefix",
  },
  {
    href: "/dashboard/settings/transactions",
    labelKey: "tabTransactions",
    match: "prefix",
  },
  {
    href: "/dashboard/settings/notifications",
    labelKey: "tabNotifications",
    match: "prefix",
  },
  {
    href: "/dashboard/settings/data",
    labelKey: "tabData",
    match: "prefix",
  },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const t = useTranslations("settings");

  return (
    <nav className="border-b border-brand-line">
      <ol
        role="tablist"
        className="-mb-px flex items-stretch gap-7 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {TABS.map((tab) => {
          const isActive =
            tab.match === "exact"
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <li key={tab.href} role="presentation" className="shrink-0">
              <Link
                href={tab.href}
                role="tab"
                aria-current={isActive ? "page" : undefined}
                aria-selected={isActive}
                className={`relative block whitespace-nowrap py-3 text-[14px] font-semibold transition ${
                  isActive
                    ? "text-brand-secondary"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {t(tab.labelKey)}
                {isActive ? (
                  <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
