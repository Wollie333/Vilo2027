import { NextResponse } from "next/server";

import { decryptAccountNumber } from "@/lib/crypto/banking";
import {
  type InvoiceBanking,
  type InvoiceBusiness,
} from "@/lib/pdf/InvoiceDocument";
import { getBrandName } from "@/lib/brand";
import { hostLogoDataUri } from "@/lib/pdf/logo";
import { renderInvoicePdf } from "@/lib/pdf/render";
import { formatDate } from "@/lib/pdf/styles";
import { createAdminClient } from "@/lib/supabase/admin";

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
  price_breakdown?: {
    seasonalNights?: number;
    weekendNights?: number;
  } | null;
  rooms: { room_name: string; base_amount: number; cleaning_fee: number }[];
  addons: {
    label: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
};

/** "3 season-priced nights · 2 weekend nights" — or null when neither applies. */
function seasonSummary(pb: Lines["price_breakdown"]): string | null {
  if (!pb) return null;
  const parts: string[] = [];
  if (pb.seasonalNights && pb.seasonalNights > 0) {
    parts.push(
      `${pb.seasonalNights} season-priced night${pb.seasonalNights === 1 ? "" : "s"}`,
    );
  }
  if (pb.weekendNights && pb.weekendNights > 0) {
    parts.push(
      `${pb.weekendNights} weekend night${pb.weekendNights === 1 ? "" : "s"}`,
    );
  }
  return parts.length ? parts.join(" · ") : null;
}

type BankingSnap = {
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  account_type?: string;
  branch_code?: string;
  swift_code?: string | null;
  reference_format?: string;
};
type BusinessSnap = {
  legal_name?: string | null;
  trading_name?: string | null;
  vat_number?: string | null;
  company_registration_number?: string | null;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_postcode?: string | null;
  billing_country?: string | null;
};
type Snap = {
  display_name?: string;
  handle?: string;
  email?: string;
  phone?: string;
  banking?: BankingSnap | null;
  business?: BusinessSnap | null;
  booking_ref?: string | null;
};
type GuestSnap = { name?: string; email?: string; phone?: string };

