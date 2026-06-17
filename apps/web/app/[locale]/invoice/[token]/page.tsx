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
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Lines = {
  listing_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  scope: string;
  base_amount: number;
  cleaning_fee: number;
  discount_amount?: number;
  rooms: { room_name: string; base_amount: number; cleaning_fee: number }[];
  addons: {
    label: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};
type GuestSnap = { name?: string; email?: string; phone?: string };

const TONE: Record<string, DocTone> = {
  paid: "green",
  issued: "amber",
  draft: "grey",
  cancelled: "red",
};
const LABEL: Record<string, string> = {
  paid: "Paid",
  issued: "Issued",
  draft: "Draft",
  cancelled: "Cancelled",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso));
}

export default async function PublicInvoicePage({
  params,
}: {
  params: { token: string };
}) {
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, status, issued_at, paid_at, total_amount, subtotal, currency, host_id, booking_id, guest_snapshot, line_items, hosted_token",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!invoice) notFound();

  const lines = invoice.line_items as Lines;
  const guest = invoice.guest_snapshot as GuestSnap;
  const status = invoice.status as string;
  const c = invoice.currency;
  const brandName = await getBrandName();

  // Booking reference (for the banking payment reference) + VAT rate + the
  // listing's VAT number (the per-listing VAT identity for the tax invoice).
  let bookingRef: string | null = null;
  let bookingVatRate = 0;
  let listingVatNumber: string | null | undefined = undefined;
  let businessId: string | null = null;
  if (invoice.booking_id) {
    const { data: b } = await admin
      .from("bookings")
      .select(
        "reference, vat_rate, listing:properties ( vat_number, business_id )",
      )
      .eq("id", invoice.booking_id)
      .maybeSingle();
    bookingRef = b?.reference ?? null;
    bookingVatRate = Number(b?.vat_rate ?? 0);
    const lst = Array.isArray(b?.listing) ? b?.listing[0] : b?.listing;
    listingVatNumber = (lst as { vat_number?: string | null })?.vat_number;
    businessId = (lst as { business_id?: string | null })?.business_id ?? null;
  }
  const party = await getHostParty(
    admin,
    invoice.host_id,
    bookingRef,
    listingVatNumber,
    businessId,
  );

  // Line items.
  const lineRows: DocLine[] = [];
  if (lines.scope === "rooms" && (lines.rooms ?? []).length > 0) {
    for (const r of lines.rooms) {
      lineRows.push({
        title: `${lines.listing_name ?? "Stay"} — ${r.room_name}`,
        amount: formatMoney(r.base_amount, c),
      });
      if (r.cleaning_fee > 0) {
        lineRows.push({
          title: `Cleaning — ${r.room_name}`,
          amount: formatMoney(r.cleaning_fee, c),
        });
      }
    }
  } else {
    lineRows.push({
      title: `${lines.listing_name ?? "Stay"} — base`,
      sub: lines.nights
        ? `${lines.nights} night${lines.nights === 1 ? "" : "s"}`
        : null,
      amount: formatMoney(lines.base_amount, c),
    });
    if (lines.cleaning_fee > 0) {
      lineRows.push({
        title: "Cleaning",
        amount: formatMoney(lines.cleaning_fee, c),
      });
    }
  }
  for (const a of lines.addons ?? []) {
    lineRows.push({
      title: a.label,
      mid: a.quantity > 1 ? `× ${a.quantity}` : null,
      amount: formatMoney(a.subtotal, c),
    });
  }

  const discount = Number(lines.discount_amount ?? 0);
  // VAT is whatever sits between the ex-VAT net (subtotal − discount) and the
  // VAT-inclusive total the booking stored. > 0 ⇒ this is a tax invoice.
  const vat =
    Math.round(
      (Number(invoice.total_amount) - (Number(invoice.subtotal) - discount)) *
        100,
    ) / 100;
  const isTaxInvoice = vat > 0.005;
  const isPaid = status === "paid";

  return (
    <FinancialDocument
      kind={isTaxInvoice ? "Tax Invoice" : "Invoice"}
      number={invoice.invoice_number}
      status={{ label: LABEL[status] ?? status, tone: TONE[status] ?? "grey" }}
      brandName={brandName}
      brandTagline="Direct booking"
      from={{ name: party.name, lines: party.lines }}
      to={{
        label: "Billed to",
        party: {
          name: guest.name ?? "Guest",
          lines: [guest.email, guest.phone].filter(Boolean) as string[],
        },
      }}
      metaRows={[
        { label: "Issue date", value: fmtDate(invoice.issued_at) },
        ...(invoice.paid_at
          ? [{ label: "Paid on", value: fmtDate(invoice.paid_at) }]
          : []),
        ...(bookingRef ? [{ label: "Booking", value: bookingRef }] : []),
      ]}
      stay={{
        listingName: lines.listing_name,
        checkIn: fmtDate(lines.check_in),
        checkOut: fmtDate(lines.check_out),
        nights: String(lines.nights ?? "—"),
      }}
      lineHeaders={{ desc: "Description", amount: "Amount" }}
      lines={lineRows}
      totals={[
        { label: "Subtotal", value: formatMoney(invoice.subtotal, c) },
        ...(discount > 0
          ? [
              {
                label: "Discount",
                value: `− ${formatMoney(discount, c)}`,
                tone: "mute" as const,
              },
            ]
          : []),
        ...(isTaxInvoice
          ? [
              {
                label: bookingVatRate > 0 ? `VAT (${bookingVatRate}%)` : "VAT",
                value: formatMoney(vat, c),
              },
            ]
          : []),
      ]}
      grandTotal={{
        label: isPaid ? "Total paid" : "Total due",
        value: formatMoney(invoice.total_amount, c),
      }}
      banking={isPaid ? null : party.banking}
      stamp={isPaid ? "Paid" : null}
      pdfHref={`/invoice/${invoice.hosted_token}/pdf`}
      footerTitle="Thank you for booking direct."
      footerNote="Keep this invoice for your records."
    />
  );
}
