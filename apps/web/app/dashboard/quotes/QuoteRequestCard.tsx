import { CalendarDays, Inbox, Quote as QuoteIcon, Users } from "lucide-react";

// Read-only context card shown at the top of the quote form when a quote
// originated from a guest's public "Request a quote" enquiry. It snapshots what
// the visitor actually asked for — their message, dates, party and scope — so
// the host has that context in front of them while pricing the quote. The form
// fields below are editable; this card never changes.

export type QuoteRequestContext = {
  guestName: string | null;
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
  roomCount: number;
  message: string | null;
  requestedAt: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
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

export function QuoteRequestCard({ ctx }: { ctx: QuoteRequestContext }) {
  const nights = nightsBetween(ctx.checkIn, ctx.checkOut);
  const firstName = ctx.guestName?.split(" ")[0] ?? "the guest";
  const scopeLabel =
    ctx.scope === "rooms"
      ? `${ctx.roomCount || ""} room${ctx.roomCount === 1 ? "" : "s"}`.trim()
      : "Whole place";

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      {/* Header — tinted accent marks this as the incoming guest request */}
      <div className="flex items-center gap-2 border-b border-brand-line bg-brand-accent/40 px-6 py-4">
        <Inbox className="h-4 w-4 text-brand-primary" />
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold text-brand-ink">
            {firstName}&rsquo;s request
          </div>
          <div className="mt-0.5 text-[12px] text-brand-secondary">
            What they asked for when they enquired
            {ctx.requestedAt ? ` · ${fmtDateTime(ctx.requestedAt)}` : ""}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {/* Guest's own words */}
        {ctx.message ? (
          <div className="flex gap-3 rounded-[12px] border border-brand-line bg-brand-light/50 p-4">
            <QuoteIcon className="h-4 w-4 shrink-0 text-brand-primary" />
            <p className="text-[13.5px] leading-relaxed text-brand-ink">
              {ctx.message}
            </p>
          </div>
        ) : null}

        {/* Structured request facts */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Fact
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="Requested dates"
            value={`${fmtDate(ctx.checkIn)} → ${fmtDate(ctx.checkOut)}`}
            sub={
              nights != null
                ? `${nights} night${nights === 1 ? "" : "s"}`
                : null
            }
          />
          <Fact
            icon={<Users className="h-3.5 w-3.5" />}
            label="Party"
            value={partyLabel(ctx.party, ctx.headcount)}
          />
          <Fact
            icon={<Inbox className="h-3.5 w-3.5" />}
            label="Scope"
            value={scopeLabel}
          />
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
    <div className="rounded-[12px] border border-brand-line px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-mute">
        <span className="text-brand-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold text-brand-ink">
        {value}
      </div>
      {sub ? <div className="text-[11.5px] text-brand-mute">{sub}</div> : null}
    </div>
  );
}
