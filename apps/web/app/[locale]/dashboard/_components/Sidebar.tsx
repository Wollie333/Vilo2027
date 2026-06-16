"use client";

import {
  BadgePercent,
  BarChart3,
  BedDouble,
  Cable,
  CalendarCheck,
  Calendar as CalendarIcon,
  CalendarRange,
  CreditCard,
  FileMinus,
  FileText,
  Home as HomeIcon,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  MessageSquare,
  PackagePlus,
  Receipt,
  RotateCcw,
  RotateCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  Ticket,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import {
  GmailNav,
  type GmailNavItem,
  type GmailNavSection,
} from "@/app/_components/GmailNav";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

const MAIN: GmailNavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    match: "exact",
  },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/dashboard/guests", label: "Guests", icon: Users, match: "prefix" },
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
  {
    href: "/dashboard/listing-extras",
    label: "Listing extras",
    icon: MapPin,
    match: "prefix",
  },
];

const FINANCES: GmailNavItem[] = [
  {
    href: "/dashboard/ledger",
    label: "Ledger",
    icon: ScrollText,
    match: "prefix",
  },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  {
    href: "/dashboard/quotes",
    label: "Quotes",
    icon: FileText,
    match: "prefix",
  },
  {
    href: "/dashboard/invoices",
    label: "Invoices",
    icon: Receipt,
    match: "prefix",
  },
  {
    href: "/dashboard/credit-notes",
    label: "Credit Notes",
    icon: FileMinus,
    match: "prefix",
  },
  { href: "/dashboard/refunds", label: "Refunds", icon: RotateCcw },
];

const CONNECT: GmailNavItem[] = [
  {
    href: "/dashboard/channels",
    label: "Channels",
    icon: Cable,
    badge: { text: "PRO", tone: "pro" },
  },
  { href: "/dashboard/calendar-sync", label: "Calendar sync", icon: RotateCw },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
];

const TOOLS: GmailNavItem[] = [
  {
    href: "/dashboard/addons",
    label: "Add-ons",
    icon: PackagePlus,
    badge: { text: "PRO", tone: "pro" },
  },
  { href: "/dashboard/coupons", label: "Coupons", icon: Ticket },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  {
    href: "/dashboard/policies",
    label: "Policies",
    icon: ShieldCheck,
    match: "prefix",
  },
  // The affiliate programme lives in the universal portal area (open to every
  // user). Hosts reach it via this cross-workspace link.
  {
    href: "/portal/affiliates",
    label: "Affiliates",
    icon: BadgePercent,
    match: "prefix",
  },
];

const FOOTER: GmailNavItem[] = [
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    match: "prefix",
  },
  {
    href: "/dashboard/help",
    label: "Help & docs",
    icon: LifeBuoy,
    match: "prefix",
  },
];

export function Sidebar({
  host,
  plan,
  canHost,
  canAdmin = false,
  inboxUnread = 0,
  guestCount = 0,
}: {
  host: { display_name: string; handle: string; listingCount: number } | null;
  plan: string | null;
  canHost?: boolean;
  canAdmin?: boolean;
  inboxUnread?: number;
  guestCount?: number;
}) {
  const planLabel =
    plan === "free"
      ? "Free"
      : plan
        ? plan[0].toUpperCase() + plan.slice(1)
        : "—";

  const mainItems = MAIN.map((item) => {
    if (item.href === "/dashboard/inbox" && inboxUnread > 0) {
      return {
        ...item,
        badge: { text: String(inboxUnread), tone: "alert" as const },
      };
    }
    if (item.href === "/dashboard/guests" && guestCount > 0) {
      return { ...item, count: guestCount };
    }
    return item;
  });

  const sections: GmailNavSection[] = [
    { items: mainItems },
    { label: "Finances", items: FINANCES },
    { label: "Connect", items: CONNECT },
    { label: "Tools", items: TOOLS },
  ];

  return (
    <GmailNav
      ariaLabel="Host dashboard navigation"
      top={
        <div className="space-y-2">
          <WorkspaceSwitcher
            current="host"
            canHost={canHost ?? Boolean(host)}
            canAdmin={canAdmin}
            hostDisplayName={host?.display_name ?? null}
            hostBlurb={
              host
                ? `${host.listingCount} ${host.listingCount === 1 ? "listing" : "listings"} · ${planLabel}`
                : null
            }
          />
          {!host ? (
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
          ) : null}
        </div>
      }
      sections={sections}
      footer={FOOTER}
    />
  );
}
