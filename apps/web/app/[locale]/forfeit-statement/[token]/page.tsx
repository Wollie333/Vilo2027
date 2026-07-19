import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialDocument,
  type DocLine,
} from "@/components/finance/FinancialDocument";
import { getBrandName } from "@/lib/brand";
import { getHostParty } from "@/lib/finance/doc-party";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Forfeit statement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type GuestSnap = { name?: string; email?: string; phone?: string };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function PublicForfeitStatementPage({
  params,
}: {
  params: { token: string; locale: string };
}) {
  const admin = createAdminClient();
  const { data: fs } = await admin
    .from("forfeit_statements")
    .select(
      "statement_number, created_at, currency, booking_total, amount_paid, amount_forfeited, amount_refunded, amount_written_off, policy_applied, reason, host_id, guest_snapshot, hosted_token, booking:bookings ( reference, listing:properties ( business_id ) )",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!fs) notFound();

  const booking = Array.isArray(fs.booking) ? fs.booking[0] : fs.booking;
  const listing = Array.isArray(booking?.listing)
    ? booking?.listing[0]
    : booking?.listing;
  const businessId =
    (listing as { business_id?: string | null } | null)?.business_id ?? null;

  const guest = fs.guest_snapshot as GuestSnap;
  const c = fs.currency;
  const refunded = Number(fs.amount_refunded ?? 0);

  const [party, brandName] = await Promise.all([
    getHostParty(
      admin,
      fs.host_id,
      booking?.reference ?? null,
      undefined,
      businessId,
    ),
    getBrandName(),
  ]);

  const lineRows: DocLine[] = [
    {
      title: "Booking total",
      amount: formatMoney(Number(fs.booking_total), c),
    },
    { title: "Amount paid", amount: formatMoney(Number(fs.amount_paid), c) },
    {
      title: "Outstanding written off",
      amount: `− ${formatMoney(Number(fs.amount_written_off), c)}`,
    },
    ...(refunded > 0
      ? [
          {
            title: "Refunded to guest",
            amount: `− ${formatMoney(refunded, c)}`,
          },
        ]
      : []),
  ];

  return (
    <FinancialDocument
      kind="Forfeit statement"
      number={fs.statement_number}
      status={{ label: "Forfeited", tone: "grey" }}
      brandName={brandName}
      brandTagline="Forfeit statement"
      from={{ name: party.name, lines: party.lines }}
      fromMark={
        party.logoUrl ? { kind: "logo", url: party.logoUrl } : undefined
      }
      to={{
        label: "Guest",
        party: {
          name: guest.name ?? "Guest",
          lines: [guest.email, guest.phone].filter(Boolean) as string[],
        },
      }}
      metaRows={[
        { label: "Issue date", value: fmtDate(fs.created_at) },
        ...(booking?.reference
          ? [{ label: "Booking", value: booking.reference as string }]
          : []),
        ...(fs.policy_applied
          ? [{ label: "Policy applied", value: fs.policy_applied as string }]
          : []),
      ]}
      lineHeaders={{ desc: "Description", amount: "Amount" }}
      lines={lineRows}
      totals={[]}
      grandTotal={{
        label: "Retained by host",
        value: formatMoney(Number(fs.amount_forfeited), c),
      }}
      pdfHref={`/${params.locale}/forfeit-statement/${fs.hosted_token}/pdf`}
      footerTitle={fs.reason ? `Reason: ${fs.reason}` : undefined}
      footerNote="This booking was cancelled as a no-show / abandoned. The amount paid was retained by the host per the cancellation policy; the outstanding balance was written off. No refund is due."
    />
  );
}
