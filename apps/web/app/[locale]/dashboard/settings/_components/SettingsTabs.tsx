"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  match: "exact" | "prefix";
};

const TABS: Tab[] = [
  { href: "/dashboard/settings", label: "Profile", match: "exact" },
  {
    href: "/dashboard/settings/banking",
    label: "Banking & business",
    match: "prefix",
  },
  {
    href: "/dashboard/settings/subscription",
    label: "Subscription",
    match: "prefix",
  },
  {
    href: "/dashboard/settings/notifications",
    label: "Notifications",
    match: "prefix",
  },
  {
    href: "/dashboard/settings/data",
    label: "Data & privacy",
    match: "prefix",
  },
];

export function SettingsTabs() {
  const pathname = usePathname();

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
                {tab.label}
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
