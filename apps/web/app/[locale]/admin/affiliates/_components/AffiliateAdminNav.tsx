"use client";

import {
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
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
}[] = [
  {
    href: "/admin/affiliates",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/affiliates/campaigns",
    label: "Campaigns",
    icon: Trophy,
  },
  {
    href: "/admin/affiliates/payouts",
    label: "Payouts",
    icon: Wallet,
  },
  {
    href: "/admin/affiliates/marketing",
    label: "Marketing",
    icon: Megaphone,
  },
  { href: "/admin/affiliates/terms", label: "Terms", icon: FileText },
  {
    href: "/admin/affiliates/settings",
    label: "Programme settings",
    icon: Settings,
  },
];

export function AffiliateAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="thin-scroll mt-1.5 flex items-center gap-7 overflow-x-auto border-b border-brand-line">
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
            className={`tabbtn ${active ? "on" : ""}`}
          >
            <Icon className="h-[17px] w-[17px]" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
