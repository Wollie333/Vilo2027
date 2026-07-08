"use client";

import {
  BadgePercent,
  BarChart3,
  BedDouble,
  Bell,
  Bookmark,
  Cable,
  CalendarCheck,
  Calendar as CalendarIcon,
  CreditCard,
  FileMinus,
  FileText,
  Globe,
  Home as HomeIcon,
  Images,
  LayoutDashboard,
  LifeBuoy,
  List,
  MessageSquare,
  PackagePlus,
  Radar,
  Receipt,
  RotateCcw,
  RotateCw,
  ScrollText,
  Search,
  SendHorizonal,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

import {
  GmailNav,
  type GmailNavItem,
  type GmailNavSection,
} from "@/app/_components/GmailNav";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

// Channel-based IA (plan §5). Five groups: an always-open daily-driver block,
// then collapsible PROPERTIES / CHANNELS / FINANCES / INSIGHTS. Each per-Property
// editor still has its own Rooms/Pricing/Add-ons/Policies tabs, but Rooms,
// Add-ons, Coupons and the Policy library also get top-level PROPERTIES rows
// (their `/dashboard/*` pages are cross-property libraries the host manages
// directly). Seasonal pricing stays editor-only. The account-level Policy
// library now lives under PROPERTIES (folded out of the footer); Staff stays in
// the footer until nested as a Settings tab.

const DAILY: GmailNavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    match: "exact",
  },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/dashboard/guests", label: "Guests", icon: Users, match: "prefix" },
];

const PROPERTIES: GmailNavItem[] = [
  {
    href: "/dashboard/properties",
    label: "Properties",
    icon: HomeIcon,
    match: "prefix",
  },
  { href: "/dashboard/rooms", label: "Rooms", icon: BedDouble },
  {
    href: "/dashboard/policies",
    label: "Policies",
    icon: ShieldCheck,
    match: "prefix",
  },
  {
    href: "/dashboard/specials",
    label: "Specials",
    icon: Sparkles,
    match: "prefix",
  },
  {
    href: "/dashboard/addons",
    label: "Add-ons",
    icon: PackagePlus,
    match: "prefix",
  },
  { href: "/dashboard/coupons", label: "Coupons", icon: Ticket },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
  // Host-wide media library — manage website assets + listing/room photos in one
  // place (last link in the Properties group).
  { href: "/dashboard/media", label: "Media", icon: Images, match: "prefix" },
];

const CHANNELS: GmailNavItem[] = [
  {
    href: "/dashboard/website",
    label: "Website",
    icon: Globe,
    match: "prefix",
  },
  { href: "/dashboard/calendar-sync", label: "Calendar sync", icon: RotateCw },
  {
    href: "/dashboard/channels",
    label: "OTA channels",
    icon: Cable,
    badge: { text: "PRO", tone: "pro" },
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

// Looking For — guest request marketplace where hosts browse and respond to
// guest accommodation requests. Follows the same collapsible section pattern
// as Properties. Feature-gated via looking_for_access.
const LOOKING_FOR: GmailNavItem[] = [
  {
    href: "/dashboard/looking-for",
    label: "Browse Requests",
    icon: List,
    match: "prefix",
  },
  {
    href: "/dashboard/looking-for/my-quotes",
    label: "My Quotes Sent",
    icon: SendHorizonal,
  },
  {
    href: "/dashboard/looking-for/saved",
    label: "Saved Requests",
    icon: Bookmark,
  },
  {
    href: "/dashboard/looking-for/alerts",
    label: "Request Alerts",
    icon: Bell,
  },
];

const INSIGHTS: GmailNavItem[] = [
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  // Tracking hub — the host adds their own pixels / analytics IDs (Meta Pixel,
  // GA4, GTM, TikTok, Google Ads) + Meta Conversions API for their public site.
  {
    href: "/dashboard/tracking",
    label: "Tracking",
    icon: Radar,
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
  { href: "/dashboard/staff", label: "Staff", icon: UserCog },
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

/**
 * The full dashboard IA, grouped, for the mobile "More" sheet — so a host on a
 * phone can reach ANY page, not just the 4 bottom-bar tabs. Mirrors the sidebar
 * groups (single source of truth); Looking For is included only when the host has
 * access. Footer items (Staff/Settings/Help) become the "Account" group.
 */
export function mobileNavGroups(opts?: {
  canLookingFor?: boolean;
}): GmailNavSection[] {
  return [
    { label: "Dashboard", items: DAILY },
    { label: "Properties", items: PROPERTIES },
    ...(opts?.canLookingFor
      ? [{ label: "Looking For", items: LOOKING_FOR } as GmailNavSection]
      : []),
    { label: "Channels", items: CHANNELS },
    { label: "Finances", items: FINANCES },
    { label: "Insights", items: INSIGHTS },
    { label: "Account", items: FOOTER },
  ];
}

export function Sidebar({
  host,
  plan,
  canHost,
  canAdmin = false,
  inboxUnread = 0,
  guestCount = 0,
  canWebsite = false,
  canLookingFor = false,
  lookingForUnread = 0,
}: {
  host: { display_name: string; handle: string; listingCount: number } | null;
  plan: string | null;
  canHost?: boolean;
  canAdmin?: boolean;
  inboxUnread?: number;
  guestCount?: number;
  canWebsite?: boolean;
  canLookingFor?: boolean;
  lookingForUnread?: number;
}) {
  const planLabel =
    plan === "free"
      ? "Free"
      : plan
        ? plan[0].toUpperCase() + plan.slice(1)
        : "—";

  const dailyItems = DAILY.map((item) => {
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

  // W15 — the Website row carries a PRO badge until the host's plan grants the
  // builder (page + actions enforce the gate). Entitled hosts see NEW instead.
  const channelItems = CHANNELS.map((item) =>
    item.href === "/dashboard/website"
      ? {
          ...item,
          badge: canWebsite
            ? { text: "NEW", tone: "count" as const }
            : { text: "PRO", tone: "pro" as const },
        }
      : item,
  );

  // Looking For — show unread badge on "Browse Requests" when new posts in region
  const lookingForItems = LOOKING_FOR.map((item) =>
    item.href === "/dashboard/looking-for" && lookingForUnread > 0
      ? {
          ...item,
          badge: { text: String(lookingForUnread), tone: "count" as const },
        }
      : item,
  );

  const sections: GmailNavSection[] = [
    { items: dailyItems },
    { label: "Properties", items: PROPERTIES, collapsible: true },
    // Looking For section — visible when host has access (or show locked state)
    ...(canLookingFor
      ? [
          {
            label: "Looking For",
            items: lookingForItems,
            collapsible: true,
            icon: Search,
          } as GmailNavSection,
        ]
      : []),
    { label: "Channels", items: channelItems, collapsible: true },
    { label: "Finances", items: FINANCES, collapsible: true },
    { label: "Insights", items: INSIGHTS, collapsible: true },
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
                ? `${host.listingCount} ${host.listingCount === 1 ? "property" : "properties"} · ${planLabel}`
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
