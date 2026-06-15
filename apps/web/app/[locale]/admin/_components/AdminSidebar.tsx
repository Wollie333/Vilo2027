"use client";

import {
  Activity,
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
  // One unified Users hub — every Vilo user (hosts + guests + staff). The old
  // separate "Hosts" tab is gone; filter by type inside Users instead.
  { href: "/admin/users", label: "Users", icon: Users, match: "prefix" },
  {
    href: "/admin/listings",
    label: "Listings",
    icon: HomeIcon,
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
    // The Vilo ledger — every transaction between users and Vilo.
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

export function AdminSidebar({
  role,
  email,
  canHost = false,
  hostDisplayName = null,
  hostBlurb = null,
}: {
  role: string;
  email: string;
  canHost?: boolean;
  hostDisplayName?: string | null;
  hostBlurb?: string | null;
}) {
  const sections: GmailNavSection[] = [
    { items: OPERATIONS },
    { label: "Finance", items: FINANCE },
    { label: "Moderation", items: MODERATION },
    // The two long groups collapse by default so the rail isn't overwhelming —
    // they auto-open when you're inside them.
    {
      label: "Help centre",
      items: SUPPORT,
      collapsible: true,
      defaultOpen: false,
    },
    {
      label: "Platform",
      items: PLATFORM,
      collapsible: true,
      defaultOpen: false,
    },
  ];

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
