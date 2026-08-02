import {
  CalendarClock,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import { InboxSystemCard, type InboxCardTone } from "./InboxSystemCard";

// Rich thread card for the guest-request lifecycle system events
// (refund_requested / booking_change_request / booking_change_approved /
// booking_change_declined) — so a refund or date-change reads as a premium card
// in the thread, matching payment/support cards, instead of a plain grey pill.
// Reuses the shared InboxSystemCard design.

const META: Record<
  string,
  { title: string; tone: InboxCardTone; icon: ReactNode }
> = {
  refund_requested: {
    title: "Refund requested",
    tone: "amber",
    icon: <RotateCcw className="h-5 w-5" />,
  },
  booking_change_request: {
    title: "Change requested",
    tone: "amber",
    icon: <CalendarClock className="h-5 w-5" />,
  },
  booking_change_approved: {
    title: "Request approved",
    tone: "brand",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  booking_change_declined: {
    title: "Request declined",
    tone: "rose",
    icon: <XCircle className="h-5 w-5" />,
  },
  addon_added: {
    title: "Extra added",
    tone: "sky",
    icon: <Sparkles className="h-5 w-5" />,
  },
};

export function isBookingRequestEvent(systemEvent: string | null): boolean {
  return !!systemEvent && systemEvent in META;
}

export function BookingRequestCard({
  systemEvent,
  body,
  footer,
}: {
  systemEvent: string;
  body: string | null;
  footer?: ReactNode;
}) {
  const meta = META[systemEvent] ?? META.booking_change_request;
  // Strip a leading emoji so the body reads cleanly under the titled header.
  const text = (body ?? "").replace(/^\s*[^\w\s]+\s*/, "").trim();
  return (
    <InboxSystemCard
      tone={meta.tone}
      icon={meta.icon}
      title={meta.title}
      footer={footer}
    >
      {text ? (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-brand-ink">
          {text}
        </p>
      ) : null}
    </InboxSystemCard>
  );
}
