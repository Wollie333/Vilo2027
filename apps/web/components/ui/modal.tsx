"use client";

/**
 * Wielo notification modal — the one canonical popup shell.
 *
 * One shell, six intents. Every dialog is the same `max-w-sm` card with an
 * identical icon chip, type scale and footer; only the icon, its tint and the
 * buttons change. This is the design-system "Notification modals" component
 * (see `Wielo Design System.html` → Notification modals, and DESIGN_SYSTEM.md).
 *
 * Two ways to use it:
 *  1. Declarative — render `<Modal open … />` for modals tied to local state.
 *  2. Imperative — call `modal.confirm()/.error()/…` from anywhere (see
 *     `modal-host.tsx`). Prefer the imperative API for one-off confirms,
 *     alerts and error popups so the styling stays consistent for free.
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  CircleCheck,
  CircleHelp,
  Info,
  type LucideIcon,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export type ModalIntent =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "confirm"
  | "destructive";

export type ModalButtonKind = "primary" | "ghost" | "danger";

export interface ModalAction {
  label: string;
  kind?: ModalButtonKind;
  /** Disable this button (e.g. a prompt's confirm while the input is invalid). */
  disabled?: boolean;
  /**
   * Click handler. May be async — buttons disable and show a pending state
   * while it resolves. Return `false` to keep the modal open; otherwise it
   * closes once the handler settles.
   */
  onClick?: () => void | boolean | Promise<void | boolean>;
}

export interface ModalDetail {
  label: string;
  value: React.ReactNode;
}

/** Icon + tint preset per intent — the only thing that changes between intents. */
export const MODAL_INTENTS: Record<
  ModalIntent,
  { icon: LucideIcon; tintBg: string; tintText: string }
> = {
  success: {
    icon: CircleCheck,
    tintBg: "bg-green-100",
    tintText: "text-green-600",
  },
  info: { icon: Info, tintBg: "bg-blue-100", tintText: "text-blue-600" },
  warning: {
    icon: TriangleAlert,
    tintBg: "bg-amber-100",
    tintText: "text-amber-600",
  },
  error: { icon: OctagonAlert, tintBg: "bg-red-100", tintText: "text-red-600" },
  confirm: {
    icon: CircleHelp,
    tintBg: "bg-brand-accent",
    tintText: "text-brand-primary",
  },
  destructive: {
    icon: TriangleAlert,
    tintBg: "bg-red-100",
    tintText: "text-red-600",
  },
};

const BTN: Record<ModalButtonKind, string> = {
  ghost:
    "px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent rounded transition-colors disabled:opacity-50 disabled:pointer-events-none",
  primary:
    "bg-brand-primary text-white rounded px-4 py-2 text-sm font-medium hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:pointer-events-none",
  danger:
    "bg-red-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:pointer-events-none",
};

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent?: ModalIntent;
  /** Override the intent's default icon. */
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Optional key/value summary box (booking ref, refund amount, dates …). */
  details?: ModalDetail[];
  /** Optional interactive content (e.g. a prompt's text input) rendered
   *  between the details and the footer buttons. */
  input?: React.ReactNode;
  /** Footer buttons, rendered right-aligned. Always lead with one primary CTA. */
  actions?: ModalAction[];
  /** Allow backdrop click / Esc to dismiss. Default true. */
  dismissible?: boolean;
}

/**
 * Declarative notification modal. Controlled via `open` / `onOpenChange`.
 */
export function Modal({
  open,
  onOpenChange,
  intent = "info",
  icon,
  title,
  description,
  details,
  input,
  actions,
  dismissible = true,
}: ModalProps) {
  const preset = MODAL_INTENTS[intent];
  const Icon = icon ?? preset.icon;
  const [pending, setPending] = React.useState(false);

  async function handleAction(action: ModalAction) {
    if (!action.onClick) {
      onOpenChange(false);
      return;
    }
    try {
      setPending(true);
      const keepOpen = await action.onClick();
      if (keepOpen !== false) onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={pending ? undefined : onOpenChange}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            if (!dismissible || pending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (!dismissible || pending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (!dismissible || pending) e.preventDefault();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-card bg-white p-6 shadow-lift focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <div
            className={cn(
              "mb-4 flex h-12 w-12 items-center justify-center rounded-pill",
              preset.tintBg,
            )}
          >
            <Icon className={cn("h-6 w-6", preset.tintText)} aria-hidden />
          </div>

          <DialogPrimitive.Title className="font-display text-lg font-semibold text-brand-ink">
            {title}
          </DialogPrimitive.Title>

          {description ? (
            <DialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-brand-mute">
              {description}
            </DialogPrimitive.Description>
          ) : (
            // Radix wants a description for a11y; keep one for screen readers.
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>
          )}

          {details && details.length > 0 ? (
            <div className="mt-5 space-y-1 rounded border border-brand-line bg-brand-light/60 p-3 text-xs text-brand-mute">
              {details.map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span>{row.label}</span>
                  <span className="text-right tabular-nums text-brand-ink">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {input ? <div className="mt-5">{input}</div> : null}

          {actions && actions.length > 0 ? (
            <div className="mt-5 flex justify-end gap-2">
              {actions.map((action, i) => (
                <button
                  key={`${action.label}-${i}`}
                  type="button"
                  disabled={pending || action.disabled}
                  className={BTN[action.kind ?? "primary"]}
                  onClick={() => void handleAction(action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
