"use client";

import {
  ChevronDown,
  Compass,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { signOutAction } from "../../(auth)/actions";

type Workspace = "host" | "guest" | "admin";

// The workspaces a user can hop between, from the profile menu, on ANY device —
// the header avatar is always visible, so this is the mobile-safe switch (the
// sidebar WorkspaceSwitcher is hidden on a phone). Same labels/targets as
// components/workspace/WorkspaceSwitcher so the two stay in lockstep.
const WORKSPACES: Record<
  Workspace,
  { label: string; href: string; icon: typeof LayoutDashboard }
> = {
  host: { label: "Host workspace", href: "/dashboard", icon: LayoutDashboard },
  guest: { label: "Wielo account", href: "/portal", icon: Compass },
  admin: { label: "Admin panel", href: "/admin", icon: ShieldCheck },
};

export function AvatarMenu({
  initials,
  email,
  avatarUrl = null,
  profileHref = "/dashboard/settings",
  settingsHref = "/dashboard/settings",
  current,
  canHost = false,
  canAdmin = false,
}: {
  initials: string;
  email: string;
  avatarUrl?: string | null;
  /** Where "Profile" links — defaults to the host dashboard settings. */
  profileHref?: string;
  /** Where "Settings" links — defaults to the host dashboard settings. */
  settingsHref?: string;
  /** Which workspace the user is currently in (omits it from the switch list). */
  current?: Workspace;
  /** Show a "Host workspace" switch target (the user owns/holds a host account). */
  canHost?: boolean;
  /** Show an "Admin panel" switch target (active platform staff). */
  canAdmin?: boolean;
}) {
  const [pending, start] = useTransition();

  function handleSignOut() {
    start(() => signOutAction());
  }

  // Workspaces the user can switch TO (never the one they're on). Anyone can be
  // a guest; host/admin are gated. Only render the section when there's somewhere
  // to go.
  const switchTargets = (["host", "guest", "admin"] as Workspace[]).filter(
    (w) => {
      if (w === current) return false;
      if (w === "guest") return true;
      if (w === "host") return canHost;
      return canAdmin;
    },
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded py-1 pl-1 pr-2 hover:bg-brand-light"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={email}
              className="h-7 w-7 rounded-full border border-brand-line object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-secondary text-[11px] font-bold text-white">
              {initials}
            </div>
          )}
          <ChevronDown className="hidden h-3.5 w-3.5 text-brand-mute md:inline" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-mono text-xs text-brand-mute">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={settingsHref} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>

        {switchTargets.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-mute">
              Switch to
            </DropdownMenuLabel>
            {switchTargets.map((w) => {
              const ws = WORKSPACES[w];
              const Icon = ws.icon;
              return (
                <DropdownMenuItem key={w} asChild>
                  <Link href={ws.href} className="cursor-pointer">
                    <Icon className="mr-2 h-4 w-4" /> {ws.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleSignOut();
          }}
          disabled={pending}
          className="cursor-pointer text-status-cancelled focus:text-status-cancelled"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
