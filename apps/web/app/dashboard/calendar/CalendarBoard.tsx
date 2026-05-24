"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleBlockedDateAction } from "./actions";
import { CalendarMonth, type CalendarBlock } from "./CalendarMonth";

// Client-side wrapper around the three CalendarMonth grids. Owns the
// in-memory block map so manual block/unblock feels instant — the server
// action persists in the background and any failure rolls the cell back.

export function CalendarBoard({
  listingId,
  roomScope,
  months,
  initialBlocks,
}: {
  listingId: string;
  // null = whole-listing scope (room_id IS NULL when writing manual blocks).
  // string = specific room id.
  roomScope: string | null;
  months: { year: number; month: number }[];
  initialBlocks: Array<[string, CalendarBlock]>;
}) {
  const [blocks, setBlocks] = useState<Map<string, CalendarBlock>>(
    () => new Map(initialBlocks),
  );
  const [pendingIso, setPendingIso] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(iso: string) {
    if (pendingIso) return; // one at a time keeps the UX honest
    const before = blocks.get(iso);
    const wasManual =
      before != null &&
      before.booking_id == null &&
      before.reason !== "quote_pending";

    // Optimistic local update.
    const next = new Map(blocks);
    if (wasManual) {
      next.delete(iso);
    } else if (before == null) {
      next.set(iso, { date: iso, reason: "manual", booking_id: null });
    } else {
      // Booked / quote — should be unreachable because CalendarMonth disables
      // clicks on those, but bail defensively.
      return;
    }
    setBlocks(next);
    setPendingIso(iso);

    startTransition(async () => {
      const result = await toggleBlockedDateAction(listingId, iso, roomScope);
      setPendingIso(null);
      if (!result.ok) {
        // Roll back.
        setBlocks(blocks);
        toast.error(result.error);
        return;
      }
      toast.success(result.data.nowBlocked ? "Date blocked" : "Date unblocked");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {months.map((m) => (
        <CalendarMonth
          key={`${m.year}-${m.month}`}
          year={m.year}
          month={m.month}
          blocks={blocks}
          onToggle={toggle}
          pendingIso={pendingIso}
        />
      ))}
    </div>
  );
}
