import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Read-only finance for the host. We mirror the web ledger's money rules (never
// fork them): "collected" counts only COMPLETED inbound payments; refunds are
// their own completed rows. No money is ever mutated from mobile (that stays in
// the server-side ledger / Edge Functions).

// Money-in kinds (vs outbound: refund, credit).
const INBOUND = new Set(["deposit", "balance", "addon", "payment"]);

export type HostPayment = {
  id: string;
  amount: number;
  currency: string;
  kind: string;
  method: string;
  status: string;
  created_at: string;
  booking_id: string;
  bookings: {
    reference: string;
    guest_name: string | null;
    properties: { name: string } | null;
  } | null;
};

const SELECT =
  "id, amount, currency, kind, method, status, created_at, booking_id, bookings!inner(host_id, reference, guest_name, properties(name))";

async function fetchHostPayments(hostId: string): Promise<HostPayment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select(SELECT)
    .eq("bookings.host_id", hostId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as HostPayment[];
}

export function useHostPayments(hostId: string | undefined) {
  return useQuery({
    queryKey: ["host", "payments", hostId],
    queryFn: () => fetchHostPayments(hostId as string),
    enabled: !!hostId,
  });
}

export type CashPosition = {
  collected: number;
  refunded: number;
  net: number;
  currency: string;
  /** booking_id → completed inbound collected (for outstanding math). */
  collectedByBooking: Record<string, number>;
};

/** Aggregate completed payments into a cash position (read-only SSOT mirror). */
export function summariseCash(
  payments: HostPayment[] | undefined,
): CashPosition {
  const list = payments ?? [];
  let collected = 0;
  let refunded = 0;
  const collectedByBooking: Record<string, number> = {};

  for (const p of list) {
    if (p.status !== "completed") continue;
    if (INBOUND.has(p.kind)) {
      collected += p.amount;
      collectedByBooking[p.booking_id] =
        (collectedByBooking[p.booking_id] ?? 0) + p.amount;
    } else if (p.kind === "refund") {
      refunded += p.amount;
    }
  }

  return {
    collected,
    refunded,
    net: collected - refunded,
    currency: list[0]?.currency ?? "ZAR",
    collectedByBooking,
  };
}

export function isInboundKind(kind: string): boolean {
  return INBOUND.has(kind);
}
