"use client";

import { usePathname } from "next/navigation";

import { isFullBleedRoute } from "@/lib/layout/fullBleed";

import { SidebarToggleProvider } from "./SidebarToggle";

/**
 * Unified "Classic shell" used by all three portals (host dashboard, guest
 * portal, super admin):
 *
 *   ┌──────────────────────────────────────────┐
 *   │ header (full width)                       │
 *   ├───────────┬──────────────────────────────┤
 *   │ sidebar   │ main (scrolls internally)     │
 *   └───────────┴──────────────────────────────┘
 *
 * The whole shell is a fixed-height viewport; only the content column scrolls,
 * so the header + sidebar stay put. Full-bleed routes (Inbox) own their own
 * scroll and skip the padded container — the decision is reactive to the route
 * (a server layout can't recompute it on client navigation).
 */
export function ClassicShellFrame({
  header,
  sidebar,
  banner,
  bottomNav,
  children,
}: {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  banner?: React.ReactNode;
  bottomNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const fullBleed = isFullBleedRoute(usePathname());

  return (
    <SidebarToggleProvider>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-brand-light text-brand-ink">
        {header}
        <div className="flex min-h-0 flex-1">
          {sidebar}
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {banner}
            {fullBleed ? (
              <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">
                {children}
              </div>
            ) : (
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
                <div className="px-5 py-6 lg:px-8 lg:py-8">
                  <div className="mx-auto max-w-[1280px]">{children}</div>
                </div>
              </div>
            )}
          </main>
        </div>
        {bottomNav}
      </div>
    </SidebarToggleProvider>
  );
}
