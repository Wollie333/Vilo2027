import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Host booking status actions (Phase 6a). A booking's business side-effects
// (calendar block on confirm, invoice mint, party materialize on confirm; block
// release on decline) all live in DB triggers that fire AFTER UPDATE OF status
// — so a single guarded status UPDATE drives the exact same orchestration the
// web Server Actions do. We DON'T fork that logic; RLS (host_manage_own_bookings)
// scopes the write to the host's own bookings, and the `.eq("status", from)`
// guard makes the transition safe (no double-confirm / racing).

export type BookingStatusChange = "confirmed" | "declined";

/**
 * Move a pending booking to confirmed (accept) or declined. Guarded on the
 * current status so it only ever transitions from `pending`.
 */
export function useSetBookingStatus(
  hostId: string | undefined,
  bookingId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: BookingStatusChange) => {
      const { data, error } = await supabase
        .from("bookings")
        .update({ status: next })
        .eq("id", bookingId)
        .eq("host_id", hostId ?? "")
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      // No row updated → it wasn't pending any more (someone else acted / stale).
      if (!data) throw new Error("not_pending");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["host", "booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["host", "bookings", hostId] });
      // Confirm blocks calendar dates / decline releases them.
      qc.invalidateQueries({ queryKey: ["host", "calendar"] });
    },
  });
}
