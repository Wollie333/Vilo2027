import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { hostHasValidEft } from "@/lib/payments/eft";
import { getHostPayPal } from "@/lib/payments/host-paypal";
import { getHostPaystack } from "@/lib/payments/host-paystack";
import { createServerClient } from "@/lib/supabase/server";

import { PayForm } from "./PayForm";

export const metadata: Metadata = {
  title: "Pay for your booking",
};

export const dynamic = "force-dynamic";

export default async function BookingPayPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { method?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/booking/${params.id}/pay`);

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, guest_id, reference, status, payment_status, total_amount, deposit_amount, currency, check_in, check_out, listing:properties ( name, host_id )",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!booking || booking.guest_id !== user.id) notFound();

  // Already settled → nothing to pay; send them to the confirmation page.
  if (booking.payment_status === "completed") {
    redirect(`/booking/${params.id}/success`);
  }

  const listing = (
    Array.isArray(booking.listing) ? booking.listing[0] : booking.listing
  ) as { name: string; host_id: string } | null;

  const [eftAvailable, cardAvailable, paypalAvailable] = listing
    ? await Promise.all([
        hostHasValidEft(listing.host_id),
        getHostPaystack(listing.host_id).then(Boolean),
        getHostPayPal(listing.host_id).then(Boolean),
      ])
    : [false, false, false];

  const total = Number(booking.total_amount);
  const deposit = Number(booking.deposit_amount ?? 0);
  const hasDeposit = deposit > 0 && deposit < total;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink">
          Complete your booking
        </h1>
        <p className="mt-1 text-sm text-brand-mute">
          {listing?.name ?? "Your stay"} · {booking.check_in} →{" "}
          {booking.check_out}
        </p>
      </header>

      <PayForm
        bookingId={booking.id}
        currency={booking.currency}
        total={total}
        deposit={hasDeposit ? deposit : null}
        eftAvailable={eftAvailable}
        cardAvailable={cardAvailable}
        paypalAvailable={paypalAvailable}
        initialMethod={
          searchParams?.method === "paystack" ||
          searchParams?.method === "paypal" ||
          searchParams?.method === "eft"
            ? searchParams.method
            : undefined
        }
      />
    </div>
  );
}
