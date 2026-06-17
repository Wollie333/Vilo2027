"use client";

import {
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
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
            className={`relative inline-flex h-11 items-center gap-2 whitespace-nowrap px-1 text-sm font-semibold transition-colors ${
              active
                ? "text-brand-secondary"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            <Icon className="h-[17px] w-[17px]" />
            {t.label}
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-pill bg-brand-primary" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
