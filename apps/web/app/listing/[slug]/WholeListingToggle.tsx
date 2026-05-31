"use client";

import { Home } from "lucide-react";

import { useRoomsCart } from "./RoomsCartProvider";

/**
 * "Book whole guesthouse · save X%" toggle shown in the room-picker header.
 * Selects/clears every room at once; the discount is applied server-side in
 * createBookingAction when all active rooms are booked together.
 */
export function WholeListingToggle({
  roomIds,
  discountPct,
}: {
  roomIds: string[];
  discountPct: number | null;
}) {
  const { mode, flexibleTab, selected, selectAll, clear } = useRoomsCart();

  const isRoomsTab = mode === "rooms_only" || flexibleTab === "rooms";
  if (!isRoomsTab || roomIds.length < 2) return null;

  const allSelected =
    roomIds.length > 0 && roomIds.every((id) => selected.has(id));
  const hasDiscount = discountPct != null && discountPct > 0;

  return (
    <button
      type="button"
      aria-pressed={allSelected}
      onClick={() => (allSelected ? clear() : selectAll(roomIds))}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-xs font-semibold transition-colors ${
        allSelected
          ? "border-brand-primary bg-brand-primary text-white"
          : "border-brand-primary/30 bg-brand-accent text-brand-secondary hover:bg-brand-primary hover:text-white"
      }`}
    >
      <Home className="h-3.5 w-3.5" />
      {allSelected
        ? hasDiscount
          ? `Booking whole guesthouse · ${discountPct}% off`
          : "Booking whole guesthouse"
        : hasDiscount
          ? `Book whole guesthouse · save ${discountPct}%`
          : "Book whole guesthouse"}
    </button>
  );
}
