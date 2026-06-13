import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMyHostId } from "@/lib/host/current";
import { sumPaidFromRows } from "@/lib/payments/ledger";
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
  listing_photos: { url: string; sort_order: number }[] | null;
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
        "id, amount, currency, method, status, kind, voided_at, provider_reference, refunded_amount, captured_at, created_at, booking:bookings!inner ( id, reference, guest_name, guest_email, listing:listings!inner ( name, listing_photos ( url, sort_order ) ), guest:user_profiles!bookings_guest_id_fkey ( full_name, email, avatar_url ) )",
      )
      .eq("booking.host_id", myHostId)
      .order("created_at", { ascending: false })
      .limit(400),
    "dashboard/payments",
  );

  const raw = (data ?? []) as unknown as RawPayment[];

  const rows: PaymentRow[] = raw.map((p) => {
    const b = p.booking;
    const photos = b.listing.listing_photos ?? [];
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
  const completed = rows.filter((r) => r.status === "completed");
  // Collected = the canonical paid-sum (completed + non-voided + inbound kinds),
  // not a raw sum of every completed row — so voided / non-inbound payments
  // never inflate it, matching the ledger everywhere else.
  const collected = sumPaidFromRows(
    raw.map((p) => ({
      amount: Number(p.amount),
      kind: p.kind,
      status: p.status,
      voided_at: p.voided_at,
    })),
  );
  // Total refunds = sum of payments.refunded_amount (trigger-maintained as
  // refunds complete), counting how many payments had any refund.
  const refundedTotal = raw.reduce(
    (acc, p) => acc + Number(p.refunded_amount ?? 0),
    0,
  );
  const refundedCount = raw.filter(
    (p) => Number(p.refunded_amount ?? 0) > 0,
  ).length;

  const kpis: PaymentKpis = {
    collected,
    completedCount: completed.length,
    pendingCount: rows.filter((r) => r.status === "pending").length,
    failedCount: rows.filter((r) => r.status === "failed").length,
    refundedTotal,
    refundedCount,
  };

  return <PaymentsBoard rows={rows} kpis={kpis} currency="ZAR" />;
}
