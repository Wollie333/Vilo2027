"use client";

import {
  Flag,
  LayoutDashboard,
  Link as LinkIcon,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";

// The affiliate manager's 4 top tabs (per the approved design). The SAME area
// mounts under the guest portal (/portal/affiliates) AND the host dashboard
// (/dashboard/affiliates), so hrefs build off the base it's rendered under.
// Marketing + the lifetime "top earners" board now live inside the pages /
// campaign detail rather than as top-level tabs.
const TAB_DEFS: {
  suffix: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  countable?: boolean;
}[] = [
  { suffix: "", label: "Overview", icon: LayoutDashboard, exact: true },
  { suffix: "/products", label: "Links & products", icon: LinkIcon },
  { suffix: "/competitions", label: "Campaigns", icon: Flag, countable: true },
  { suffix: "/payouts", label: "Payouts", icon: Wallet },
];

export function AffiliateNav({
  campaignCount = 0,
  basePath = "/portal/affiliates",
}: {
  campaignCount?: number;
  basePath?: string;
}) {
  const pathname = usePathname();
  const tabs = TAB_DEFS.map((t) => ({ ...t, href: `${basePath}${t.suffix}` }));

  return (
    <nav className="thin-scroll mt-1.5 flex items-center gap-7 overflow-x-auto border-b border-brand-line">
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
            className={`tabbtn ${active ? "on" : ""}`}
          >
            <Icon className="h-[17px] w-[17px]" />
            {t.label}
            {t.countable && campaignCount > 0 ? (
              <span className="pillcnt num">{campaignCount}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
