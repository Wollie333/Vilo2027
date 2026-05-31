"use client";

import { useMemo } from "react";

import { applyStayDiscounts } from "./pricing";
import { useRoomsCart } from "./RoomsCartProvider";
import {
  roomFromNightly,
  roomNightlyBase,
  type PublicRoom,
} from "./roomDisplay";

function fmtR(n: number, currency: string): string {
  return `${currency === "ZAR" ? "R " : ""}${Math.round(n)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function nightsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(f) || !Number.isFinite(t)) return 0;
  const n = Math.round((t - f) / (1000 * 60 * 60 * 24));
  return n > 0 ? n : 0;
}

/**
 * Mobile-only sticky booking bar (lg:hidden) for rooms/flexible listings,
 * mirroring the cart sidebar's price + reserve state. Falls back to a "From"
 * price that jumps to the room picker when nothing is selected yet.
 */
export function MobileBookingBar({
  slug,
  rooms,
  currency,
  basePrice,
  cleaningFee,
  wholeDiscountPct,
  weeklyDiscountPct,
  monthlyDiscountPct,
  maxGuestsCap,
}: {
  slug: string;
  rooms: PublicRoom[];
  currency: string;
  basePrice: number | null;
  cleaningFee: number | null;
  wholeDiscountPct: number | null;
  weeklyDiscountPct: number | null;
  monthlyDiscountPct: number | null;
  maxGuestsCap: number;
}) {
  const { mode, flexibleTab, selected, roomGuests, checkIn, checkOut, guests } =
    useRoomsCart();
  const nights = nightsBetween(checkIn, checkOut);
  const isRoomsTab = mode === "rooms_only" || flexibleTab === "rooms";

  const selectedRooms = useMemo(
    () => rooms.filter((r) => selected.has(r.id)),
    [rooms, selected],
  );
  const guestsFor = (id: string) => Math.max(1, roomGuests[id] ?? 1);

  const minPrice = useMemo(() => {
    const ps = rooms.map((r) => roomFromNightly(r)).filter((p) => p > 0);
    return ps.length > 0 ? Math.min(...ps) : basePrice;
  }, [rooms, basePrice]);

  const total = useMemo(() => {
    if (isRoomsTab) {
      const base = selectedRooms.reduce(
        (a, r) => a + roomNightlyBase(r, guestsFor(r.id)) * nights,
        0,
      );
      const clean = selectedRooms.reduce(
        (a, r) => a + (nights > 0 ? r.cleaning_fee : 0),
        0,
      );
      return applyStayDiscounts({
        base,
        cleaning: clean,
        nights,
        isWholeCombo:
          selectedRooms.length > 1 && selectedRooms.length === rooms.length,
        wholePct: wholeDiscountPct,
        weeklyPct: weeklyDiscountPct,
        monthlyPct: monthlyDiscountPct,
      }).total;
    }
    const base = (basePrice ?? 0) * nights;
    const clean = nights > 0 ? (cleaningFee ?? 0) : 0;
    return applyStayDiscounts({
      base,
      cleaning: clean,
      nights,
      isWholeCombo: false,
      wholePct: null,
      weeklyPct: weeklyDiscountPct,
      monthlyPct: monthlyDiscountPct,
    }).total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoomsTab, selectedRooms, nights, roomGuests, basePrice, cleaningFee]);

  const ready = isRoomsTab
    ? selectedRooms.length > 0 && nights > 0
    : nights > 0 && basePrice != null && guests <= maxGuestsCap;

  const href = useMemo(() => {
    const p = new URLSearchParams();
    if (checkIn) p.set("from", checkIn);
    if (checkOut) p.set("to", checkOut);
    if (isRoomsTab && selectedRooms.length > 0) {
      p.set("room_ids", selectedRooms.map((r) => r.id).join(","));
      p.set(
        "room_guests",
        selectedRooms.map((r) => `${r.id}:${guestsFor(r.id)}`).join(","),
      );
      p.set(
        "guests",
        String(selectedRooms.reduce((a, r) => a + guestsFor(r.id), 0)),
      );
    } else {
      p.set("guests", String(guests));
    }
    return `/listing/${encodeURIComponent(slug)}/book?${p.toString()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, isRoomsTab, selectedRooms, roomGuests, guests, slug]);

  return (
    <div className="shadow-float fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-brand-line bg-white px-4 py-3 lg:hidden">
      <div className="min-w-0 flex-1">
        {ready ? (
          <div className="font-display text-base font-bold text-brand-ink">
            {fmtR(total, currency)}{" "}
            <span className="text-xs font-normal text-brand-mute">
              total · {nights} {nights === 1 ? "night" : "nights"}
            </span>
          </div>
        ) : (
          <div className="font-display text-base font-bold text-brand-ink">
            {minPrice != null
              ? `From ${fmtR(minPrice, currency)}`
              : "Price on request"}{" "}
            <span className="text-xs font-normal text-brand-mute">/ night</span>
          </div>
        )}
        <div className="truncate text-[11px] text-brand-mute">
          {isRoomsTab
            ? selectedRooms.length === 0
              ? "Select your room(s)"
              : nights === 0
                ? "Add your dates"
                : `${selectedRooms.length} room${selectedRooms.length === 1 ? "" : "s"} selected`
            : nights === 0
              ? "Add your dates"
              : "You won't be charged yet"}
        </div>
      </div>
      {ready ? (
        <a
          href={href}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          Reserve
        </a>
      ) : (
        <a
          href={isRoomsTab ? "#sec-rooms" : "#sec-calendar"}
          className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-secondary"
        >
          {isRoomsTab ? "Select room" : "Add dates"}
        </a>
      )}
    </div>
  );
}
