"use client";

import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/portal/affiliates", label: "Overview", exact: true },
  { href: "/portal/affiliates/products", label: "Products" },
  { href: "/portal/affiliates/marketing", label: "Marketing" },
  { href: "/portal/affiliates/payouts", label: "Payouts" },
];

export function AffiliateNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-brand-line">
      {TABS.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand-primary text-brand-ink"
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
