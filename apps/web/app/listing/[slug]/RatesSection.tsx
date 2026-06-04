import { BadgePercent, CalendarClock, Home, Info } from "lucide-react";

import { formatMoney } from "@/lib/format";

import type { PublicRoom } from "./roomDisplay";

export type SeasonRow = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  price: number;
  roomId: string | null;
  priority: number;
};

type SeasonGroup = {
  label: string;
  start: string;
  end: string;
  rows: SeasonRow[];
  isCurrent: boolean;
};

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Group rows by label and mark whichever season contains today. */
function groupSeasons(seasons: SeasonRow[]): SeasonGroup[] {
  const today = todayIso();
  const byLabel = new Map<string, SeasonRow[]>();
  for (const s of seasons) {
    const arr = byLabel.get(s.label) ?? [];
    arr.push(s);
    byLabel.set(s.label, arr);
  }
  const groups: SeasonGroup[] = [];
  for (const [label, rows] of byLabel) {
    const start = rows.reduce(
      (m, r) => (r.startDate < m ? r.startDate : m),
      rows[0].startDate,
    );
    const end = rows.reduce(
      (m, r) => (r.endDate > m ? r.endDate : m),
      rows[0].endDate,
    );
    groups.push({
      label,
      start,
      end,
      rows,
      isCurrent: today >= start && today <= end,
    });
  }
  return groups.sort((a, b) => a.start.localeCompare(b.start));
}

/** Seasonal nightly price for a room: room-scoped rule wins, else listing-wide. */
function priceForRoom(group: SeasonGroup, roomId: string): number | null {
  const scoped = group.rows.find((r) => r.roomId === roomId);
  if (scoped) return scoped.price;
  const wide = group.rows.find((r) => r.roomId === null);
  return wide ? wide.price : null;
}

function priceForWhole(group: SeasonGroup): number | null {
  const wide = group.rows.find((r) => r.roomId === null);
  return wide ? wide.price : null;
}

/**
 * Rates & seasonal pricing — fully data-driven from listing_seasonal_pricing.
 * Columns are the host's own season labels (not fixed Off/Std/Peak); the
 * "Standard" column is the room/listing base price. Server component.
 */
