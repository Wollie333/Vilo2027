import {
  ArrowDownLeft,
  CalendarDays,
  Check,
  CheckCheck,
  FileText,
  Lock,
  MapPin,
  Paperclip,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

// Faithful "product preview" illustrations for the host pitch deck. These mirror
// the real app UI (same brand tokens + className recipes) but are static visual
// chrome — like an in-deck screenshot — so they carry no live data or auth deps.
// Slide narrative/copy is translated in PitchDeck; the sample labels here are
// mockup content (treated like screenshot pixels), kept realistic and minimal.

// App-window frame so previews read as "the product".
export function Frame({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-card border border-brand-line bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 border-b border-brand-line bg-brand-light/70 px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ef5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#f5bf4f]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#62c554]" />
        <span className="ml-2 truncate font-mono text-[11px] text-brand-mute">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-mute">
          {label}
        </span>
        {delta ? (
          <span className="inline-flex items-center gap-0.5 rounded-pill bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
            <TrendingUp className="h-3 w-3" />
            {delta}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 font-display text-[22px] font-bold leading-none text-brand-ink">
        {value}
      </div>
    </div>
  );
}

// --- Dashboard ------------------------------------------------------------

export function DashboardPreview() {
  const bars = [38, 52, 44, 67, 59, 80, 72, 90];
  return (
    <Frame title="app.vilo.co.za/dashboard">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Revenue (mo)" value="R 84,200" delta="+18%" />
        <Kpi label="Bookings" value="27" delta="+6" />
        <Kpi label="Occupancy" value="86%" delta="+9%" />
        <Kpi label="Avg rating" value="4.9" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div className="text-[11px] font-semibold text-brand-ink">
            Revenue this month
          </div>
          <div className="mt-3 flex h-24 items-end gap-2">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-brand-primary/80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
          <div className="text-[11px] font-semibold text-brand-ink">
            Arriving soon
          </div>
          <ul className="mt-2.5 space-y-2.5">
            {[
              { n: "T. Mokoena", d: "Tonight · 3 nights" },
              { n: "S. Naidoo", d: "Fri · 2 nights" },
              { n: "L. Botha", d: "Sat · 5 nights" },
            ].map((g) => (
              <li key={g.n} className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-secondary text-[10px] font-bold text-white">
                  {g.n.split(" ").map((p) => p[0])}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-brand-ink">
                    {g.n}
                  </div>
                  <div className="text-[10.5px] text-brand-mute">{g.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

// --- Payments ledger ------------------------------------------------------

export function LedgerPreview() {
  const rows = [
    {
      note: "Deposit received",
      ref: "Paystack · ch_8H2",
      type: "Payment",
      typeCls: "border-emerald-200 bg-emerald-50 text-emerald-700",
      amount: "R 2,400",
      amountCls: "text-emerald-700",
      doc: "INV-001",
    },
    {
      note: "Balance due",
      ref: "Due before check-in",
      type: "Charge",
      typeCls: "border-sky-200 bg-sky-50 text-sky-700",
      amount: "R 3,600",
      amountCls: "text-amber-700",
      doc: "INV-002",
    },
    {
      note: "Add-on · late check-in",
      ref: "EFT · proof uploaded",
      type: "Payment",
      typeCls: "border-emerald-200 bg-emerald-50 text-emerald-700",
      amount: "R 450",
      amountCls: "text-emerald-700",
      doc: "INV-003",
    },
  ];
  return (
    <Frame title="app.vilo.co.za/dashboard/finances">
      <div className="overflow-hidden rounded-card border border-brand-line">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-brand-line bg-brand-light/60 text-[9.5px] font-semibold uppercase tracking-wider text-brand-mute">
              <th className="px-3 py-2 text-left">Transaction</th>
              <th className="px-2 py-2 text-left">Type</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Doc</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.note}
                className="border-b border-brand-line/70 last:border-0"
              >
                <td className="px-3 py-2.5">
                  <div className="font-medium text-brand-ink">{r.note}</div>
                  <div className="text-[10px] text-brand-mute">{r.ref}</div>
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={`inline-flex rounded-pill border px-2 py-0.5 text-[10px] font-semibold ${r.typeCls}`}
                  >
                    {r.type}
                  </span>
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums ${r.amountCls}`}
                >
                  {r.amount}
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1 rounded border border-brand-line px-1.5 py-0.5 text-[10px] font-medium text-brand-secondary">
                    <FileText className="h-3 w-3" />
                    {r.doc}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-card bg-brand-light px-3.5 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          Paid straight to your account
        </span>
        <span className="font-display text-[15px] font-bold text-brand-ink">
          R 6,450 collected
        </span>
      </div>
    </Frame>
  );
}

// --- Inbox ----------------------------------------------------------------

export function InboxPreview() {
  return (
    <Frame title="app.vilo.co.za/dashboard/inbox">
      <div className="rounded-card bg-[#E6EFE9] p-3">
        <div className="flex justify-center pb-2">
          <span className="rounded-lg bg-[#DCEAE0] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#3F6155]">
            Today
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-[9px] rounded-tl-sm bg-white px-2.5 py-1.5 text-[13px] leading-relaxed text-[#0C2A1E] shadow-sm">
              Hi! Is the cottage available for the long weekend? 🙂
              <span className="float-right ml-2.5 mt-2 font-mono text-[9px] text-[#6B8B7F]">
                09:14
              </span>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-[9px] rounded-tr-sm bg-[#C7EFD7] px-2.5 py-1.5 text-[13px] leading-relaxed text-[#0C2A1E] shadow-sm">
              It is! I&apos;ve held the dates for you — here&apos;s a secure
              booking link.
              <span className="float-right ml-2.5 mt-2 inline-flex items-center gap-1 font-mono text-[9px] text-[#6B8B7F]">
                09:16 <CheckCheck className="h-3 w-3 text-sky-500" />
              </span>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-[9px] rounded-tr-sm bg-[#C7EFD7] px-2.5 py-1.5 text-[13px] leading-relaxed text-[#0C2A1E] shadow-sm">
              <span className="flex items-center gap-1.5 font-medium text-brand-primary">
                <Paperclip className="h-3.5 w-3.5" />
                booking-confirmation.pdf
              </span>
              <span className="float-right ml-2.5 mt-2 inline-flex items-center gap-1 font-mono text-[9px] text-[#6B8B7F]">
                09:16 <Check className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// --- Calendar -------------------------------------------------------------

export function CalendarPreview() {
  // 5 weeks × 7 days, illustrative state map keyed by cell index.
  const days = Array.from({ length: 35 }, (_, i) => i - 2); // offset so month starts mid-row
  const booked = new Set([6, 7, 8, 13, 14, 20, 21, 22, 27]);
  const blocked = new Set([16, 17]);
  return (
    <Frame title="app.vilo.co.za/dashboard/calendar">
      <div className="overflow-hidden rounded-card border border-brand-line">
        <div className="grid grid-cols-7 border-b border-brand-line bg-brand-light/60">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div
              key={i}
              className="px-2 py-1.5 text-center text-[9.5px] font-bold uppercase tracking-wide text-[#7C9A8C]"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const inMonth = day >= 1 && day <= 30;
            const isBooked = booked.has(i);
            const isBlocked = blocked.has(i);
            return (
              <div
                key={i}
                className="relative border-b border-r border-[#EDF3EF] last:border-r-0"
                style={{ minHeight: "44px" }}
              >
                <div className="px-1.5 pt-1 text-[10px] font-semibold tabular-nums text-[#3A5A4E]">
                  {inMonth ? day : ""}
                </div>
                {isBooked ? (
                  <div className="mx-1 mt-0.5 h-3.5 rounded bg-brand-primary" />
                ) : null}
                {isBlocked ? (
                  <div
                    className="mx-1 mt-0.5 flex h-3.5 items-center justify-center rounded"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg,#9CA3AF,#9CA3AF 4px,#aeb5bd 4px,#aeb5bd 8px)",
                    }}
                  >
                    <Lock className="h-2 w-2 text-white" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[10.5px] text-brand-mute">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-brand-primary" /> Booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-sm"
            style={{
              background:
                "repeating-linear-gradient(45deg,#9CA3AF,#9CA3AF 4px,#aeb5bd 4px,#aeb5bd 8px)",
            }}
          />
          Blocked
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-medium text-brand-secondary">
          <CalendarDays className="h-3.5 w-3.5" /> Synced with Airbnb &amp;
          Booking.com
        </span>
      </div>
    </Frame>
  );
}

// --- Listing card (directory) --------------------------------------------

export function ListingCardPreview() {
  return (
    <Frame title="vilo.co.za/explore">
      <div className="grid grid-cols-2 gap-3">
        {[
          { name: "Karoo Stone Cottage", loc: "Prince Albert", price: "1,450" },
          {
            name: "Drakensberg Lodge",
            loc: "Champagne Valley",
            price: "2,200",
          },
        ].map((l, idx) => (
          <div key={l.name} className="overflow-hidden rounded-card">
            <div className="relative aspect-[4/3] overflow-hidden rounded-card">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    idx === 0
                      ? "linear-gradient(135deg,#10B981,#064E3B)"
                      : "linear-gradient(135deg,#0EA5E9,#064E3B)",
                }}
              />
              <span className="absolute left-2.5 top-2.5 rounded-pill bg-brand-secondary px-2 py-0.5 text-[9.5px] font-bold text-white">
                Direct booking
              </span>
            </div>
            <div className="pt-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="truncate font-display text-[13px] font-semibold text-brand-ink">
                  {l.name}
                </div>
                <div className="flex shrink-0 items-center gap-0.5 text-[11px]">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-brand-ink">4.9</span>
                </div>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-brand-mute">
                <MapPin className="h-3 w-3" />
                {l.loc}
              </div>
              <div className="mt-1.5 font-display text-[13px] font-bold text-brand-ink">
                R {l.price}{" "}
                <span className="text-[10.5px] font-normal text-brand-mute">
                  / night
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// --- Reviews --------------------------------------------------------------

function StarRow({ n = 5 }: { n?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < n ? "fill-amber-400 text-amber-400" : "text-brand-line"}`}
        />
      ))}
    </span>
  );
}

export function ReviewsPreview() {
  const reviews = [
    {
      initials: "TM",
      name: "Thandi M.",
      meta: "Karoo Stone Cottage · 3 nights",
      body: "Booked straight with the host, paid securely, no surprise fees. The place was exactly as shown — we'll be back.",
    },
    {
      initials: "SN",
      name: "Sipho N.",
      meta: "Drakensberg Lodge · 2 nights",
      body: "Loved dealing with the owner directly. Quick replies and a smooth check-in.",
    },
  ];
  return (
    <Frame title="vilo.co.za/your-page">
      <div className="space-y-3">
        {reviews.map((r) => (
          <article
            key={r.name}
            className="rounded-card border border-brand-line bg-white p-3.5 shadow-card"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-secondary text-[11px] font-bold text-white">
                {r.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-[13px] font-semibold text-brand-ink">
                      {r.name}
                    </div>
                    <div className="text-[10.5px] text-brand-mute">
                      {r.meta}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <StarRow />
                    <div className="mt-0.5 text-[9.5px] text-brand-mute">
                      via Vilo direct
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-brand-ink">
                  {r.body}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Frame>
  );
}

// --- Booking card ---------------------------------------------------------

export function BookingCardPreview() {
  return (
    <Frame title="app.vilo.co.za/dashboard/bookings">
      <div className="rounded-card border border-brand-line bg-white p-3.5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary text-[11px] font-bold text-white">
              LB
            </span>
            <div>
              <div className="font-display text-[13px] font-semibold text-brand-ink">
                Lerato Botha
              </div>
              <div className="flex items-center gap-1 text-[10.5px] text-brand-mute">
                <Users className="h-3 w-3" /> 4 guests
              </div>
            </div>
          </div>
          <span className="inline-flex items-center rounded-pill bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
            Confirmed
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-brand-mute">Check-in</div>
            <div className="font-semibold text-brand-ink">Fri 18 Jul</div>
          </div>
          <div>
            <div className="text-brand-mute">Check-out</div>
            <div className="font-semibold text-brand-ink">Wed 23 Jul</div>
          </div>
          <div>
            <div className="text-brand-mute">Total</div>
            <div className="font-semibold text-brand-ink">R 7,250</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-brand-line pt-3">
          <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <ArrowDownLeft className="h-3 w-3" /> Deposit paid
          </span>
          <span className="text-[10.5px] text-brand-mute">
            Balance R 3,600 due before check-in
          </span>
        </div>
      </div>
    </Frame>
  );
}
