"use client";

/**
 * Imperative multi-step "what's happening" progress modal.
 *
 * Mount <ProgressHost /> once (in the root layout, beside <BusyHost />) and
 * drive it from anywhere for the SLOW, multi-stage actions — confirming a
 * booking, converting a quote, duplicating a listing, publishing a site — where
 * a single button spinner doesn't tell the user WHAT is happening:
 *
 *   const res = await progress.during(
 *     {
 *       title: "Converting quote",
 *       steps: ["Creating the booking", "Issuing the invoice", "Notifying your guest"],
 *       successTitle: "Booking created",
 *     },
 *     () => convertQuoteAction(quoteId, payment),
 *   );
 *   if (res.ok) { ... } else { toast.error(res.error); }
 *
 * How the checklist behaves — honest by design:
 *   • The steps describe what the server action is doing. Because a Server
 *     Action is a single opaque round-trip (no per-step telemetry), the modal
 *     ADVANCES the indicative steps on a gentle cadence while the action runs,
 *     and NEVER ticks the final step until the real promise settles.
 *   • On success → every step ticks green, the header flips to `successTitle`,
 *     and it auto-clears after a short beat. `during` returns the result
 *     immediately (it does not block on the beat), so navigation isn't delayed.
 *   • On failure (thrown OR a resolved `{ ok: false }` ActionResult) → the modal
 *     clears at once and the CALLER surfaces the error (its existing toast), so
 *     the message is never shown twice.
 *
 * For a single blocking action with no meaningful sub-steps prefer `busy`
 * (busy-host.tsx); for fast/non-blocking actions a button spinner + toast is
 * enough. Mirrors the dependency-free external-store pattern in modal-host.tsx.
 */

import { Check, Loader2 } from "lucide-react";
import * as React from "react";

interface ProgressReq {
  id: number;
  title: string;
  message?: string;
  steps: readonly string[];
  /** Index of the step currently spinning (while status === "running"). */
  activeIndex: number;
  status: "running" | "success";
  successTitle?: string;
  shownAt: number;
}

// ---- tiny dependency-free external store (useSyncExternalStore) ----
let current: ProgressReq | null = null;
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
  return current;
}
function patch(id: number, p: Partial<ProgressReq>) {
  if (current && current.id === id) {
    current = { ...current, ...p };
    emit();
  }
}

// Cadence for advancing an indicative step; success lingers on the green beat;
// nothing ever flashes for a sub-blink action.
const STEP_MS = 850;
const SUCCESS_MS = 950;
const MIN_VISIBLE_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ProgressOptions {
  /** Active headline while running — e.g. "Converting quote". */
  title: string;
  /** Ordered, human step labels. One item is fine (renders as a single row). */
  steps: readonly string[];
  /** Optional one-line subtext under the title. */
  message?: string;
  /** Headline shown once every step is done — e.g. "Booking created". */
  successTitle?: string;
}

function begin(opts: ProgressOptions): number {
  const id = nextId++;
  const steps = opts.steps.length ? opts.steps : ["Working…"];
  current = {
    id,
    title: opts.title,
    message: opts.message,
    steps,
    activeIndex: 0,
    status: "running",
    successTitle: opts.successTitle,
    shownAt: Date.now(),
  };
  emit();

  // Walk the indicative steps forward, but hold on the last one until the real
  // work settles (see succeed/dismiss).
  const advance = () => {
    if (
      current &&
      current.id === id &&
      current.status === "running" &&
      current.activeIndex < steps.length - 1
    ) {
      patch(id, { activeIndex: current.activeIndex + 1 });
      setTimeout(advance, STEP_MS);
    }
  };
  if (steps.length > 1) setTimeout(advance, STEP_MS);
  return id;
}

function clear(id: number) {
  if (current && current.id === id) {
    current = null;
    emit();
  }
}

/** Tick every step green, flip the header, then auto-clear after the beat. */
async function succeed(id: number) {
  if (!current || current.id !== id) return;
  const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - current.shownAt));
  if (wait) await sleep(wait);
  patch(id, { status: "success", activeIndex: current?.steps.length ?? 0 });
  setTimeout(() => clear(id), SUCCESS_MS);
}

/** Clear immediately, honouring the min-visible beat so it never flashes. */
async function dismiss(id: number) {
  if (!current || current.id !== id) return;
  const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - current.shownAt));
  if (wait) await sleep(wait);
  clear(id);
}

/**
 * Show the stepped modal for the duration of `fn` and return its result. The
 * success beat plays without blocking the return; a failure clears at once and
 * is left for the caller to surface.
 */
async function during<T>(
  opts: ProgressOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const id = begin(opts);
  try {
    const result = await fn();
    const settle = result as unknown as { ok?: boolean };
    if (settle && settle.ok === false) {
      void dismiss(id);
    } else {
      void succeed(id);
    }
    return result;
  } catch (err) {
    void dismiss(id);
    throw err;
  }
}

/** The imperative stepped-progress singleton. */
export const progress = { during };

/**
 * Single mount point for the progress modal (root layout). The most recent
 * request wins — these are user-initiated one at a time.
 */
export function ProgressHost() {
  const req = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!req) return null;

  const done = req.status === "success";
  const heading = done ? (req.successTitle ?? req.title) : req.title;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[96] flex items-center justify-center bg-brand-dark/45 backdrop-blur-sm"
    >
      <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-5 rounded-card bg-white px-8 py-9 text-center shadow-lift">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            done ? "bg-brand-primary" : "bg-brand-light"
          }`}
        >
          {done ? (
            <Check className="h-6 w-6 text-white" strokeWidth={3} />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
          )}
        </span>

        <div className="space-y-1.5">
          <p className="text-base font-semibold text-brand-ink">{heading}</p>
          {req.message ? (
            <p className="text-sm text-brand-mute">{req.message}</p>
          ) : null}
        </div>

        <ol className="w-full space-y-2.5 text-left">
          {req.steps.map((label, i) => {
            const stepDone = done || i < req.activeIndex;
            const active = !done && i === req.activeIndex;
            return (
              <li key={i} className="flex items-center gap-2.5 text-[13px]">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    stepDone
                      ? "bg-brand-primary text-white"
                      : active
                        ? "bg-brand-accent text-brand-primary"
                        : "bg-brand-light text-brand-mute"
                  }`}
                >
                  {stepDone ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={
                    stepDone
                      ? "text-brand-ink"
                      : active
                        ? "font-medium text-brand-ink"
                        : "text-brand-mute"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
