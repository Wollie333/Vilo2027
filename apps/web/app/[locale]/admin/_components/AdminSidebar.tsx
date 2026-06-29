"use client";

import {
  Activity,
  BadgePercent,
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  Flag,
  Gauge,
  Home as HomeIcon,
  KeyRound,
  Layers,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageSquarePlus,
  Package,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Users,
  Video,
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
  // One unified Users hub — every Wielo user (hosts + guests + staff). The old
  // separate "Hosts" tab is gone; filter by type inside Users instead.
  { href: "/admin/users", label: "Users", icon: Users, match: "prefix" },
  {
    href: "/admin/properties",
    label: "Listings",
    icon: HomeIcon,
    match: "prefix",
  },
  {
    href: "/admin/hosts/staff",
    label: "Host staff",
    icon: Users,
    match: "prefix",
  },
];

const FINANCE: GmailNavItem[] = [
  {
    href: "/admin/products",
    label: "Products",
    icon: Package,
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
    href: "/admin/data-requests",
    label: "Data requests",
    icon: ShieldAlert,
    match: "prefix",
  },
];

const SUPPORT: GmailNavItem[] = [
  {
    href: "/admin/help",
    label: "Help overview",
    icon: LifeBuoy,
    match: "exact",
  },
  {
    href: "/admin/help/articles",
    label: "Articles",
    icon: BookOpen,
    match: "prefix",
  },
  { href: "/admin/help/videos", label: "Videos", icon: Video, match: "prefix" },
  {
    href: "/admin/help/faqs",
    label: "FAQs",
    icon: MessageSquarePlus,
    match: "prefix",
  },
  {
    href: "/admin/help/categories",
    label: "Categories",
    icon: FileText,
    match: "prefix",
  },
  {
    href: "/admin/help/status",
    label: "System status",
    icon: Activity,
    match: "prefix",
  },
  {
    href: "/admin/help/settings",
    label: "Help settings",
    icon: KeyRound,
    match: "prefix",
  },
  {
    href: "/admin/help/suggestions",
    label: "Suggestions",
    icon: MessageSquarePlus,
    match: "prefix",
  },
];

const PLATFORM: GmailNavItem[] = [
  { href: "/admin/platform/settings", label: "Settings", icon: FileText },
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
    href: "/admin/broadcasts",
    label: "Broadcasts",
    icon: Megaphone,
    match: "prefix",
  },
  {
    href: "/admin/notifications/sent",
    label: "Send to users",
    icon: Send,
    match: "prefix",
  },
  {
    href: "/admin/emails",
    label: "Email templates",
    icon: Mail,
    match: "prefix",
  },
  {
    href: "/admin/platform/staff",
    label: "Platform staff",
    icon: KeyRound,
    match: "prefix",
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    icon: ShieldAlert,
    match: "prefix",
  },
];

// Nav item → the admin permission key required to USE its page. Only real keys
// (admin_permissions); items absent here are always shown. super_admin holds
// every key, so it sees the full rail; narrower roles only see what they can open.
const NAV_PERM: Record<string, string> = {
  "/admin/users": "users.view",
  "/admin/properties": "listings.edit",
  "/admin/hosts/staff": "hosts.verify",
  "/admin/products": "subscriptions.edit",
  "/admin/subscriptions/revenue": "payments.view",
  "/admin/payments": "payments.view",
  "/admin/affiliates": "payments.view",
  "/admin/reporting": "payments.view",
  "/admin/reviews": "reviews.moderate",
  "/admin/data-requests": "users.view",
  "/admin/platform/settings": "platform.settings",
  "/admin/platform/features": "platform.features",
  "/admin/platform/categories": "platform.settings",
  "/admin/platform/deal-categories": "platform.settings",
  "/admin/platform/amenities": "platform.settings",
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
    // The two long groups collapse by default so the rail isn't overwhelming —
    // they auto-open when you're inside them.
    {
      label: "Help centre",
      items: vis(SUPPORT),
      collapsible: true,
      defaultOpen: false,
    },
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
