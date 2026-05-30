"use client";

/**
 * Imperative notification-modal API.
 *
 * Mount <ModalHost /> once (done in the root layout) and then call the
 * `modal` singleton from anywhere — client components, server-action result
 * handlers, event callbacks:
 *
 *   await modal.error({ title: "Payment couldn't be processed", description });
 *   const ok = await modal.confirm({ title: "Send this quote to Amara?" });
 *   const ok = await modal.destructive({ title: "Cancel this booking?", … });
 *
 * This is the canonical way to show alerts, confirms and error popups — it
 * routes through the same shell as the declarative <Modal /> so every popup
 * matches the design system for free. Prefer it over window.confirm/alert and
 * over one-off Radix dialogs for simple notifications.
 */

import type { LucideIcon } from "lucide-react";
import * as React from "react";

import {
  Modal,
  type ModalAction,
  type ModalDetail,
  type ModalIntent,
} from "./modal";

interface ModalRequest {
  id: number;
  intent: ModalIntent;
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  details?: ModalDetail[];
  actions: ModalAction[];
  dismissible: boolean;
}

// ---- tiny dependency-free external store (useSyncExternalStore) ----
let queue: ModalRequest[] = [];
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
  return queue;
}

function dismiss(id: number) {
  queue = queue.filter((r) => r.id !== id);
  emit();
}

function enqueue(req: Omit<ModalRequest, "id">): number {
  const id = nextId++;
  queue = [...queue, { ...req, id }];
  emit();
  return id;
}

// ---- public options ----
export interface AlertOptions {
  title: string;
  description?: React.ReactNode;
  details?: ModalDetail[];
  /** Label for the single dismiss button. Defaults per intent. */
  okLabel?: string;
  icon?: LucideIcon;
  dismissible?: boolean;
}

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  details?: ModalDetail[];
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: LucideIcon;
  dismissible?: boolean;
}

const DEFAULT_OK: Record<ModalIntent, string> = {
  success: "Got it",
  info: "Got it",
  warning: "Got it",
  error: "Dismiss",
  confirm: "OK",
  destructive: "OK",
};

function alertFor(intent: ModalIntent) {
  return (opts: AlertOptions): Promise<void> =>
    new Promise((resolve) => {
      const id = enqueue({
        intent,
        icon: opts.icon,
        title: opts.title,
        description: opts.description,
        details: opts.details,
        dismissible: opts.dismissible ?? true,
        actions: [
          {
            label: opts.okLabel ?? DEFAULT_OK[intent],
            kind: "primary",
            onClick: () => {
              dismiss(id);
              resolve();
            },
          },
        ],
      });
    });
}

function confirmFor(intent: "confirm" | "destructive") {
  return (opts: ConfirmOptions): Promise<boolean> =>
    new Promise((resolve) => {
      const id = enqueue({
        intent,
        icon: opts.icon,
        title: opts.title,
        description: opts.description,
        details: opts.details,
        dismissible: opts.dismissible ?? true,
        actions: [
          {
            label: opts.cancelLabel ?? "Cancel",
            kind: "ghost",
            onClick: () => {
              dismiss(id);
              resolve(false);
            },
          },
          {
            label:
              opts.confirmLabel ??
              (intent === "destructive" ? "Delete" : "Confirm"),
            kind: intent === "destructive" ? "danger" : "primary",
            onClick: () => {
              dismiss(id);
              resolve(true);
            },
          },
        ],
      });
    });
}

/** The imperative modal singleton. */
export const modal = {
  success: alertFor("success"),
  info: alertFor("info"),
  warning: alertFor("warning"),
  error: alertFor("error"),
  /** Yes/no confirmation. Resolves true if confirmed, false if cancelled/dismissed. */
  confirm: confirmFor("confirm"),
  /** Destructive confirmation (red CTA). Resolves true if confirmed. */
  destructive: confirmFor("destructive"),
};

/**
 * Single mount point for imperatively-triggered modals. Renders the current
 * request (one at a time, FIFO). Place once at the app root.
 */
export function ModalHost() {
  const requests = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  const current = requests[0];

  if (!current) return null;

  return (
    <Modal
      key={current.id}
      open
      onOpenChange={(open) => {
        if (open) return;
        // Backdrop/Esc dismissal: drop the request and resolve any pending
        // promise as a cancel (the last/ghost action carries the cancel path).
        const cancel = current.actions[0];
        if (cancel?.onClick) void cancel.onClick();
        else dismiss(current.id);
      }}
      intent={current.intent}
      icon={current.icon}
      title={current.title}
      description={current.description}
      details={current.details}
      actions={current.actions}
      dismissible={current.dismissible}
    />
  );
}
