import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialDocument,
  type DocLine,
  type DocTone,
} from "@/components/finance/FinancialDocument";
import { getBrandName } from "@/lib/brand";
import { getHostParty } from "@/lib/finance/doc-party";
import { formatMoneyExact } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Lines = {
  /** "addon" for a standalone add-on invoice (no base stay), else a stay invoice. */
  kind?: string;
  listing_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  scope: string;
  base_amount: number;
  cleaning_fee: number;
  discount_amount?: number;
  coupon_code?: string | null;
  /** Non-coupon (stay/LOS or manual-quote) discount. */
  stay_discount?: number;
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
  params: { token: string; locale: string };
}) {
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, status, issued_at, paid_at, total_amount, subtotal, vat_amount, currency, host_id, booking_id, guest_snapshot, line_items, hosted_token",
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
    // The EFT reference is this invoice's own number — the exact value the payer
    // copy-pastes — not the booking ref wrapped in "WIELO-…".
    invoice.invoice_number,
    listingVatNumber,
    businessId,
  );

  // Line items. Add-on invoices carry only `addons[]` (no base stay / rooms),
  // so skip the base-row synthesis for them — otherwise a phantom "— base" row
  // with no amount appears.
  // Short "why" line under each stay row — nights + the date range.
  const stayNote = lines.nights
    ? `${lines.nights} night${lines.nights === 1 ? "" : "s"}${
        lines.check_in && lines.check_out
          ? ` · ${fmtDate(lines.check_in)} – ${fmtDate(lines.check_out)}`
          : ""
      }`
    : null;
  const lineRows: DocLine[] = [];
  if (lines.kind !== "addon") {
    if (lines.scope === "rooms" && (lines.rooms ?? []).length > 0) {
      for (const r of lines.rooms) {
        lineRows.push({
          title: `${lines.listing_name ?? "Stay"} — ${r.room_name}`,
          sub: stayNote,
          amount: formatMoneyExact(r.base_amount, c),
        });
        if (r.cleaning_fee > 0) {
          lineRows.push({
            title: `Cleaning — ${r.room_name}`,
            amount: formatMoneyExact(r.cleaning_fee, c),
          });
        }
      }
    } else {
      lineRows.push({
        title: `${lines.listing_name ?? "Stay"} — base`,
        sub: stayNote,
        amount: formatMoneyExact(lines.base_amount, c),
      });
      if (lines.cleaning_fee > 0) {
        lineRows.push({
          title: "Cleaning",
          amount: formatMoneyExact(lines.cleaning_fee, c),
        });
      }
    }
  }
  for (const a of lines.addons ?? []) {
    lineRows.push({
      title: a.label,
      mid: a.quantity > 1 ? `× ${a.quantity}` : null,
      amount: formatMoneyExact(a.subtotal, c),
    });
  }

  const discount = Number(lines.discount_amount ?? 0); // coupon
  const stayDiscount = Number(lines.stay_discount ?? 0); // stay/LOS or manual quote
  // VAT is authoritative from the stored column — never re-derived from the
  // totals. (Deriving it as `total − (subtotal − discount)` double-subtracted
  // the discount, since `subtotal` is already stored net of it, so a coupon
  // masqueraded as VAT — a non-VAT host's invoice showed phantom VAT = the
  // discount and mislabelled itself a Tax Invoice.)
  const vat = Number(invoice.vat_amount ?? 0);
  // Show the subtotal PRE-every-discount so the itemized discount lines foot to
  // the total (stored `subtotal` is net of ALL discounts: total − vat).
  const subtotalGross = Number(invoice.subtotal) + discount + stayDiscount;
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
      fromMark={
        party.logoUrl ? { kind: "logo", url: party.logoUrl } : undefined
      }
      to={{
        label: "Billed to",
        party: {
          name: guest.name ?? "Guest",
          lines: [guest.email, guest.phone].filter(Boolean) as string[],
        },
      }}
      balance={{
        label: isPaid ? "Amount Paid" : "Balance Due",
        value: formatMoneyExact(invoice.total_amount, c),
        positive: isPaid,
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
        { label: "Subtotal", value: formatMoneyExact(subtotalGross, c) },
        ...(stayDiscount > 0
          ? [
              {
                label: "Discount",
                value: `− ${formatMoneyExact(stayDiscount, c)}`,
                tone: "mute" as const,
              },
            ]
          : []),
        ...(discount > 0
          ? [
              {
                label: lines.coupon_code
                  ? `Discount (${lines.coupon_code})`
                  : "Discount",
                value: `− ${formatMoneyExact(discount, c)}`,
                tone: "mute" as const,
              },
            ]
          : []),
        ...(isTaxInvoice
          ? [
              {
                label: bookingVatRate > 0 ? `VAT (${bookingVatRate}%)` : "VAT",
                value: formatMoneyExact(vat, c),
              },
            ]
          : []),
      ]}
      grandTotal={{
        label: isPaid ? "Total paid" : "Total due",
        value: formatMoneyExact(invoice.total_amount, c),
      }}
      banking={party.banking}
      bankingLabel={isPaid ? "Banking details" : "Payment details"}
      stamp={isPaid ? "Paid" : null}
      pdfHref={`/${params.locale}/invoice/${invoice.hosted_token}/pdf`}
      footerTitle="Thank you for booking direct."
      footerNote="Keep this invoice for your records."
    />
  );
}
