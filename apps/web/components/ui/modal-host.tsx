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

interface PromptSpec {
  label?: string;
  placeholder?: string;
  defaultValue: string;
  minLength: number;
  multiline: boolean;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: string | null) => void;
}

interface ModalRequest {
  id: number;
  intent: ModalIntent;
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  details?: ModalDetail[];
  actions: ModalAction[];
  dismissible: boolean;
  /** Present for `modal.prompt()` — the host renders a text input + builds
   *  its own confirm/cancel actions that carry the entered value. */
  prompt?: PromptSpec;
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

export interface PromptOptions {
  title: string;
  description?: React.ReactNode;
  /** Field label above the input. */
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Inline-validated minimum trimmed length before confirm enables. */
  minLength?: number;
  /** Render a multi-line textarea instead of a single-line input. */
  multiline?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "confirm" (default) or "destructive" for red confirm CTAs (e.g. deletes). */
  intent?: "confirm" | "destructive";
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

/**
 * Text-input prompt. Resolves to the trimmed entered string, or `null` if the
 * user cancels/dismisses. The design-system replacement for `window.prompt`.
 */
function promptInput(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    enqueue({
      intent: opts.intent ?? "confirm",
      icon: opts.icon,
      title: opts.title,
      description: opts.description,
      dismissible: opts.dismissible ?? true,
      // Actions are synthesized per-keystroke by PromptModal so confirm can
      // carry the live value and disable while the input is too short.
      actions: [],
      prompt: {
        label: opts.label,
        placeholder: opts.placeholder,
        defaultValue: opts.defaultValue ?? "",
        minLength: opts.minLength ?? 0,
        multiline: opts.multiline ?? false,
        confirmLabel: opts.confirmLabel ?? "Confirm",
        cancelLabel: opts.cancelLabel ?? "Cancel",
        resolve,
      },
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
  /** Text-input prompt. Resolves the entered string, or null if cancelled. */
  prompt: promptInput,
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

  if (current.prompt) {
    return <PromptModal key={current.id} request={current} />;
  }

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

/**
 * Renders a `modal.prompt()` request: a text input with inline min-length
 * validation and confirm/cancel buttons. Owns the input state so confirm can
 * carry the live value and stay disabled until the input is long enough.
 */
function PromptModal({ request }: { request: ModalRequest }) {
  const spec = request.prompt as PromptSpec;
  const [value, setValue] = React.useState(spec.defaultValue);
  const settled = React.useRef(false);

  const trimmed = value.trim();
  const valid = trimmed.length >= spec.minLength;

  const finish = React.useCallback(
    (result: string | null) => {
      if (settled.current) return;
      settled.current = true;
      dismiss(request.id);
      spec.resolve(result);
    },
    [request.id, spec],
  );

  const fieldClass =
    "w-full rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none";

  const inputEl = (
    <div>
      {spec.label ? (
        <label className="mb-1.5 block text-[13px] font-medium text-brand-ink">
          {spec.label}
        </label>
      ) : null}
      {spec.multiline ? (
        <textarea
          autoFocus
          rows={3}
          value={value}
          placeholder={spec.placeholder}
          onChange={(e) => setValue(e.target.value)}
          className={fieldClass}
        />
      ) : (
        <input
          autoFocus
          type="text"
          value={value}
          placeholder={spec.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) {
              e.preventDefault();
              finish(trimmed);
            }
          }}
          className={fieldClass}
        />
      )}
      {spec.minLength > 0 && trimmed.length > 0 && !valid ? (
        <p className="mt-1 text-[12px] text-red-600">
          Please enter at least {spec.minLength} characters.
        </p>
      ) : null}
    </div>
  );

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) finish(null);
      }}
      intent={request.intent}
      icon={request.icon}
      title={request.title}
      description={request.description}
      input={inputEl}
      actions={[
        {
          label: spec.cancelLabel,
          kind: "ghost",
          onClick: () => finish(null),
        },
        {
          label: spec.confirmLabel,
          kind: request.intent === "destructive" ? "danger" : "primary",
          disabled: !valid,
          onClick: () => finish(trimmed),
        },
      ]}
      dismissible={request.dismissible}
    />
  );
}
