const DEMO_BOOKINGS = [
  {
    name: "Lerato Dlamini",
    listing: "Sea Point Suite",
    ref: "WIELO-2026-CT4912",
    range: "12 Jun → 15 Jun",
    amount: "R 4 200",
    initial: "LD",
  },
  {
    name: "Marco Lehmann",
    listing: "Garden Cottage",
    ref: "WIELO-2026-CT4908",
    range: "18 Jun → 22 Jun",
    amount: "R 6 800",
    initial: "ML",
  },
  {
    name: "Aisha Patel",
    listing: "Sea Point Suite",
    ref: "WIELO-2026-CT4901",
    range: "24 Jun → 27 Jun",
    amount: "R 3 950",
    initial: "AP",
  },
];

// 28-cell calendar mini-grid. Each entry is a colour-class for the cell.
// The design uses brand-primary (booked), brand-secondary (iCal booked),
// brand-accent (held), brand-light (open).
const CALENDAR_CELLS = [
  "bg-brand-light border border-brand-line",
  "bg-brand-light border border-brand-line",
  "bg-brand-light border border-brand-line",
  "bg-brand-light border border-brand-line",
  "bg-brand-light border border-brand-line",
  "bg-brand-accent",
  "bg-brand-accent",
  "bg-brand-primary",
  "bg-brand-primary",
  "bg-brand-primary",
  "bg-brand-accent",
  "bg-brand-light border border-brand-line",
  "bg-brand-accent",
  "bg-brand-accent",
  "bg-brand-primary",
  "bg-brand-primary",
  "bg-brand-primary",
  "bg-brand-primary",
  "bg-brand-secondary",
  "bg-brand-secondary",
  "bg-brand-secondary",
  "bg-brand-primary",
  "bg-brand-light border border-brand-line",
  "bg-brand-light border border-brand-line",
  "bg-brand-accent",
  "bg-brand-primary",
  "bg-brand-primary",
  "bg-brand-light border border-brand-line",
];

export function DashboardPreview() {
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-3 border-b border-brand-line px-6 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Preview
          </div>
          <div className="mt-0.5 font-display text-[15px] font-bold text-brand-ink">
            Once your listing is live, your dashboard fills up like this
          </div>
        </div>
        <span className="ml-auto rounded-pill bg-brand-accent px-2.5 py-1 text-[10.5px] font-semibold text-brand-secondary">
          Demo data
        </span>
      </div>

      <div className="grid gap-0 divide-y divide-brand-line md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="p-6 opacity-90">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Recent bookings
          </div>
          <ul className="mt-3 divide-y divide-brand-line">
            {DEMO_BOOKINGS.map((b) => (
              <li key={b.ref} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-brand-accent text-[11px] font-semibold text-brand-secondary">
                  {b.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-brand-ink">
                    {b.name} · {b.listing}
                  </div>
                  <div className="font-mono text-[10.5px] text-brand-mute">
                    {b.ref} · {b.range}
                  </div>
                </div>
                <div className="num font-display text-[13px] font-bold text-brand-ink">
                  {b.amount}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-6 opacity-90">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            June occupancy
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 font-mono text-[10px]">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} className="text-center text-brand-mute">
                {d}
              </div>
            ))}
            {CALENDAR_CELLS.map((cls, i) => (
              <div key={i} className={`aspect-square rounded-[4px] ${cls}`} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[10.5px] text-brand-mute">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-brand-primary" />
              Booked
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-brand-secondary" />
              iCal
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-brand-accent" />
              Held
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm border border-brand-line bg-brand-light" />
              Open
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
