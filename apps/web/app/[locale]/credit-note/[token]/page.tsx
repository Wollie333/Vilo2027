import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialDocument,
  type DocLine,
  type DocTone,
} from "@/components/finance/FinancialDocument";
import { getBrandName } from "@/lib/brand";
import { getHostParty } from "@/lib/finance/doc-party";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Credit note",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type GuestSnap = { name?: string; email?: string; phone?: string };
type CnLine = { label: string; amount: number | string };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function PublicCreditNotePage({
  params,
}: {
  params: { token: string };
}) {
  const admin = createAdminClient();
  const { data: cn } = await admin
    .from("credit_notes")
    .select(
      "credit_note_number, status, issued_at, currency, total_amount, reason, host_id, guest_snapshot, line_items, hosted_token, invoice:invoices!inner ( invoice_number ), booking:bookings ( listing:properties ( business_id ) )",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!cn) notFound();

  const cnBooking = Array.isArray(cn.booking) ? cn.booking[0] : cn.booking;
  const cnListing = Array.isArray(cnBooking?.listing)
    ? cnBooking?.listing[0]
    : cnBooking?.listing;
  const cnBusinessId =
    (cnListing as { business_id?: string | null } | null)?.business_id ?? null;

  const guest = cn.guest_snapshot as GuestSnap;
  const lines = (cn.line_items as CnLine[]) ?? [];
  const c = cn.currency;
  const status = cn.status as string;
  const invoiceNumber =
    (cn.invoice as unknown as { invoice_number?: string } | null)
      ?.invoice_number ?? null;
  const [party, brandName] = await Promise.all([
    getHostParty(admin, cn.host_id, null, undefined, cnBusinessId),
    getBrandName(),
  ]);

  const lineRows: DocLine[] = lines.map((l) => ({
    title: l.label,
    amount: `− ${formatMoney(Number(l.amount), c)}`,
  }));

  const cancelled = status === "cancelled";
  const tone: DocTone = cancelled ? "grey" : "indigo";

  return (
    <FinancialDocument
      kind="Credit note"
      number={cn.credit_note_number}
      status={{ label: cancelled ? "Cancelled" : "Issued", tone }}
      brandName={brandName}
      brandTagline="Credit note"
      from={{ name: party.name, lines: party.lines }}
      to={{
        label: "Credited to",
        party: {
          name: guest.name ?? "Guest",
          lines: [guest.email, guest.phone].filter(Boolean) as string[],
        },
      }}
      metaRows={[
        { label: "Issue date", value: fmtDate(cn.issued_at) },
        ...(invoiceNumber
          ? [{ label: "Against invoice", value: invoiceNumber }]
          : []),
      ]}
      lineHeaders={{ desc: "Description", amount: "Amount" }}
      lines={lineRows}
      totals={[]}
      grandTotal={{
        label: "Total credited",
        value: `− ${formatMoney(Number(cn.total_amount), c)}`,
      }}
      pdfHref={`/credit-note/${cn.hosted_token}/pdf`}
      footerTitle={cn.reason ? `Reason: ${cn.reason}` : undefined}
      footerNote="This credit note reduces the amount owed on the related invoice."
    />
  );
}
