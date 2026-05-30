"use client";

import Link from "next/link";
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
    <nav>
      <ol role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive =
            tab.match === "exact"
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <li key={tab.href} role="presentation">
              <Link
                href={tab.href}
                role="tab"
                aria-current={isActive ? "page" : undefined}
                aria-selected={isActive}
                className={`flex items-center gap-2 rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  isActive
                    ? "border-brand-primary bg-white/10 text-white"
                    : "border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
