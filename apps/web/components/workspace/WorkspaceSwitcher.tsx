"use client";

import {
  Check,
  ChevronDown,
  Compass,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
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

const OPTIONS: Record<Workspace, Option> = {
  host: {
    id: "host",
    label: "Host workspace",
    href: "/dashboard",
    icon: LayoutDashboard,
    blurb: "Manage listings, bookings, calendar",
  },
  guest: {
    id: "guest",
    label: "Guest portal",
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
  /** Guest is implicit: any authenticated user can visit /portal. */
};

export function WorkspaceSwitcher({ current, canHost, canAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const cur = OPTIONS[current];
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
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[--radix-popover-trigger-width] p-1"
        >
          <ul className="space-y-0.5">
            {available.map((id) => {
              const opt = OPTIONS[id];
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
