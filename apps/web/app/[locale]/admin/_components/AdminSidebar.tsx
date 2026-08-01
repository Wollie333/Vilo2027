"use client";

import {
  Activity,
  BadgePercent,
  BarChart3,
  CreditCard,
  FileText,
  Flag,
  Gauge,
  Home as HomeIcon,
  Image as ImageIcon,
  Inbox,
  Kanban,
  Layers,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  Mail,
  Package,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Users,
  Wallet,
} from "lucide-react";

import {
  GmailNav,
  type GmailNavItem,
  type GmailNavSection,
} from "@/app/_components/GmailNav";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

const OPERATIONS: GmailNavItem[] = [
  { href: "/admin", label: "Overview", icon: Gauge, match: "exact" },
  // Funnel lead pipeline — the sales CRM board (Phase 3). Sits high so the sales
  // team reaches it in one click.
  { href: "/admin/pipeline", label: "Pipeline", icon: Kanban, match: "prefix" },
  // One unified Users hub — every Wielo user (hosts + guests + staff). The old
  // separate "Hosts" tab is gone; filter by type inside Users instead.
  { href: "/admin/users", label: "Users", icon: Users, match: "prefix" },
  {
    // Support inbox — the host↔Wielo message channel. Sits right under Users.
    href: "/admin/inbox",
    label: "Inbox",
    icon: Inbox,
    match: "prefix",
  },
  {
    href: "/admin/properties",
    label: "Listings",
    icon: HomeIcon,
    match: "prefix",
  },
  {
    // Public roadmap voting board (WS-3a). Top-level for quick access.
    href: "/admin/build-board",
    label: "Build Board",
    icon: Lightbulb,
    match: "prefix",
  },
  // Host staff hidden for MVP (see the staff feature).
];

const FINANCE: GmailNavItem[] = [
  {
    href: "/admin/products",
    label: "Products",
    icon: Package,
    match: "prefix",
  },
  {
    // Wielo's OWN promo codes (discounts on Wielo products). Distinct from a
    // host's booking coupons, which live in the host dashboard.
    href: "/admin/promo-codes",
    label: "Promo codes",
    icon: Tag,
    match: "prefix",
  },
  {
    // The Wielo ledger — every transaction between users and Wielo.
    href: "/admin/subscriptions/revenue",
    label: "Ledger",
    icon: Wallet,
    match: "prefix",
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
    match: "prefix",
  },
  {
    href: "/admin/affiliates",
    label: "Affiliates",
    icon: BadgePercent,
    match: "prefix",
  },
  {
    href: "/admin/reporting",
    label: "Reporting",
    icon: BarChart3,
    match: "prefix",
  },
];

const MODERATION: GmailNavItem[] = [
  { href: "/admin/reviews", label: "Reviews", icon: Star, match: "prefix" },
  {
    href: "/admin/flagged-listings",
    label: "Flagged listings",
    icon: Flag,
    match: "prefix",
  },
  {
    href: "/admin/data-requests",
    label: "Data requests",
    icon: ShieldAlert,
    match: "prefix",
  },
];

// Help centre — the Help & docs hub. Manages the articles, videos, FAQs, status
// components and settings that render on the public /help and /dashboard/help
// surfaces. Gated by the "help.manage" permission (see NAV_PERM below).
const SUPPORT: GmailNavItem[] = [
  {
    href: "/admin/help",
    label: "Help & docs",
    icon: LifeBuoy,
    match: "prefix",
  },
];

const PLATFORM: GmailNavItem[] = [
  { href: "/admin/platform/settings", label: "Settings", icon: FileText },
  {
    // App-scoped image store for the Wielo business side (affiliate resources,
    // promo art). Distinct from a host's own media library.
    href: "/admin/library",
    label: "System library",
    icon: ImageIcon,
    match: "prefix",
  },
  { href: "/admin/platform/features", label: "Feature flags", icon: Flag },
  {
    href: "/admin/platform/categories",
    label: "Categories",
    icon: Layers,
    match: "prefix",
  },
  {
    href: "/admin/platform/deal-categories",
    label: "Deal categories",
    icon: Tag,
    match: "prefix",
  },
  {
    href: "/admin/platform/amenities",
    label: "Amenities",
    icon: Sparkles,
    match: "prefix",
  },
  {
    href: "/admin/platform/looking-for",
    label: "Looking-For reqs",
    icon: ListChecks,
    match: "exact",
  },
  {
    href: "/admin/platform/looking-for/funnel",
    label: "LF funnel",
    icon: Activity,
    match: "prefix",
  },
  {
    href: "/admin/changelog",
    label: "Changelog",
    icon: ScrollText,
    match: "prefix",
  },
  {
    // One hub over broadcasts + send-to-users + email templates (the old routes
    // still work directly; this is the consolidated entry point).
    href: "/admin/communications",
    label: "Communications",
    icon: Mail,
    match: "prefix",
  },
  // Platform staff hidden for MVP (staff feature disabled site-wide).
  {
    href: "/admin/audit",
    label: "Audit log",
    icon: ShieldAlert,
    match: "prefix",
  },
];

