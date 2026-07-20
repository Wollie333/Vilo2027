"use client";

import {
  Check,
  ChevronDown,
  Compass,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type Workspace = "host" | "guest" | "admin";

type Option = {
  id: Workspace;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  blurb: string;
};

const DEFAULTS: Record<Workspace, Option> = {
  host: {
    id: "host",
    label: "Host workspace",
    href: "/dashboard",
    icon: LayoutDashboard,
    blurb: "Manage listings, bookings, calendar",
  },
  guest: {
    id: "guest",
    label: "Wielo account",
    href: "/portal",
    icon: Compass,
    blurb: "Browse, book, view your trips",
  },
  admin: {
    id: "admin",
    label: "Admin panel",
    href: "/admin",
    icon: ShieldCheck,
    blurb: "Platform settings, users, broadcasts",
  },
};

type Props = {
  current: Workspace;
  canHost: boolean;
  canAdmin: boolean;
  /**
   * Override the Host workspace label/blurb with the host's actual
   * identity (e.g. display_name + listing count). Makes the pill say
   * "Featherstone Guesthouse · 3 listings" instead of the generic
   * "Host workspace". Falls back to defaults when null/undefined.
   */
  hostDisplayName?: string | null;
  hostBlurb?: string | null;
  /** Same idea for admin: override label/blurb (e.g. role name). */
  adminLabel?: string | null;
  adminBlurb?: string | null;
  /**
   * Compact mode: renders as a small pill suitable for the topbar
   * (icon + label + chevron, no two-line blurb, no background tint).
   * The popover content is identical to the full version.
   */
  compact?: boolean;
};

export function WorkspaceSwitcher({
  current,
  canHost,
  canAdmin,
  hostDisplayName,
  hostBlurb,
  adminLabel,
  adminBlurb,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);

  // Build the per-workspace options with any caller overrides applied.
  const options: Record<Workspace, Option> = {
    ...DEFAULTS,
    host: {
      ...DEFAULTS.host,
      label: hostDisplayName?.trim() || DEFAULTS.host.label,
      blurb: hostBlurb?.trim() || DEFAULTS.host.blurb,
    },
    admin: {
      ...DEFAULTS.admin,
      label: adminLabel?.trim() || DEFAULTS.admin.label,
      blurb: adminBlurb?.trim() || DEFAULTS.admin.blurb,
    },
  };

  const cur = options[current];
  const CurIcon = cur.icon;

  // Always include the CURRENT workspace in the list — the user is by
  // definition able to access it (they're on it right now). The other
  // workspaces are gated on canHost / canAdmin / always-guest.
  const available: Workspace[] = (
    ["host", "guest", "admin"] as Workspace[]
  ).filter((w) => {
    if (w === current) return true;
    if (w === "guest") return true; // anyone can be a guest
    if (w === "host") return canHost;
    return canAdmin;
  });

  // If only one workspace is available (and that's the current one), no
  // switcher needed — plain guests on /portal don't see anything.
  if (available.length <= 1) return null;

  // Per-workspace quick actions shown under a divider in the dropdown.
  // For host: "Create another listing" so the host can spin up a second
  // listing without leaving the toggle.
  const quickActions: Array<{
    href: string;
    label: string;
    icon: typeof PlusCircle;
    show: boolean;
  }> = [
    {
      href: "/dashboard/properties/new",
      label: "Create another listing",
      icon: PlusCircle,
      show: canHost,
    },
  ];
  const visibleQuickActions = quickActions.filter((a) => a.show);

  const dropdown = (
    <PopoverContent
      align="end"
      sideOffset={6}
      className="w-72 max-w-[calc(100vw-2rem)] p-1"
    >
      <ul className="space-y-0.5">
        {available.map((id) => {
          const opt = options[id];
          const Icon = opt.icon;
          const isCurrent = id === current;
          return (
            <li key={id}>
              <Link
                href={opt.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors ${
                  isCurrent
                    ? "bg-brand-accent/40 text-brand-ink"
                    : "hover:bg-brand-light"
                }`}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-accent text-brand-primary">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-brand-ink">
                    {opt.label}
                  </div>
                  <div className="truncate text-[10px] text-brand-mute">
                    {opt.blurb}
                  </div>
                </div>
                {isCurrent ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {visibleQuickActions.length > 0 ? (
        <>
          <div className="my-1 border-t border-brand-line" />
          <ul className="space-y-0.5">
            {visibleQuickActions.map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-brand-light"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary/10 text-brand-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[12px] font-semibold text-brand-ink">
                      {a.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </PopoverContent>
  );

  if (compact) {
    // Topbar-friendly compact rendering: icon + label + chevron only,
    // no two-line blurb. Suitable for mobile + desktop topbars where the
    // sidebar isn't always visible.
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-2.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent"
            aria-label={`Switch workspace (currently ${cur.label})`}
          >
            <CurIcon className="h-4 w-4 text-brand-primary" />
            <span className="hidden max-w-[160px] truncate sm:inline">
              {cur.label}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-brand-mute transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </PopoverTrigger>
        {dropdown}
      </Popover>
    );
  }

  return (
    <div className="px-3 pb-3 pt-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border border-brand-line bg-brand-light/60 px-3 py-2 text-left transition-colors hover:bg-brand-accent/40"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary text-white">
              <CurIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-brand-ink">
                {cur.label}
              </div>
              <div className="truncate text-[10px] text-brand-mute">
                {cur.blurb}
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-brand-mute transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </PopoverTrigger>
        {dropdown}
      </Popover>
    </div>
  );
}
