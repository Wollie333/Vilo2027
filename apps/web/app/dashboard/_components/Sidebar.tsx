"use client";

import {
  BarChart3,
  BedDouble,
  Cable,
  CalendarCheck,
  Calendar as CalendarIcon,
  CalendarRange,
  CreditCard,
  Crown,
  FileText,
  Home as HomeIcon,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  PackagePlus,
  Receipt,
  RotateCcw,
  RotateCw,
  Search,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuickNav } from "./QuickNavPalette";
import { VLogo } from "./VLogo";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: { text: string; tone: "count" | "pro" | "alert" };
  match?: "exact" | "prefix";
};

const MAIN: Item[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    match: "exact",
  },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon },
  {
    href: "/dashboard/listings",
    label: "Listings",
    icon: HomeIcon,
    match: "prefix",
  },
  { href: "/dashboard/rooms", label: "Rooms", icon: BedDouble },
  {
    href: "/dashboard/seasonal-pricing",
    label: "Seasonal pricing",
    icon: CalendarRange,
  },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
];

const CONNECT: Item[] = [
  {
    href: "/dashboard/channels",
    label: "Channels",
    icon: Cable,
    badge: { text: "PRO", tone: "pro" },
  },
  { href: "/dashboard/calendar-sync", label: "Calendar sync", icon: RotateCw },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
];

const TOOLS: Item[] = [
  {
    href: "/dashboard/quotes",
    label: "Quotes",
    icon: FileText,
    match: "prefix",
  },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  {
    href: "/dashboard/addons",
    label: "Add-ons",
    icon: PackagePlus,
    badge: { text: "PRO", tone: "pro" },
  },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/refunds", label: "Refunds", icon: RotateCcw },
];

const FOOTER_LINKS: Item[] = [
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    match: "prefix",
  },
  { href: "/dashboard/help", label: "Help & docs", icon: LifeBuoy },
];

function useIsActive(href: string, match: "exact" | "prefix" = "exact") {
  const pathname = usePathname();
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item }: { item: Item }) {
  const isActive = useIsActive(item.href, item.match);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13.5px] font-medium transition-colors ${
        isActive
          ? "bg-brand-accent font-semibold text-brand-secondary"
          : "text-brand-mute hover:bg-brand-accent/60 hover:text-brand-ink"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          className={`num rounded-pill px-1.5 py-0.5 text-[10px] font-bold ${
            item.badge.tone === "alert"
              ? "bg-status-cancelled text-white"
              : item.badge.tone === "pro"
                ? "bg-brand-accent text-brand-secondary"
                : "bg-brand-secondary text-white"
          }`}
        >
          {item.badge.text}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  host,
  plan,
}: {
  host: { display_name: string; handle: string; listingCount: number } | null;
  plan: string | null;
}) {
  const planLabel =
    plan === "free"
      ? "Free"
      : plan
        ? plan[0].toUpperCase() + plan.slice(1)
        : "—";

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-brand-line bg-white lg:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <VLogo size={36} gradientId="sb-logo" />
        <div className="leading-none">
          <div className="font-display text-[15px] font-bold tracking-tight text-brand-ink">
            Vilo
          </div>
          <div className="mt-1 text-[10px] text-brand-mute">Host dashboard</div>
        </div>
      </div>

      {/* Host profile card — links to the public-profile editor */}
      <div className="mb-2 px-3">
        {host ? (
          <Link
            href="/dashboard/settings/host"
            className="flex w-full items-center gap-2.5 rounded-md border border-brand-line px-3 py-2 text-left transition-colors hover:bg-brand-light"
            title="Edit your public host profile"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded bg-brand-secondary font-display text-[10px] font-bold text-white">
              {host.display_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-brand-ink">
                {host.display_name}
              </div>
              <div className="text-[10px] text-brand-mute">
                {host.listingCount}{" "}
                {host.listingCount === 1 ? "listing" : "listings"} · {planLabel}
              </div>
            </div>
          </Link>
        ) : (
          <Link
            href="/signup/host"
            className="flex w-full items-center gap-2.5 rounded-md border border-dashed border-brand-primary/40 bg-brand-accent/40 px-3 py-2 text-left transition-colors hover:bg-brand-accent"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded bg-white text-brand-primary">
              <Settings className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-brand-ink">
                Set up host profile
              </div>
              <div className="text-[10px] text-brand-mute">5 quick steps</div>
            </div>
          </Link>
        )}
      </div>

      {/* Quick search */}
      <QuickSearchButton />

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
        {MAIN.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <SectionLabel>Connect</SectionLabel>
        {CONNECT.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <SectionLabel>Tools</SectionLabel>
        {TOOLS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Footer links */}
      <div className="space-y-0.5 border-t border-brand-line px-3 pb-3 pt-3">
        {FOOTER_LINKS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>

      {/* Plan card */}
      {host ? (
        <div className="px-3 pb-4">
          <div className="relative overflow-hidden rounded-card bg-brand-dark p-3 text-white">
            <div
              aria-hidden
              className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-brand-primary/30 blur-2xl"
            />
            <div className="relative">
              <div className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-brand-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-primary">
                  {planLabel} plan
                </span>
              </div>
              <div className="mt-2 text-sm font-semibold">
                {plan === "free"
                  ? "Start direct bookings"
                  : "All your listings"}
              </div>
              <div className="num mt-0.5 text-[11px] text-brand-accent/70">
                {plan === "free"
                  ? "Upgrade for instant booking + iCal sync"
                  : "Manage your subscription"}
              </div>
              <Link
                href="/dashboard/settings/subscription"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-white underline decoration-brand-primary decoration-2 underline-offset-4"
              >
                {plan === "free" ? "See plans" : "Manage subscription"} →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
      {children}
    </div>
  );
}

function QuickSearchButton() {
  const { setOpen } = useQuickNav();
  return (
    <div className="mb-3 px-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded border border-brand-line px-3 py-1.5 text-xs text-brand-mute transition-colors hover:bg-brand-light/60"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Quick search…</span>
        <kbd className="rounded border border-brand-line bg-brand-light px-1.5 py-0.5 font-mono text-[10px] text-brand-mute">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
