"use client";

/**
 * Imperative "what's happening" busy overlay.
 *
 * Mount <BusyHost /> once (done in the root layout) and drive it from anywhere
 * for the SLOW, blocking actions — the ones where the user would otherwise sit
 * looking at a frozen screen wondering if their click registered:
 *
 *   // wrap an async action — overlay shows for its whole duration
 *   await busy.during(
 *     { title: "Publishing your site", message: "Pushing your latest changes live…" },
 *     () => publishWebsiteAction(id),
 *   );
 *
 *   // or drive it manually (e.g. before a navigation into a heavy route)
 *   const t = busy.show({ title: "Opening the editor", message: "Loading your page…" });
 *   router.push(href);
 *   // …hidden by the destination, or busy.hide(t)
 *
 * This is the app-wide standard for "click → labeled loading modal" (see
 * RULES.md → "Every action gives feedback"). It mirrors the dependency-free
 * external-store pattern in modal-host.tsx so every popup shares the design
 * system. For fast/non-blocking actions prefer a button spinner + toast; for
 * route transitions the global <RouteProgress/> top bar already covers you.
 */

import { Loader2 } from "lucide-react";
import * as React from "react";

interface BusyRequest {
  id: number;
  title: string;
  message?: string;
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

function show(opts: BusyOptions = {}): number {
  const id = nextId++;
  stack = [
    ...stack,
    {
      id,
      title: opts.title ?? DEFAULTS.title,
      message: opts.message ?? DEFAULTS.message,
    },
  ];
  emit();
  return id;
}

function hide(id?: number) {
  stack = id == null ? [] : stack.filter((r) => r.id !== id);
  emit();
}

/**
 * Show the labeled overlay for the duration of an async action and always
 * clear it afterwards (even if the action throws). The common case.
 */
async function during<T>(opts: BusyOptions, fn: () => Promise<T>): Promise<T> {
  const id = show(opts);
  try {
    return await fn();
  } finally {
    hide(id);
  }
}

/** The imperative busy-overlay singleton. */
export const busy = { show, hide, during };

/**
 * Single mount point for the busy overlay. The most recently requested label
 * wins (last in the stack), so an action started on top of another shows its
 * own copy. Place once at the app root.
 */
export function BusyHost() {
  const reqs = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
