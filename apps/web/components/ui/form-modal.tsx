"use client";

/**
 * Vilo action/form modal — the larger sibling of the notification <Modal />.
 *
 * Same backdrop, card chrome, motion and brand styling, but with a header
 * (title + optional subtitle + close affordance), a scrollable body slot for
 * arbitrary content (forms, detail views), and a footer for actions. Use this
 * for any popup that contains a form — "Add seasonal price", "Edit room",
 * bank-account dialogs, etc. — so they match the notification modals.
 *
 * Composable:
 *
 *   <FormModal open={open} onOpenChange={setOpen} title="Add seasonal price">
 *     <form id="season-form" onSubmit={…}>… fields …</form>
 *     <FormModalFooter>
 *       <FormModalCancel>Cancel</FormModalCancel>
 *       <button type="submit" form="season-form" className={…}>Save</button>
 *     </FormModalFooter>
 *   </FormModal>
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Width preset. Default "md". */
  size?: keyof typeof SIZES;
  /** Allow backdrop click / Esc / the X to dismiss. Default true. */
  dismissible?: boolean;
  /** Body content (your form). Wrap footer actions in <FormModalFooter>. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Action/form modal. Body scrolls; header and footer stay pinned.
 * Put exactly one <FormModalFooter> among the children for pinned actions.
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  dismissible = true,
  children,
  className,
}: FormModalProps) {
  const footers: React.ReactNode[] = [];
  const body: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === FormModalFooter) {
      footers.push(child);
    } else {
      body.push(child);
    }
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
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
            if (!dismissible) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
            "rounded-card bg-white shadow-lift focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            SIZES[size],
            className,
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-brand-line px-6 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-lg font-semibold text-brand-ink">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-brand-mute">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            {dismissible ? (
              <DialogPrimitive.Close
                aria-label="Close"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-brand-mute transition-colors hover:bg-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            ) : null}
          </div>

          {/* Body (scrolls) */}
          <div className="flex-1 overflow-y-auto px-6 py-5">{body}</div>

          {/* Footer (pinned) */}
          {footers}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Pinned footer row for action/form modals. Right-aligns its buttons. */
export function FormModalFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-brand-line bg-brand-light/40 px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Ghost cancel button wired to close the modal. */
export const FormModalCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children = "Cancel", ...props }, ref) => (
  <DialogPrimitive.Close asChild>
    <button
      ref={ref}
      type="button"
      className={cn(
        "rounded px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-accent disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  </DialogPrimitive.Close>
));
FormModalCancel.displayName = "FormModalCancel";
