import { formatMoney } from "@/lib/format";

/**
 * Shared chronological history / activity timeline.
 *
 * One visual language for every "what happened and when" list across the app
 * (payment record, booking activity, guest record, admin user history, portal
 * trip timeline …): a left rail with a colour-coded dot per event family, a
 * clean title, a meta line (actor / reason / reference), and an optional
 * right-aligned signed amount (money-in green, money-out red).
 *
 * Pure presentation — no hooks — so it renders in Server Components too.
 */

export type TimelineTone =
  | "green"
  | "amber"
  | "red"
  | "indigo"
  | "blue"
  | "slate"
  | "violet";

export type TimelineEvent = {
  /** ISO timestamp — drives ordering and the displayed date/time. */
  at: string;
  /** Event headline, e.g. "Funds captured" or "Credit note CN-0019 issued". */
  title: string;
  /** Short category shown as a pill, e.g. "Payment", "Refund", "Booking". */
  kind: string;
  /** Colour family for the dot + pill. Defaults to "slate". */
  tone?: TimelineTone;
  /** Optional monetary value shown on the right. */
  amount?: number;
  /** Currency for `amount` (falls back to the timeline's `currency` prop). */
  currency?: string;
  /** Money direction — sets the amount's colour and +/− sign. Omit for a
   *  neutral, informational figure (no sign). */
  flow?: "in" | "out";
  /** Secondary detail: who did it, a reason, a reference, a method. */
  meta?: string;
};

// One colour family per event kind — scannable at a glance, and consistent
// with the brand status tokens used elsewhere.
export const TIMELINE_TONE: Record<TimelineTone, { dot: string; tag: string }> =
  {
    green: {
      dot: "bg-status-confirmed",
      tag: "bg-status-confirmed/12 text-status-confirmed",
    },
    amber: {
      dot: "bg-status-pending",
      tag: "bg-status-pending/15 text-amber-700",
    },
    red: {
      dot: "bg-status-cancelled",
      tag: "bg-status-cancelled/12 text-status-cancelled",
    },
    indigo: { dot: "bg-indigo-500", tag: "bg-indigo-100 text-indigo-700" },
    blue: {
      dot: "bg-brand-secondary",
      tag: "bg-brand-accent/60 text-brand-secondary",
    },
    slate: { dot: "bg-brand-mute", tag: "bg-brand-line text-brand-mute" },
    violet: { dot: "bg-violet-500", tag: "bg-violet-100 text-violet-700" },
  };

function fmtDt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  }).format(d);
}

export function EventTimeline({
  events,
  currency = "ZAR",
  emptyLabel = "No events yet.",
  sort = true,
  className,
}: {
  events: TimelineEvent[];
  /** Default currency for event amounts. */
  currency?: string;
  /** Shown when there are no events. */
  emptyLabel?: string;
  /** Sort newest-first internally (default). Pass false if already ordered. */
  sort?: boolean;
  className?: string;
}) {
  const items = sort
    ? [...events].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      )
    : events;

  if (items.length === 0) {
    return <p className="text-[13px] text-brand-mute">{emptyLabel}</p>;
  }

  return (
    <ol
      className={`relative space-y-4 border-l-2 border-brand-line pl-5 ${className ?? ""}`}
    >
      {items.map((e, i) => {
        const tone = TIMELINE_TONE[e.tone ?? "slate"] ?? TIMELINE_TONE.slate;
        return (
          <li key={i}>
            <span
              className={`absolute -left-[7px] mt-0.5 h-3 w-3 rounded-full border-2 border-white ${tone.dot}`}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-brand-ink">
                  {e.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-brand-mute">
                  <span
                    className={`rounded-pill px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${tone.tag}`}
                  >
                    {e.kind}
                  </span>
                  {e.meta ? (
                    <span className="max-w-[240px] truncate">{e.meta}</span>
                  ) : null}
                  <span className="text-brand-line">·</span>
                  <span>{fmtDt(e.at)}</span>
                </div>
              </div>
              {typeof e.amount === "number" ? (
                <div
                  className={`shrink-0 font-display text-[13px] font-bold ${
                    e.flow === "in"
                      ? "text-status-confirmed"
                      : e.flow === "out"
                        ? "text-status-cancelled"
                        : "text-brand-ink"
                  }`}
                >
                  {e.flow === "out" ? "−" : e.flow === "in" ? "+" : ""}
                  {formatMoney(Math.abs(e.amount), e.currency ?? currency)}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
