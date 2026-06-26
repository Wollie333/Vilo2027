"use client";

/**
 * Imperative "what's happening" busy overlay.
 *
 * Mount <BusyHost /> once (done in the root layout) and drive it from anywhere
 * for the SLOW, blocking actions — the ones where the user would otherwise sit
 * looking at a frozen screen wondering if their click registered:
 *
 *   // wrap an async mutation — overlay shows for its whole duration, always clears
 *   await busy.during(
 *     { title: "Publishing your site", message: "Pushing your latest changes live…" },
 *     () => publishWebsiteAction(id),
 *   );
 *
 *   // a navigation into a heavy route — overlay auto-clears when the route changes
 *   busy.showNav({ title: "Opening the editor", message: "Loading your page…" });
 *   router.push(href);
 *
 * Two flavours of show:
 *   • busy.show(opts)    → you own the lifecycle; pair with busy.hide(id) (or use during()).
 *   • busy.showNav(opts) → "until the next navigation"; <BusyHost> clears it on the
 *     next pathname change (with a min-visible beat so it never flashes), plus a
 *     safety timeout so it can never stick if the navigation is a no-op.
 *
 * This is the app-wide standard for "click → labeled loading modal" (see
 * RULES.md → "Every action gives feedback"). It mirrors the dependency-free
 * external-store pattern in modal-host.tsx so every popup shares the design
 * system. For fast/non-blocking actions prefer a button spinner + toast; for
 * ordinary links the global <NextTopLoader/> top bar already covers you.
 */

import { Loader2 } from "lucide-react";
import * as React from "react";

import { usePathname } from "@/i18n/navigation";

interface BusyRequest {
  id: number;
  title: string;
  message?: string;
  /** Auto-cleared by <BusyHost> on the next route change. */
  nav?: boolean;
  shownAt: number;
}

// ---- tiny dependency-free external store (useSyncExternalStore) ----
let stack: BusyRequest[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot() {
  return stack;
}

export interface BusyOptions {
  /** Short, active headline — e.g. "Publishing your site". */
  title?: string;
  /** One-line reassurance of what's happening in the background. */
  message?: string;
}

const DEFAULTS = {
  title: "Working…",
  message: "Just a moment — please don't close this window.",
} as const;

// Keep the overlay up briefly even on instant navigations so it reads as a
// deliberate "loading" beat rather than a flicker.
const MIN_VISIBLE_MS = 550;
// A nav overlay can never outlive this — guards against a click that doesn't
// actually change the route (so no pathname change ever clears it).
const NAV_SAFETY_MS = 12000;

function push(opts: BusyOptions, nav: boolean): number {
  const id = nextId++;
  stack = [
    ...stack,
    {
      id,
      title: opts.title ?? DEFAULTS.title,
      message: opts.message ?? DEFAULTS.message,
      nav,
      shownAt: Date.now(),
    },
  ];
  emit();
  if (nav) setTimeout(() => hide(id), NAV_SAFETY_MS);
  return id;
}

function hide(id?: number) {
  stack = id == null ? [] : stack.filter((r) => r.id !== id);
  emit();
}

/** Clear all navigation-scoped entries, each after its min-visible beat. */
function clearNav() {
  for (const r of stack.filter((r) => r.nav)) {
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - r.shownAt));
    setTimeout(() => hide(r.id), wait);
  }
}

/**
 * Show the labeled overlay for the duration of an async action and always
 * clear it afterwards (even if it throws). The common case for mutations.
 */
async function during<T>(opts: BusyOptions, fn: () => Promise<T>): Promise<T> {
  const id = push(opts, false);
  try {
    return await fn();
  } finally {
    hide(id);
  }
}

/** The imperative busy-overlay singleton. */
export const busy = {
  /** Manual lifecycle — pair with busy.hide(id). */
  show: (opts: BusyOptions = {}) => push(opts, false),
  /** "Until the next navigation" — <BusyHost> clears it on route change. */
  showNav: (opts: BusyOptions = {}) => push(opts, true),
  hide,
  during,
};

/**
 * Single mount point for the busy overlay. Lives at the app root so it survives
 * the navigations it reports on — a link/source component unmounting mid-route
 * must NOT be what clears the overlay (that left it stuck). Instead, nav-scoped
 * overlays clear here on the next pathname change. The most recently requested
 * label wins (last in the stack).
 */
export function BusyHost() {
  const reqs = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const pathname = usePathname();
  const prevPath = React.useRef(pathname);

  React.useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      clearNav();
    }
  }, [pathname]);

  const current = reqs[reqs.length - 1];
  if (!current) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-brand-dark/45 backdrop-blur-sm"
    >
      <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-4 rounded-card bg-white px-8 py-9 text-center shadow-lift">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
          <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        </span>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-brand-ink">
            {current.title}
          </p>
          {current.message ? (
            <p className="text-sm text-brand-mute">{current.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
