"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/account/settings/notifications", label: "Notifications" },
  { href: "/account/settings/data", label: "Data & privacy" },
];

export function AccountSettingsTabs() {
  const pathname = usePathname();

  return (
    <nav>
      <ol role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
