"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

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

export function PortalSettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Settings sections">
      {TABS.map((tab) => {
        const isActive =
          tab.match === "exact"
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition ${
              isActive
                ? "border-brand-primary bg-brand-primary text-white"
                : "border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
