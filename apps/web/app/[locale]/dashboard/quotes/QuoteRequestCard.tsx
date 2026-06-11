import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock,
  Gift,
  MessageSquare,
  Users,
} from "lucide-react";
import Link from "next/link";

// Read-only context card shown at the top of the quote form when a quote
// originated from a guest's public "Request a quote" enquiry. It snapshots what
// the visitor actually asked for — their message, who they are, the requested
// stay, party and add-ons — so the host has that context in front of them while
// pricing the quote. The form fields below are editable; this card never
// changes. This is the ONLY thing that differs between "new quote" and
// "respond to a request": the response lives in a card above the one form.

export type QuoteRequestContext = {
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestAvatarUrl: string | null;
  /** Prior non-cancelled bookings this guest has with the host. */
  stays: number;
  /** "Mar 2026" — the guest's most recent past checkout, if any. */
  lastStayedLabel: string | null;
  listingName: string | null;
  listingCity: string | null;
  /** Requested room names (rooms scope) — empty for whole-listing. */
  roomNames: string[];
  checkIn: string | null;
  checkOut: string | null;
  party: {
    adults?: number;
    children?: number;
    infants?: number;
    pets?: number;
  } | null;
  headcount: number | null;
  scope: string | null;
  /** Add-ons carried on the draft (what they asked about / were suggested). */
  requestedAddonLabels: string[];
  message: string | null;
  requestedAt: string | null;
  /** Whether the requested dates are free on the host's calendar right now. */
  datesOpen: boolean;
  /** Inbox conversation id — the "Open full chat" deep link. */
  conversationId: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

function nightsBetween(ci: string | null, co: string | null): number | null {
  if (!ci || !co) return null;
  const f = new Date(`${ci}T00:00:00Z`).getTime();
  const t = new Date(`${co}T00:00:00Z`).getTime();
  const n = Math.round((t - f) / 86_400_000);
  return n > 0 ? n : null;
}

function partyLabel(
  party: QuoteRequestContext["party"],
  headcount: number | null,
): string {
  const bits: string[] = [];
  const a = party?.adults ?? 0;
  const c = party?.children ?? 0;
  const i = party?.infants ?? 0;
  const p = party?.pets ?? 0;
  if (a) bits.push(`${a} adult${a === 1 ? "" : "s"}`);
  if (c) bits.push(`${c} child${c === 1 ? "" : "ren"}`);
  if (i) bits.push(`${i} infant${i === 1 ? "" : "s"}`);
  if (p) bits.push(`${p} pet${p === 1 ? "" : "s"}`);
  if (bits.length > 0) return bits.join(" · ");
  if (headcount) return `${headcount} guest${headcount === 1 ? "" : "s"}`;
  return "—";
}

function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "G";
}

export function QuoteRequestCard({ ctx }: { ctx: QuoteRequestContext }) {
  const nights = nightsBetween(ctx.checkIn, ctx.checkOut);
  const stayValue = ctx.roomNames.length
    ? ctx.roomNames.join(", ")
    : "Whole place";
  const contactBits = [
    ctx.guestEmail,
    ctx.guestPhone,
    ctx.lastStayedLabel ? `last stayed ${ctx.lastStayedLabel}` : null,
  ].filter(Boolean);
  const addonValue = ctx.requestedAddonLabels[0] ?? null;
  const addonExtra = ctx.requestedAddonLabels.length - 1;

  return (
    <section className="overflow-hidden rounded-card border border-brand-secondary/15 bg-white shadow-card">
      {/* Header — dark bar marks this as the incoming guest request */}
      <div className="flex flex-wrap items-center gap-2 bg-brand-secondary px-5 py-2.5">
        <MessageSquare className="h-4 w-4 text-brand-accent" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-white">
          Their request
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-brand-accent/80">
          <Clock className="h-3 w-3" />
          {fmtRelative(ctx.requestedAt)}
          {ctx.listingName ? ` · via ${ctx.listingName}` : ""}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start gap-3.5">
          {/* Avatar */}
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-pill ring-2 ring-brand-accent">
            {ctx.guestAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ctx.guestAvatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-gradient text-[13px] font-bold text-white">
                {initials(ctx.guestName)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14px] font-bold text-brand-ink">
                {ctx.guestName || "Guest"}
              </span>
              {ctx.stays > 0 ? (
                <>
                  <span className="inline-flex items-center rounded-pill bg-brand-accent px-2 py-0.5 text-[10.5px] font-semibold text-brand-secondary">
                    {ctx.stays} stay{ctx.stays === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                    Returning guest
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center rounded-pill bg-brand-light px-2 py-0.5 text-[10.5px] font-semibold text-brand-mute">
                  New guest
                </span>
              )}
            </div>
            {contactBits.length > 0 ? (
              <div className="mt-0.5 text-[11.5px] text-brand-mute">
                {contactBits.join(" · ")}
              </div>
            ) : null}

            {/* Their own words */}
            {ctx.message ? (
              <div className="mt-3 rounded-[12px] rounded-tl-sm border border-brand-line bg-brand-light/60 px-4 py-3 text-[13.5px] leading-relaxed text-brand-ink">
                {ctx.message}
              </div>
            ) : null}
          </div>
        </div>

        {/* What they asked for, structured */}
        <div className="mt-4 grid grid-cols-2 divide-x divide-brand-line overflow-hidden rounded-[12px] border border-brand-line sm:grid-cols-4">
          <Fact
            icon={<BedDouble className="h-3 w-3" />}
            label="Wants to stay"
            value={ctx.listingName ?? "—"}
            sub={
              [stayValue, ctx.listingCity].filter(Boolean).join(" · ") || null
            }
          />
          <Fact
            icon={<CalendarDays className="h-3 w-3" />}
            label="Dates"
            value={`${fmtDate(ctx.checkIn)} → ${fmtDate(ctx.checkOut)}`}
            sub={
              nights != null
                ? `${nights} night${nights === 1 ? "" : "s"}`
                : null
            }
          />
          <Fact
            icon={<Users className="h-3 w-3" />}
            label="Party"
            value={partyLabel(ctx.party, ctx.headcount)}
          />
          <Fact
            icon={<Gift className="h-3 w-3" />}
            label="Asked about"
            value={addonValue ?? "Nothing extra"}
            sub={
              addonExtra > 0
                ? `+${addonExtra} more`
                : addonValue
                  ? "Wants add-on"
                  : null
            }
          />
        </div>

        {/* Footer — calendar status + open chat */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          {ctx.datesOpen ? (
            <div className="flex items-center gap-2 text-[11.5px] text-brand-mute">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-primary" />
              Those dates are open on your calendar.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11.5px] text-status-pending">
              <Clock className="h-3.5 w-3.5" />
              Heads up — some of those dates are already blocked.
            </div>
          )}
          {ctx.conversationId ? (
            <Link
              href={`/dashboard/inbox?c=${ctx.conversationId}`}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand-line bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-brand-accent/40"
            >
              <MessageSquare className="h-3.5 w-3.5 text-brand-primary" />
              Open full chat
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Fact({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
        <span className="text-brand-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] font-bold text-brand-ink">
        {value}
      </div>
      {sub ? (
        <div className="truncate text-[10.5px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}
