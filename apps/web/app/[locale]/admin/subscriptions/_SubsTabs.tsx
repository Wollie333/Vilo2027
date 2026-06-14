"use client";

import { usePathname } from "next/navigation";

import { Link } from "@/i18n/navigation";

const TABS = [
  { href: "/admin/subscriptions", label: "Hosts", exact: true },
  { href: "/admin/subscriptions/plans", label: "Plans", exact: false },
] as const;

// Tab strip across the admin subscription console. Active state derived from the
// pathname (stripping the /[locale] prefix the router adds).
export function SubsTabs() {
  const pathname = usePathname();
  const path = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");

  return (
    <nav className="flex items-center gap-1 border-b border-brand-line">
      {TABS.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-mute hover:text-brand-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
