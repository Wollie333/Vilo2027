import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type HostBooking = {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  guests_count: number;
  guest_name: string | null;
  guest_email: string | null;
  total_amount: number;
  currency: string;
  created_at: string;
  properties: { name: string } | null;
};

const HOST_BOOKING_SELECT =
  "id, reference, status, payment_status, check_in, check_out, nights, guests_count, guest_name, guest_email, total_amount, currency, created_at, properties(name)";

async function fetchHostBookings(hostId: string): Promise<HostBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(HOST_BOOKING_SELECT)
    .eq("host_id", hostId)
    .order("check_in", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as HostBooking[];
}

/** All bookings for a host (drives Bookings list + Overview KPIs). */
export function useHostBookings(hostId: string | undefined) {
  return useQuery({
    queryKey: ["host", "bookings", hostId],
    queryFn: () => fetchHostBookings(hostId as string),
    enabled: !!hostId,
  });
}

async function fetchHostBooking(id: string): Promise<HostBooking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(HOST_BOOKING_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as HostBooking | null) ?? null;
}

export function useHostBooking(id: string | undefined) {
  return useQuery({
    queryKey: ["host", "booking", id],
    queryFn: () => fetchHostBooking(id as string),
    enabled: !!id,
  });
}

export type HostKpis = {
  upcoming: HostBooking[];
  pendingCount: number;
  confirmedCount: number;
  revenue: number;
  currency: string;
};

const CONFIRMED = new Set(["confirmed", "checked_in", "completed"]);

/** Derive Overview KPIs from the host's bookings (revenue = confirmed/checked-in/completed). */
export function deriveKpis(bookings: HostBooking[] | undefined): HostKpis {
  const list = bookings ?? [];
  const now = Date.now();
  const upcoming = list
    .filter(
      (b) =>
        CONFIRMED.has(b.status) &&
        b.check_in &&
        new Date(b.check_in).getTime() >= now,
    )
    .sort(
      (a, b) =>
        new Date(a.check_in!).getTime() - new Date(b.check_in!).getTime(),
    );

  return {
    upcoming,
    pendingCount: list.filter((b) => b.status === "pending").length,
    confirmedCount: list.filter((b) => CONFIRMED.has(b.status)).length,
    revenue: list
      .filter((b) => CONFIRMED.has(b.status))
      .reduce((sum, b) => sum + (b.total_amount ?? 0), 0),
    currency: list[0]?.currency ?? "ZAR",
  };
}
