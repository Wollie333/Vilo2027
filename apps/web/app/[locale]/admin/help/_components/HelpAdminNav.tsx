"use client";

import {
  BookOpen,
  FolderTree,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  PlayCircle,
  Settings,
  Activity,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

type Tab = {
  href: string;
  label: string;
  icon: typeof BookOpen;
  /** true → active only on an exact path match (the overview root). */
  exact?: boolean;
  /** shown greyed with a "hidden" hint — managed but not currently public. */
  dormant?: boolean;
};

const TABS: Tab[] = [
  {
    href: "/admin/help",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: "/admin/help/articles", label: "Articles", icon: BookOpen },
  { href: "/admin/help/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/help/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/admin/help/videos", label: "Videos", icon: PlayCircle },
  { href: "/admin/help/suggestions", label: "Suggestions", icon: Inbox },
  {
    href: "/admin/help/status",
    label: "Status",
    icon: Activity,
    dormant: true,
  },
  { href: "/admin/help/settings", label: "Settings", icon: Settings },
];

export function HelpAdminNav() {
  const pathname = usePathname();

  function isActive(tab: Tab): boolean {
    if (tab.exact) return pathname === tab.href;
    return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
  }

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-brand-line pb-px">
      {TABS.map((tab) => {
        const active = isActive(tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            title={
              tab.dormant ? "Not currently shown on public help" : undefined
            }
            className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-mute hover:text-brand-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className={tab.dormant && !active ? "opacity-60" : ""}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
