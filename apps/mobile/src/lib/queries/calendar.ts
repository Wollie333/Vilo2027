import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type HostPropertyOption = { id: string; name: string };

async function fetchHostProperties(
  hostId: string,
): Promise<HostPropertyOption[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name")
    .eq("host_id", hostId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []) as HostPropertyOption[];
}

/** The host's properties (for the calendar property picker). */
export function useHostProperties(hostId: string | undefined) {
  return useQuery({
    queryKey: ["host", "properties", hostId],
    queryFn: () => fetchHostProperties(hostId as string),
    enabled: !!hostId,
  });
}

export type DayStatus = "open" | "booked" | "blocked";

export type CalendarData = {
  /** ISO date (yyyy-mm-dd) → status. */
  statusByDate: Record<string, DayStatus>;
  /** Dates that are manually blocked (deletable). */
  manualBlocked: Set<string>;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchCalendar(propertyId: string): Promise<CalendarData> {
  const [{ data: blocks, error: be }, { data: bookings, error: ke }] =
    await Promise.all([
      supabase
        .from("blocked_dates")
        .select("date, source")
        .eq("property_id", propertyId),
      supabase
        .from("bookings")
        .select("check_in, check_out, status")
        .eq("property_id", propertyId)
        .in("status", ["confirmed", "checked_in", "completed"]),
    ]);
  if (be) throw be;
  if (ke) throw ke;

  const statusByDate: Record<string, DayStatus> = {};
  const manualBlocked = new Set<string>();

  (bookings ?? []).forEach((b) => {
    if (!b.check_in || !b.check_out) return;
    const start = new Date(b.check_in);
    const end = new Date(b.check_out);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      statusByDate[isoDate(d)] = "booked";
    }
  });

  (blocks ?? []).forEach((row) => {
    const key = row.date.slice(0, 10);
    if (statusByDate[key] !== "booked") statusByDate[key] = "blocked";
    if (row.source === "manual") manualBlocked.add(key);
  });

  return { statusByDate, manualBlocked };
}

export function useCalendar(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["host", "calendar", propertyId],
    queryFn: () => fetchCalendar(propertyId as string),
    enabled: !!propertyId,
  });
}

/** Toggle a manual block on a single date — insert or delete a blocked_dates row. */
export function useToggleBlock(
  propertyId: string,
  createdBy: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      blocked,
    }: {
      date: string;
      blocked: boolean;
    }) => {
      if (blocked) {
        // Remove the manual block.
        const { error } = await supabase
          .from("blocked_dates")
          .delete()
          .eq("property_id", propertyId)
          .eq("date", date)
          .eq("source", "manual");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blocked_dates").insert({
          property_id: propertyId,
          date,
          source: "manual",
          created_by: createdBy ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["host", "calendar", propertyId] }),
  });
}
