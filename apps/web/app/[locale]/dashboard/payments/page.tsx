import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  fetchHostTransactions,
  txnFlows,
  txnStats,
} from "@/lib/finance/transactions";
import { getMyHostId } from "@/lib/host/current";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwOnError } from "@/lib/supabase/query";
import { createServerClient } from "@/lib/supabase/server";

import {
  PaymentsBoard,
  type PaymentKpis,
  type PaymentRow,
} from "./PaymentsBoard";

export const metadata: Metadata = {
  title: "Payments",
};

export const dynamic = "force-dynamic";

// Nested shapes returned by the Supabase join.
type RawListing = {
  name: string;
  property_photos: { url: string; sort_order: number }[] | null;
};
type RawBooking = {
  id: string;
  reference: string;
  guest_name: string | null;
  guest_email: string | null;
  guest: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  listing: RawListing;
};
type RawPayment = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  kind: string | null;
  voided_at: string | null;
  provider_reference: string | null;
  refunded_amount: number | null;
  captured_at: string | null;
  created_at: string;
  booking: RawBooking;
};

export default async function PaymentsPage() {
  const supabase = createServerClient();
  const myHostId = await getMyHostId(supabase);
  if (!myHostId) notFound();

  // Scope to this host's bookings (RLS alone would let admin/staff see all).
  const data = await throwOnError(
    supabase
      .from("payments")
      .select(
        "id, amount, currency, method, status, kind, voided_at, provider_reference, refunded_amount, captured_at, created_at, booking:bookings!inner ( id, reference, guest_name, guest_email, listing:properties!inner ( name, property_photos ( url, sort_order ) ), guest:user_profiles!bookings_guest_id_fkey ( full_name, email, avatar_url ) )",
      )
      .eq("booking.host_id", myHostId)
      .order("created_at", { ascending: false })
      .limit(400),
    "dashboard/payments",
  );

  const raw = (data ?? []) as unknown as RawPayment[];

  const rows: PaymentRow[] = raw.map((p) => {
    const b = p.booking;
    const photos = b.listing.property_photos ?? [];
    const thumb =
      photos.length > 0
        ? [...photos].sort((a, c) => a.sort_order - c.sort_order)[0].url
        : null;
    const guestName =
      b.guest?.full_name ||
      b.guest_name ||
      b.guest?.email ||
      b.guest_email ||
      "Guest";
    return {
      id: p.id,
      bookingId: b.id,
      bookingRef: b.reference,
      guestName,
      guestAvatar: b.guest?.avatar_url ?? null,
      listingName: b.listing.name,
      listingThumb: thumb,
      method: p.method,
      status: p.status,
      amount: Number(p.amount),
      currency: p.currency,
      providerRef: p.provider_reference,
      createdAt: p.created_at,
      capturedAt: p.captured_at,
    };
  });

  // ── KPIs ──
  // Money totals come from the ONE canonical aggregator (fetchHostTransactions →
  // txnFlows/txnStats) — the same source the Ledger and Reports use — so
  // "Collected" and "Refunds" read identically across every host money window
  // (REPORTING_SINGLE_SOURCE_PLAN.md DECISION 3, AGENT_RULES §4.7). "Collected"
  // is therefore GROSS CASH (deposit/balance/addon/payment), refunds a SEPARATE
  // line, and applied store credit is NOT counted as cash. sumPaidFromRows stays
  // the per-booking settlement rule only (balance_due / payment_status), never a
  // reporting total.
  const admin = createAdminClient();
  const ledger = await fetchHostTransactions(admin, { hostId: myHostId });
  const flows = txnFlows(ledger);
  const stats = txnStats(ledger);
  // Count of settled cash-in entries behind the collected total (excludes applied
  // credit and refunds), so the sub-line matches the money figure above it.
  const cashInCount = ledger.filter(
    (e) => !e.voided && !e.pending && e.cashEffect > 0,
  ).length;
  const refundedCount = ledger.filter(
    (e) => e.type === "refund" && !e.voided && !e.pending,
  ).length;

  const kpis: PaymentKpis = {
    collected: flows.collected,
    completedCount: cashInCount,
    pendingCount: rows.filter((r) => r.status === "pending").length,
    failedCount: rows.filter((r) => r.status === "failed").length,
    refundedTotal: stats.refunded,
    refundedCount,
  };

  return <PaymentsBoard rows={rows} kpis={kpis} currency="ZAR" />;
}
