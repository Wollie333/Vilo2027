import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Trip = {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  guests_count: number;
  total_amount: number;
  currency: string;
  properties: {
    name: string;
    slug: string | null;
    city: string | null;
    property_photos: {
      url: string;
      sort_order: number;
      room_id: string | null;
    }[];
  } | null;
};

const TRIP_SELECT =
  "id, reference, status, payment_status, check_in, check_out, nights, guests_count, total_amount, currency, properties(name, slug, city, property_photos(url, sort_order, room_id))";

async function fetchTrips(guestId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(TRIP_SELECT)
    .eq("guest_id", guestId)
    .order("check_in", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Trip[];
}

/** Bookings belonging to the signed-in guest (My Trips). */
export function useTrips(guestId: string | undefined) {
  return useQuery({
    queryKey: ["trips", guestId],
    queryFn: () => fetchTrips(guestId as string),
    enabled: !!guestId,
  });
}

async function fetchTrip(id: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(TRIP_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Trip | null) ?? null;
}

/** A single booking (trip detail). */
export function useTripDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["trips", "detail", id],
    queryFn: () => fetchTrip(id as string),
    enabled: !!id,
  });
}

const PAST_STATUSES = new Set([
  "completed",
  "cancelled",
  "declined",
  "checked_out",
]);

export function isPastTrip(trip: Trip): boolean {
  if (PAST_STATUSES.has(trip.status)) return true;
  if (trip.check_out) return new Date(trip.check_out) < new Date();
  return false;
}
