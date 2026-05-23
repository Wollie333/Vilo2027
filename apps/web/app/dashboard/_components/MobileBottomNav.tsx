"use client";

import {
  CalendarCheck,
  Home as HomeIcon,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: { text: string; tone: "count" | "alert" };
  match?: "exact" | "prefix";
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, match: "exact" },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  {
    href: "/dashboard/listings",
    label: "Listings",
    icon: HomeIcon,
    match: "prefix",
  },
  { href: "/dashboard/settings", label: "More", icon: MoreHorizontal },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-line bg-white lg:hidden"
    >
      <div className="grid grid-cols-5 gap-1 p-1.5">
        {ITEMS.map(({ href, label, icon: Icon, match = "exact" }) => {
          const isActive =
            match === "exact"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium ${
                isActive
                  ? "bg-brand-accent text-brand-secondary"
                  : "text-brand-mute"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
