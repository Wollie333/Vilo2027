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
    <nav className="border-b border-brand-line">
      <ul role="tablist" className="-mb-px flex gap-1 overflow-x-auto pb-px">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} role="presentation" className="shrink-0">
              <Link
                href={tab.href}
                role="tab"
                aria-current={isActive ? "page" : undefined}
                aria-selected={isActive}
                className={`relative flex items-center px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-brand-ink"
                    : "text-brand-mute hover:text-brand-ink"
                }`}
              >
                {tab.label}
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-t bg-brand-primary"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
