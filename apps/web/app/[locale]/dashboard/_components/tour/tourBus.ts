"use client";

/**
 * Tiny dependency-free trigger bus for the guided dashboard tour.
 *
 * The overlay (`DashboardTour`) lives in the dashboard layout while the
 * launch buttons (`TourButton`) live elsewhere in the tree, so they need a way
 * to talk without a shared provider. A window CustomEvent keeps this to a few
 * lines and avoids pulling in a state library (Zustand isn't installed and
 * CLAUDE.md says ask before adding packages).
 */

const START_EVENT = "vilo:dashboard-tour:start";
const STORAGE_KEY = "vilo:dashboard-tour:v1";

/** Fire from any client component to open the tour. */
export function startTour(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(START_EVENT));
}

/** Subscribe the overlay to start requests. Returns an unsubscribe fn. */
export function onStartTour(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(START_EVENT, cb);
  return () => window.removeEventListener(START_EVENT, cb);
}

/** Has the host already seen (completed or skipped) the tour? */
export function isTourDone(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "done";
  } catch {
    return true; // storage blocked → don't nag with auto-start
  }
}

export function markTourDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "done");
  } catch {
    /* ignore */
  }
}
