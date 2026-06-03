"use client";

import { usePathname } from "next/navigation";

import { isFullBleedRoute } from "@/lib/layout/fullBleed";

/**
 * Shared dashboard / portal shell frame.
 *
 * The full-bleed decision (Inbox owns its own viewport height + scroll; every
 * other page uses the padded, max-width container) MUST be reactive to the
 * current route. App Router layouts do NOT re-render on client-side navigation,
 * so computing it from a request header in the server layout left the wrong
 * layout "stuck" until a hard refresh. Reading `usePathname()` here re-evaluates
 * on every navigation, so the shell always matches the page you're on.
 *
 * Sidebar / Topbar / banner / bottom-nav are passed in as slots (they're still
 * rendered by the server layout, which fetches their data).
 */
export function AppShellFrame({
  sidebar,
  topbar,
  banner,
  bottomNav,
  children,
}: {
  sidebar: React.ReactNode;
  topbar?: React.ReactNode;
  banner?: React.ReactNode;
  bottomNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const fullBleed = isFullBleedRoute(usePathname());

  return (
    <div
      className={`flex bg-brand-light text-brand-ink ${
        fullBleed ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      }`}
    >
      {sidebar}
      <main
        className={`flex min-w-0 flex-1 flex-col ${
          fullBleed ? "min-h-0 overflow-hidden pb-16 lg:pb-0" : "pb-20 lg:pb-0"
        }`}
      >
        {topbar}
        {banner}
        {fullBleed ? (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        ) : (
          <div className="px-5 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1280px]">{children}</div>
          </div>
        )}
      </main>
      {bottomNav}
    </div>
  );
}
