import type { ReactNode } from "react";

// The one shared "system message" card for the inbox — a gradient header (icon +
// title) over a white body, with an optional full-width action button and a
// footer (timestamp / read-ticks). Every system event (payment link, upgrade,
// access details, pause / cancellation…) renders through this so the thread has
// one consistent, premium look. `tone` swaps the header colour by intent.
export type InboxCardTone = "brand" | "amber" | "rose" | "sky";

const HEADER: Record<InboxCardTone, string> = {
  brand: "bg-gradient-to-r from-brand-primary to-brand-secondary",
  amber: "bg-gradient-to-r from-amber-500 to-orange-500",
  rose: "bg-gradient-to-r from-rose-500 to-red-600",
  sky: "bg-gradient-to-r from-sky-500 to-cyan-500",
};

const BORDER: Record<InboxCardTone, string> = {
  brand: "border-brand-primary/30",
  amber: "border-amber-500/30",
  rose: "border-rose-500/30",
  sky: "border-sky-500/30",
};

export function InboxSystemCard({
  tone = "brand",
  icon,
  title,
  children,
  action,
  footer,
}: {
  tone?: InboxCardTone;
  // Pass a sized lucide icon, e.g. <CreditCard className="h-5 w-5" />.
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  // Optional full-width call-to-action (Pay / Open / View…).
  action?: { href: string; label: string; icon?: ReactNode };
  // Timestamp (and read-ticks when relevant), right-aligned under the body.
  footer?: ReactNode;
}) {
  return (
    <div
      className={`mx-auto my-1 max-w-[420px] overflow-hidden rounded-card border bg-white shadow-sm ${BORDER[tone]}`}
    >
      <div
        className={`flex items-center gap-2.5 px-4 py-3 text-white ${HEADER[tone]}`}
      >
        {icon}
        <span className="font-display text-[14px] font-bold">{title}</span>
      </div>
      <div className="p-4">
        {children}
        {action ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
          >
            {action.icon}
            {action.label}
          </a>
        ) : null}
        {footer ? (
          <div className="mt-1.5 flex items-center justify-end gap-1 font-mono text-[10.5px] text-brand-mute">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