function buildBusiness(
  snap: BusinessSnap | null | undefined,
): InvoiceBusiness | null {
  if (!snap) return null;
  const addressLines: string[] = [
    snap.billing_address_line1,
    snap.billing_address_line2,
    [snap.billing_city, snap.billing_postcode].filter(Boolean).join(" "),
    snap.billing_country && snap.billing_country !== "ZA"
      ? snap.billing_country
      : null,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  const out: InvoiceBusiness = {
    legalName: snap.legal_name ?? null,
    tradingName: snap.trading_name ?? null,
    vatNumber: snap.vat_number ?? null,
    companyRegistrationNumber: snap.company_registration_number ?? null,
    billingAddress: addressLines.length > 0 ? addressLines : null,
  };
  // If every field is empty, treat as null so the PDF skips it.
  if (
    !out.legalName &&
    !out.tradingName &&
    !out.vatNumber &&
    !out.companyRegistrationNumber &&
    (!out.billingAddress || out.billingAddress.length === 0)
  ) {
    return null;
  }
  return out;
}

function buildBanking(
  snap: BankingSnap | null | undefined,
  docReference: string | null,
): InvoiceBanking | null {
  if (!snap || !snap.account_number) return null;
  let accountNumber: string;
  try {
    accountNumber = decryptAccountNumber(snap.account_number);
  } catch {
    return null;
  }
  // The EFT reference is the document's own number, verbatim — never wrapped in
  // reference_format ("WIELO-…"), so the payer copies the exact matchable id.
  const reference = docReference?.trim() || null;
  return {
    bankName: snap.bank_name ?? "",
    accountHolder: snap.account_holder ?? "",
    accountNumber,
    accountType: snap.account_type ?? "",
    branchCode: snap.branch_code ?? "",
    swiftCode: snap.swift_code ?? null,
    reference,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "invoice_number, status, issued_at, paid_at, currency, subtotal, vat_amount, total_amount, host_id, host_snapshot, guest_snapshot, line_items",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!invoice) {
    return new NextResponse("Not found", { status: 404 });
  }

  const logoUrl = await hostLogoDataUri(invoice.host_id);

  const lines = invoice.line_items as Lines;
  const host = invoice.host_snapshot as Snap;
  const guest = invoice.guest_snapshot as GuestSnap;

  // A short "why" line under each stay row — nights + the date range.
  const stayNote =
    lines.nights && lines.nights > 0
      ? `${lines.nights} night${lines.nights === 1 ? "" : "s"}${
          lines.check_in && lines.check_out
            ? ` · ${formatDate(lines.check_in)} – ${formatDate(lines.check_out)}`
            : ""
        }`
      : null;

  const lineRows: {
    description: string;
    note?: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[] = [];
  // Add-on invoices carry only `addons[]` (no base_amount / rooms) — an add-on
  // charge is billed on its own. Only synthesise the base/rooms stay rows for
  // stay invoices, else `lines.base_amount` is undefined → "R NaN".
  if (lines.kind !== "addon") {
    if (
      lines.scope === "rooms" &&
      Array.isArray(lines.rooms) &&
      lines.rooms.length > 0
    ) {
      for (const r of lines.rooms) {
        lineRows.push({
          description: `${lines.listing_name ?? "Stay"} — ${r.room_name}`,
          note: stayNote,
          quantity: 1,
          unit_price: r.base_amount,
          subtotal: r.base_amount,
        });
        if (r.cleaning_fee > 0) {
          lineRows.push({
            description: `Cleaning — ${r.room_name}`,
            quantity: 1,
            unit_price: r.cleaning_fee,
            subtotal: r.cleaning_fee,
          });
        }
      }
    } else {
      lineRows.push({
        description: `${lines.listing_name ?? "Stay"} — base`,
        note: stayNote,
        quantity: 1,
        unit_price: lines.base_amount,
        subtotal: lines.base_amount,
      });
      if (lines.cleaning_fee > 0) {
        lineRows.push({
          description: "Cleaning",
          quantity: 1,
          unit_price: lines.cleaning_fee,
          subtotal: lines.cleaning_fee,
        });
      }
    }
  }
  for (const a of lines.addons ?? []) {
    lineRows.push({
      description: a.label,
      quantity: a.quantity,
      unit_price: a.unit_price,
      subtotal: a.subtotal,
    });
  }

  // Reference = this invoice's own number (not the booking ref) — matches the
  // hosted invoice page and the payment reference the payer must quote.
  const banking = buildBanking(host.banking, invoice.invoice_number);
  const business = buildBusiness(host.business);
  const isPaid = invoice.status === "paid";

  const facts = [
    { label: "Invoice date", value: formatDate(invoice.issued_at) },
    ...(isPaid && invoice.paid_at
      ? [{ label: "Paid on", value: formatDate(invoice.paid_at) }]
      : []),
    ...(host.booking_ref
      ? [{ label: "Booking ref", value: host.booking_ref }]
      : []),
  ];

  const buffer = await renderInvoicePdf({
    invoiceNumber: invoice.invoice_number,
    status: invoice.status as "draft" | "issued" | "paid" | "cancelled",
    issuedAt: invoice.issued_at,
    facts,
    host: {
      displayName: host.display_name ?? null,
      handle: host.handle ?? null,
      email: host.email ?? null,
      phone: host.phone ?? null,
      banking,
      business,
    },
    guest: {
      name: guest.name ?? null,
      email: guest.email ?? null,
      phone: guest.phone ?? null,
    },
    stay: {
      listingName: lines.listing_name,
      checkIn: lines.check_in,
      checkOut: lines.check_out,
      nights: lines.nights,
    },
    lines: lineRows,
    // Subtotal shown PRE-every-discount so the itemized discount lines foot to
    // the total (stored `subtotal` is net of ALL discounts: total − vat).
    subtotal:
      Number(invoice.subtotal) +
      Number(lines.discount_amount ?? 0) +
      Number(lines.stay_discount ?? 0),
    discountAmount: lines.discount_amount ?? 0,
    discountLabel: lines.coupon_code ?? null,
    stayDiscount: Number(lines.stay_discount ?? 0),
    seasonSummary: seasonSummary(lines.price_breakdown),
    vatAmount: invoice.vat_amount,
    totalAmount: invoice.total_amount,
    currency: invoice.currency,
    logoUrl,
    brandName: await getBrandName(),
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
