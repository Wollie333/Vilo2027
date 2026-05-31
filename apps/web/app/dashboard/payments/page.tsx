import type { Metadata } from "next";

import { createServerClient } from "@/lib/supabase/server";

import {
  PaymentsBoard,
  type PaymentKpis,
  type PaymentRow,
} from "./PaymentsBoard";

export const metadata: Metadata = {
  title: "Payments · Vilo",
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
  provider_reference: string | null;
  captured_at: string | null;
  created_at: string;
  booking: RawBooking;
};

function methodShort(m: string): string {
  if (m === "paystack") return "Card";
  if (m === "eft") return "EFT";
  if (m === "paypal") return "PayPal";
  return m;
}

export default async function PaymentsPage() {
  const supabase = createServerClient();

  // RLS host_read_own_payments — only payments for this host's bookings.
  const { data } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, method, status, provider_reference, captured_at, created_at, booking:bookings!inner ( id, reference, guest_name, guest_email, listing:listings!inner ( name, listing_photos ( url, sort_order ) ), guest:user_profiles!bookings_guest_id_fkey ( full_name, email, avatar_url ) )",
    )
    .order("created_at", { ascending: false })
    .limit(400);

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
  const collected = completed.reduce((acc, r) => acc + r.amount, 0);
  const methodSet = new Set<string>();
  for (const r of rows) methodSet.add(methodShort(r.method));

  const kpis: PaymentKpis = {
    collected,
    completedCount: completed.length,
    pendingCount: rows.filter((r) => r.status === "pending").length,
    failedCount: rows.filter((r) => r.status === "failed").length,
    methods: [...methodSet],
  };

  return <PaymentsBoard rows={rows} kpis={kpis} currency="ZAR" />;
}
