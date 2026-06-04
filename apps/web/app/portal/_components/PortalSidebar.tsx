"use client";

import {
  Compass,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Luggage,
  MessageSquare,
  Settings,
  Star,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";

import { VLogo } from "@/app/dashboard/_components/VLogo";
import { BrandName } from "@/components/brand/BrandProvider";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
};

const MAIN: Item[] = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard, match: "exact" },
  { href: "/portal/trips", label: "My trips", icon: Luggage, match: "prefix" },
  {
    href: "/portal/inbox",
    label: "Messages",
    icon: MessageSquare,
    match: "prefix",
  },
  { href: "/portal/reviews", label: "Reviews", icon: Star, match: "prefix" },
];

const FOOTER_LINKS: Item[] = [
  {
    href: "/portal/settings",
    label: "Settings",
    icon: Settings,
    match: "prefix",
  },
  { href: "/help", label: "Help & docs", icon: LifeBuoy, match: "prefix" },
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
    </Link>
  );
}

export function PortalSidebar({
  displayName,
  avatarUrl,
  email,
  canHost = false,
  canAdmin = false,
  hostDisplayName = null,
  hostBlurb = null,
}: {
  displayName: string;
  avatarUrl: string | null;
  email: string;
  canHost?: boolean;
  canAdmin?: boolean;
  hostDisplayName?: string | null;
  hostBlurb?: string | null;
}) {
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-brand-line bg-white lg:flex">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <VLogo size={36} gradientId="portal-logo" />
        <div className="leading-none">
          <div className="font-display text-[15px] font-bold tracking-tight text-brand-ink">
            <BrandName />
          </div>
          <div className="mt-1 text-[10px] text-brand-mute">Guest portal</div>
        </div>
      </div>

      <WorkspaceSwitcher
        current="guest"
        canHost={canHost}
        canAdmin={canAdmin}
        hostDisplayName={hostDisplayName}
        hostBlurb={hostBlurb}
      />

      <div className="mb-2 px-3">
        <Link
          href="/portal/settings"
          className="flex w-full items-center gap-2.5 rounded-md border border-brand-line px-3 py-2 text-left transition-colors hover:bg-brand-light"
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
            <div className="truncate text-[10px] text-brand-mute">{email}</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
        {MAIN.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <div className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
          Discover
        </div>
        <Link
          href="/explore"
          className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13.5px] font-medium text-brand-mute transition-colors hover:bg-brand-accent/60 hover:text-brand-ink"
        >
          <Compass className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">Browse stays</span>
        </Link>
      </nav>

      <div className="space-y-0.5 border-t border-brand-line px-3 pb-3 pt-3">
        {FOOTER_LINKS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-[13.5px] font-medium text-brand-mute transition-colors hover:bg-brand-accent/60 hover:text-brand-ink"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
