"use client";

import { useEffect, useState } from "react";

import {
  BadgePercent,
  Bell,
  Compass,
  FileText,
  LayoutDashboard,
  Luggage,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
};

type Group = { label?: string; items: Item[] };

// The four primary tabs on the bar; everything else is one tap away under "More"
// — mirrors the host MobileBottomNav so the guest portal navigates the same way.
const PRIMARY: Item[] = [
  { href: "/portal", label: "Home", icon: LayoutDashboard, match: "exact" },
  { href: "/portal/trips", label: "Trips", icon: Luggage, match: "prefix" },
  {
    href: "/portal/inbox",
    label: "Inbox",
    icon: MessageSquare,
    match: "prefix",
  },
  { href: "/portal/browse", label: "Browse", icon: Compass, match: "prefix" },
];

// The "More" sheet — every portal page, grouped like the sidebar, so a guest can
// reach ANY page from a phone.
const GROUPS: Group[] = [
  {
    items: [
      {
        href: "/portal",
        label: "Overview",
        icon: LayoutDashboard,
        match: "exact",
      },
      {
        href: "/portal/inbox",
        label: "Inbox",
        icon: MessageSquare,
        match: "prefix",
      },
      {
        href: "/portal/trips",
        label: "My trips",
        icon: Luggage,
        match: "prefix",
      },
      {
        href: "/portal/quotes",
        label: "Quotes",
        icon: FileText,
        match: "prefix",
      },
      {
        href: "/portal/reviews",
        label: "Reviews",
        icon: Star,
        match: "prefix",
      },
      {
        href: "/portal/affiliates",
        label: "Affiliates",
        icon: BadgePercent,
        match: "prefix",
      },
      {
        href: "/portal/notifications",
        label: "Notifications",
        icon: Bell,
        match: "prefix",
      },
    ],
  },
  {
    label: "Discover",
    items: [{ href: "/portal/browse", label: "Browse stays", icon: Compass }],
  },
  {
    label: "Account",
    items: [
      {
        href: "/portal/settings",
        label: "Settings",
        icon: Settings,
        match: "prefix",
      },
    ],
  },
];

function isActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix" = "exact",
): boolean {
  return match === "exact"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalMobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // "More" reads as active whenever the current page isn't one of the primary
  // tabs — so the guest always sees where they are.
  const onPrimary = PRIMARY.some((p) => isActive(pathname, p.href, p.match));

  // Close the sheet on navigation.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Escape closes the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* "More" — the full page directory, so a guest can reach ANY page on a phone */}
      <div
        onClick={() => setMoreOpen(false)}
        className={`fixed inset-0 z-40 bg-brand-dark/30 transition-opacity lg:hidden ${
          moreOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-label="All pages"
        aria-hidden={!moreOpen}
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-[20px] bg-white shadow-lift transition-transform duration-300 lg:hidden ${
          moreOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-line bg-white px-5 py-3.5">
          <div className="text-[13px] font-bold text-brand-ink">All pages</div>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-pill text-brand-mute hover:bg-brand-light hover:text-brand-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-3 py-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          {GROUPS.map((g, gi) => (
            <div key={gi} className="mb-3 last:mb-0">
              {g.label ? (
                <div className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-mute">
                  {g.label}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-1.5">
                {g.items.map((it) => {
                  const active = isActive(pathname, it.href, it.match);
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-2.5 rounded-[11px] border px-3 py-2.5 text-[13px] font-semibold ${
                        active
                          ? "border-brand-primary/40 bg-brand-accent text-brand-secondary"
                          : "border-brand-line bg-white text-brand-ink"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-brand-secondary" />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* bottom bar */}
      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-line bg-white lg:hidden"
      >
        <div className="grid grid-cols-5 gap-1 p-1.5 pb-[max(6px,env(safe-area-inset-bottom))]">
          {PRIMARY.map(({ href, label, icon: Icon, match = "exact" }) => {
            const active = isActive(pathname, href, match);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium ${
                  active
                    ? "bg-brand-accent text-brand-secondary"
                    : "text-brand-mute"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="More pages"
            className={`flex flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium ${
              !onPrimary || moreOpen
                ? "bg-brand-accent text-brand-secondary"
                : "text-brand-mute"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