export function RatesSection({
  rooms,
  seasons,
  basePrice,
  weekendPrice,
  cleaningFee,
  currency,
  weeklyDiscountPct,
  childPrice = 0,
  petFee = 0,
}: {
  rooms: PublicRoom[];
  seasons: SeasonRow[];
  basePrice: number | null;
  weekendPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  weeklyDiscountPct: number | null;
  childPrice?: number;
  petFee?: number;
}) {
  const groups = groupSeasons(seasons);
  const hasRooms = rooms.length > 0;
  const current = groups.find((g) => g.isCurrent) ?? null;

  return (
    <section id="sec-rates" className="border-b border-brand-line py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            Pricing
          </div>
          <h3 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink lg:text-3xl">
            Rates &amp; seasonal pricing
          </h3>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-brand-mute">
            Prices below are per {hasRooms ? "room, " : ""}per night, in{" "}
            {currency}. The host sets seasonal tiers across the year.
          </p>
        </div>
      </div>

      {/* Current-season callout */}
      {current ? (
        <div className="mt-5 flex items-start gap-4 rounded-card border-2 border-amber-300/70 bg-gradient-to-r from-amber-50 to-white p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-amber-500 text-white">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-display font-bold text-brand-ink">
                Today falls in{" "}
                <span className="text-amber-700">{current.label}</span>
              </div>
              <span className="inline-flex items-center rounded-pill border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {fmtDay(current.start)} – {fmtDay(current.end)}
              </span>
            </div>
            <div className="mt-1 text-[13px] leading-relaxed text-brand-mute">
              Pick your dates in the calendar to see the exact nightly price for
              your stay.
            </div>
          </div>
        </div>
      ) : null}

      {/* Season legend cards */}
      {groups.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-card border border-brand-line bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
                <div className="font-display text-sm font-semibold text-brand-ink">
                  Standard
                </div>
              </div>
              <span className="rounded-pill border border-brand-line bg-brand-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-secondary">
                Baseline
              </span>
            </div>
            <div className="mt-2 text-xs leading-relaxed text-brand-mute">
              Applies on any date outside the seasons below.
            </div>
          </div>
          {groups.map((g) => (
            <div
              key={g.label}
              className={`relative rounded-card border p-4 ${
                g.isCurrent
                  ? "border-2 border-amber-300 bg-amber-50/50"
                  : "border-brand-line bg-white"
              }`}
            >
              {g.isCurrent ? (
                <span className="absolute -top-2 right-3 inline-flex items-center rounded-pill border border-amber-600 bg-amber-500 px-2 py-0.5 text-[9px] font-semibold text-white">
                  Current
                </span>
              ) : null}
              <div className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <div className="font-display text-sm font-semibold text-brand-ink">
                  {g.label}
                </div>
              </div>
              <div className="mt-2 text-xs leading-relaxed text-brand-mute">
                {fmtDay(g.start)} – {fmtDay(g.end)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Rate card table */}
      <div className="mt-6 overflow-hidden rounded-card border border-brand-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-line bg-brand-light px-5 py-3.5">
          <div className="font-display text-sm font-semibold text-brand-ink">
            Rate card · per {hasRooms ? "room / " : ""}night
          </div>
          {cleaningFee && cleaningFee > 0 ? (
            <div className="inline-flex items-center gap-1.5 text-[11px] text-brand-mute">
              <Info className="h-3 w-3" />
              Cleaning fee ({formatMoney(cleaningFee, currency)}) and any
              add-ons are separate
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
                <th className="px-5 py-3 font-semibold">
                  {hasRooms ? "Room" : "Stay"}
                </th>
                <th className="px-4 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand-primary" />
                    Standard
                  </span>
                </th>
                {groups.map((g) => (
                  <th key={g.label} className="px-4 py-3 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      {g.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {hasRooms ? (
                rooms.map((room) => (
                  <tr
                    key={room.id}
                    className="transition-colors hover:bg-brand-light/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-display font-semibold text-brand-ink">
                        {room.name}
                      </div>
                      <div className="text-[11px] text-brand-mute">
                        sleeps {room.max_guests}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-brand-ink">
                      {formatMoney(room.base_price, currency)}
                    </td>
                    {groups.map((g) => {
                      const p = priceForRoom(g, room.id);
                      return (
                        <td
                          key={g.label}
                          className="px-4 py-3.5 font-mono text-amber-800"
                        >
                          {p != null
                            ? formatMoney(p, currency)
                            : formatMoney(room.base_price, currency)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr className="transition-colors hover:bg-brand-light/40">
                  <td className="px-5 py-3.5">
                    <div className="inline-flex items-center gap-2 font-display font-semibold text-brand-ink">
                      <Home className="h-4 w-4 text-brand-primary" /> Whole
                      place
                    </div>
                    {weekendPrice != null ? (
                      <div className="text-[11px] text-brand-mute">
                        Weekends {formatMoney(weekendPrice, currency)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-medium text-brand-ink">
                    {basePrice != null ? formatMoney(basePrice, currency) : "—"}
                  </td>
                  {groups.map((g) => {
                    const p = priceForWhole(g);
                    return (
                      <td
                        key={g.label}
                        className="px-4 py-3.5 font-mono text-amber-800"
                      >
                        {p != null
                          ? formatMoney(p, currency)
                          : basePrice != null
                            ? formatMoney(basePrice, currency)
                            : "—"}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {childPrice > 0 || petFee > 0 ? (
          <div className="border-t border-brand-line bg-brand-light/30 px-5 py-3 text-[11px] text-brand-mute">
            <span className="font-medium text-brand-ink">Extras</span> —{" "}
            {[
              childPrice > 0
                ? `children ${formatMoney(childPrice, currency)}/night`
                : null,
              petFee > 0 ? `pets ${formatMoney(petFee, currency)}/night` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            , charged per night on top of the rate.
          </div>
        ) : null}
        {weeklyDiscountPct && weeklyDiscountPct > 0 ? (
          <div className="border-t border-brand-line bg-brand-light/30 px-5 py-3">
            <div className="inline-flex items-start gap-1.5 text-[11px] leading-relaxed text-brand-mute">
              <BadgePercent className="mt-0.5 h-3.5 w-3.5 text-brand-primary" />
              <span>
                <span className="font-medium text-brand-ink">
                  Weekly stay discount
                </span>{" "}
                — {weeklyDiscountPct}% off when you stay 7+ nights, applied
                automatically at checkout.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
