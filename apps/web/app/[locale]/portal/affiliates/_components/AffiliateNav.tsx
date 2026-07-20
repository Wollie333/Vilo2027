"use client";

import {
  Flag,
  LayoutDashboard,
  Megaphone,
  Package,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";

// Tabs relative to the affiliate base — the SAME affiliate area mounts under the
// guest portal (/portal/affiliates) AND the host dashboard (/dashboard/affiliates),
// so the nav builds its hrefs from the base it's rendered under.
const TAB_DEFS: {
  suffix: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  countable?: boolean;
}[] = [
  { suffix: "", label: "Overview", icon: LayoutDashboard, exact: true },
  { suffix: "/products", label: "Products", icon: Package, countable: true },
  { suffix: "/marketing", label: "Marketing", icon: Megaphone },
  { suffix: "/payouts", label: "Payouts", icon: Wallet },
  { suffix: "/competitions", label: "Competitions", icon: Flag },
  { suffix: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export function AffiliateNav({
  productCount = 0,
  basePath = "/portal/affiliates",
}: {
  productCount?: number;
  basePath?: string;
}) {
  const pathname = usePathname();
  const tabs = TAB_DEFS.map((t) => ({ ...t, href: `${basePath}${t.suffix}` }));

  return (
    <nav className="thin-scroll flex items-center gap-7 overflow-x-auto border-b border-brand-line">
      {tabs.map((t) => {
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