// Legal documents hub — the single source of truth for Terms, Privacy, Cookies,
// affiliate & competition rules, plus their placements. A dedicated section so a
// Legal Counsel (legal.docs only) has a clean top-level entry.
const LEGAL: GmailNavItem[] = [
  {
    href: "/admin/legal",
    label: "Legal docs",
    icon: ScrollText,
    match: "prefix",
  },
];

// Nav item → the admin permission key required to USE its page. Only real keys
// (admin_permissions); items absent here are always shown. super_admin holds
// every key, so it sees the full rail; narrower roles only see what they can open.
const NAV_PERM: Record<string, string> = {
  "/admin/pipeline": "pipeline.view",
  "/admin/legal": "legal.docs",
  "/admin/help": "help.manage",
  "/admin/inbox": "notifications.send_individual",
  "/admin/users": "users.view",
  "/admin/properties": "listings.edit",
  "/admin/hosts/staff": "hosts.verify",
  "/admin/products": "subscriptions.edit",
  "/admin/subscriptions/revenue": "payments.view",
  "/admin/payments": "payments.view",
  "/admin/affiliates": "payments.view",
  "/admin/reporting": "payments.view",
  "/admin/reviews": "reviews.moderate",
  "/admin/flagged-listings": "listings.moderate",
  "/admin/data-requests": "users.view",
  "/admin/platform/settings": "platform.settings",
  "/admin/platform/features": "platform.features",
  "/admin/platform/categories": "platform.settings",
  "/admin/platform/deal-categories": "platform.settings",
  "/admin/platform/amenities": "platform.settings",
  "/admin/platform/looking-for": "platform.settings",
  "/admin/platform/looking-for/funnel": "platform.settings",
  "/admin/platform/staff": "platform.staff",
  "/admin/audit": "audit.view",
};

export function AdminSidebar({
  role,
  email,
  canHost = false,
  hostDisplayName = null,
  hostBlurb = null,
  permissions = [],
}: {
  role: string;
  email: string;
  canHost?: boolean;
  hostDisplayName?: string | null;
  hostBlurb?: string | null;
  /** The signed-in staff member's permission keys — narrows the rail by role. */
  permissions?: string[];
}) {
  const permSet = new Set(permissions);
  const vis = (items: GmailNavItem[]) =>
    items.filter((i) => {
      const p = i.href ? NAV_PERM[i.href] : undefined;
      return !p || permSet.has(p);
    });

  const sections: GmailNavSection[] = [
    { items: vis(OPERATIONS) },
    { label: "Finance", items: vis(FINANCE) },
    { label: "Moderation", items: vis(MODERATION) },
    { label: "Support", items: vis(SUPPORT) },
    { label: "Legal", items: vis(LEGAL) },
    {
      label: "Platform",
      items: vis(PLATFORM),
      collapsible: true,
      defaultOpen: false,
    },
  ].filter((s) => s.items.length > 0);

  const footer: GmailNavItem[] = [
    { href: "/dashboard", label: "Back to host dashboard", icon: Activity },
  ];

  return (
    <GmailNav
      ariaLabel="Super admin navigation"
      top={
        <div className="space-y-2">
          <WorkspaceSwitcher
            current="admin"
            canHost={canHost}
            canAdmin={true}
            hostDisplayName={hostDisplayName}
            hostBlurb={hostBlurb}
            adminLabel={prettyRole(role)}
            adminBlurb={email}
          />
          <div className="flex w-full items-center gap-2.5 rounded-md border border-brand-line bg-white px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-brand-secondary font-display text-[10px] font-bold text-white">
              {email.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-brand-ink">
                {email}
              </div>
              <div className="text-[10px] text-brand-mute">
                {prettyRole(role)}
              </div>
            </div>
          </div>
        </div>
      }
      sections={sections}
      footer={footer}
    />
  );
}

function prettyRole(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "support_agent":
      return "Support Agent";
    case "finance":
      return "Finance";
    case "content_mod":
      return "Content Moderator";
    case "ops":
      return "Operations";
    default:
      return role;
  }
}
