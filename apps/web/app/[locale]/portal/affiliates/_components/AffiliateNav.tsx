"use client";

import {
  LayoutDashboard,
  Megaphone,
  Package,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";

const TABS: {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  countable?: boolean;
}[] = [
  {
    href: "/portal/affiliates",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/portal/affiliates/products",
    label: "Products",
    icon: Package,
    countable: true,
  },
  { href: "/portal/affiliates/marketing", label: "Marketing", icon: Megaphone },
  { href: "/portal/affiliates/payouts", label: "Payouts", icon: Wallet },
  {
    href: "/portal/affiliates/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
  },
];

export function AffiliateNav({ productCount = 0 }: { productCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="thin-scroll flex items-center gap-7 overflow-x-auto border-b border-brand-line">
      {TABS.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`group relative inline-flex h-11 items-center gap-2 whitespace-nowrap px-1 text-sm font-semibold transition-colors ${
              active
                ? "text-brand-secondary"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            <Icon className="h-[17px] w-[17px]" />
            {t.label}
            {t.countable && productCount > 0 ? (
              <span
                className={`num rounded-pill border px-1.5 py-px text-[11px] ${
                  active
                    ? "border-[#C7F0DC] bg-brand-accent text-brand-secondary"
                    : "border-brand-line bg-brand-light text-brand-mute"
                }`}
              >
                {productCount}
              </span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-pill bg-brand-primary" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
