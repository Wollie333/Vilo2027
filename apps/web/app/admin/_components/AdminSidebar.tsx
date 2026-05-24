"use client";

import {
  Activity,
  CalendarCheck,
  CreditCard,
  Crown,
  FileText,
  Flag,
  Gauge,
  Home as HomeIcon,
  KeyRound,
  ShieldAlert,
  Star,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { VLogo } from "../../dashboard/_components/VLogo";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: "exact" | "prefix";
};

const OPERATIONS: Item[] = [
  { href: "/admin", label: "Overview", icon: Gauge, match: "exact" },
  { href: "/admin/users", label: "Users", icon: Users, match: "prefix" },
  { href: "/admin/hosts", label: "Hosts", icon: UsersRound, match: "prefix" },
  {
    href: "/admin/listings",
    label: "Listings",
    icon: HomeIcon,
    match: "prefix",
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    icon: CalendarCheck,
    match: "prefix",
  },
];

const FINANCE: Item[] = [
  {
    href: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
    match: "prefix",
  },
  {
    href: "/admin/subscriptions",
    label: "Subscriptions",
    icon: Crown,
    match: "prefix",
  },
];

const MODERATION: Item[] = [
  { href: "/admin/reviews", label: "Reviews", icon: Star, match: "prefix" },
  {
    href: "/admin/data-requests",
    label: "Data requests",
    icon: ShieldAlert,
    match: "prefix",
  },
];

const PLATFORM: Item[] = [
  { href: "/admin/platform/settings", label: "Settings", icon: FileText },
  { href: "/admin/platform/features", label: "Feature flags", icon: Flag },
  {
    href: "/admin/platform/staff",
    label: "Vilo staff",
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

function isActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix" = "exact",
) {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item }: { item: Item }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href, item.match);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13.5px] font-medium transition-colors ${
        active
          ? "bg-brand-accent font-semibold text-brand-secondary"
          : "text-brand-mute hover:bg-brand-accent/60 hover:text-brand-ink"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
      {children}
    </div>
  );
}

export function AdminSidebar({ role, email }: { role: string; email: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-brand-line bg-white lg:flex">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <VLogo size={36} gradientId="admin-logo" />
        <div className="leading-none">
          <div className="font-display text-[15px] font-bold tracking-tight text-brand-ink">
            Vilo
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-brand-primary">
            Admin
          </div>
        </div>
      </div>

      <div className="mb-3 px-3">
        <div className="flex w-full items-center gap-2.5 rounded-md border border-brand-line bg-brand-light px-3 py-2">
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

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
        {OPERATIONS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <SectionLabel>Finance</SectionLabel>
        {FINANCE.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <SectionLabel>Moderation</SectionLabel>
        {MODERATION.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <SectionLabel>Platform</SectionLabel>
        {PLATFORM.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-brand-line px-3 pb-3 pt-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13.5px] font-medium text-brand-mute transition-colors hover:bg-brand-accent/60 hover:text-brand-ink"
        >
          <Activity className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">Back to host dashboard</span>
        </Link>
      </div>
    </aside>
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
