"use client";

import {
  BadgePercent,
  Bell,
  Compass,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Luggage,
  MessageSquare,
  Search,
  Settings,
  Star,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTransition } from "react";

import { signOutAction } from "@/app/[locale]/(auth)/actions";
import {
  GmailNav,
  type GmailNavItem,
  type GmailNavSection,
} from "@/app/_components/GmailNav";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

const MAIN: GmailNavItem[] = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard, match: "exact" },
  { href: "/portal/trips", label: "My trips", icon: Luggage, match: "prefix" },
  { href: "/portal/quotes", label: "Quotes", icon: FileText, match: "prefix" },
  {
    href: "/portal/inbox",
    label: "Messages",
    icon: MessageSquare,
    match: "prefix",
  },
  { href: "/portal/reviews", label: "Reviews", icon: Star, match: "prefix" },
  {
    href: "/portal/affiliates",
    label: "Affiliates",
    icon: BadgePercent,
    match: "prefix",
  },
];

export function PortalSidebar({
  displayName,
  avatarUrl,
  email,
  canHost = false,
  canAdmin = false,
  hostDisplayName = null,
  hostBlurb = null,
  unreadNotifications = 0,
}: {
  displayName: string;
  avatarUrl: string | null;
  email: string;
  canHost?: boolean;
  canAdmin?: boolean;
  hostDisplayName?: string | null;
  hostBlurb?: string | null;
  unreadNotifications?: number;
}) {
  const initials = displayName.slice(0, 2).toUpperCase();
  const [, startSignOut] = useTransition();

  const sections: GmailNavSection[] = [
    {
      items: [
        ...MAIN,
        {
          href: "/portal/notifications",
          label: "Notifications",
          icon: Bell,
          match: "prefix",
          ...(unreadNotifications > 0
            ? {
                badge: {
                  text:
                    unreadNotifications > 99
                      ? "99+"
                      : String(unreadNotifications),
                  tone: "alert" as const,
                },
              }
            : {}),
        },
      ],
    },
    {
      label: "Discover",
      items: [
        { href: "/portal/browse", label: "Browse stays", icon: Compass },
        {
          href: "/portal/looking-for",
          label: "Looking For",
          icon: Search,
          match: "prefix",
        },
      ],
    },
  ];

  const footer: GmailNavItem[] = [
    {
      href: "/portal/settings",
      label: "Settings",
      icon: Settings,
      match: "prefix",
    },
    { href: "/help", label: "Help & docs", icon: LifeBuoy, match: "prefix" },
    {
      label: "Sign out",
      icon: LogOut,
      onClick: () => startSignOut(() => signOutAction()),
    },
  ];

  return (
    <GmailNav
      ariaLabel="Guest portal navigation"
      top={
        <div className="space-y-2">
          <WorkspaceSwitcher
            current="guest"
            canHost={canHost}
            canAdmin={canAdmin}
            hostDisplayName={hostDisplayName}
            hostBlurb={hostBlurb}
          />
          <Link
            href="/portal/settings"
            className="flex w-full items-center gap-2.5 rounded-md border border-brand-line bg-white px-3 py-2 text-left transition-colors hover:bg-brand-light"
            title="Edit your profile"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-brand-secondary font-display text-[10px] font-bold text-white">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-brand-ink">
                {displayName}
              </div>
              <div className="truncate text-[10px] text-brand-mute">
                {email}
              </div>
            </div>
          </Link>
        </div>
      }
      sections={sections}
      footer={footer}
    />
  );
}
