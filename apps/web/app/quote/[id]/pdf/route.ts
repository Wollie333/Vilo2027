import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getBrandName } from "@/lib/brand";
import { decryptAccountNumber } from "@/lib/crypto/banking";
import { type QuoteBanking, type QuoteBusiness } from "@/lib/pdf/QuoteDocument";
import { hostLogoDataUri } from "@/lib/pdf/logo";
import { renderQuotePdf } from "@/lib/pdf/render";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BusinessRow = {
  legal_name: string | null;
  trading_name: string | null;
  vat_number: string | null;
  company_registration_number: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_postcode: string | null;
  billing_country: string | null;
};

function shapeBusiness(row: BusinessRow | null): QuoteBusiness | null {
  if (!row) return null;
  const addressLines: string[] = [
    row.billing_address_line1,
    row.billing_address_line2,
    [row.billing_city, row.billing_postcode].filter(Boolean).join(" "),
    row.billing_country && row.billing_country !== "ZA"
      ? row.billing_country
      : null,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  const out: QuoteBusiness = {
    legalName: row.legal_name,
    tradingName: row.trading_name,
    vatNumber: row.vat_number,
    companyRegistrationNumber: row.company_registration_number,
    billingAddress: addressLines.length > 0 ? addressLines : null,
  };
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

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  // ?v=N renders a previously-issued version from its frozen snapshot.
  const versionParam = new URL(req.url).searchParams.get("v");
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      id, quote_number, status, created_at, valid_until, accept_token,
      guest_name, guest_email, guest_phone, quote_type, title,
      check_in, check_out, headcount,
      base_amount, cleaning_fee, addons_total, total_amount, currency,
      discount_amount, discount_reason,
      notes,
      listing:properties ( name, business_id ),
      host:hosts!inner ( id, display_name, handle, user_id, user_profiles:user_profiles!hosts_user_id_fkey ( email, phone ) )
    `,
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!quote) return new NextResponse("Not found", { status: 404 });

  // Compose host/listing details from the join (Supabase returns either an
  // object or an array depending on hint resolution; normalise both shapes).
  const listingObj = Array.isArray(quote.listing)
    ? quote.listing[0]
    : (quote.listing as { name?: string; business_id?: string | null } | null);
  const isCustomQuote =
    quote.quote_type === "custom" || quote.quote_type === "upload";
  let businessId =
    (listingObj as { business_id?: string | null } | null)?.business_id ?? null;
  // Custom/upload quotes have no listing — fall back to the host's default
  // business so the PDF still carries the right banking + business header.
  if (!businessId) {
    const { data: defBiz } = await supabase
      .from("businesses")
      .select("id")
      .eq(
        "host_id",
        (Array.isArray(quote.host) ? quote.host[0] : quote.host)?.id ?? "",
      )
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle();
    businessId = defBiz?.id ?? null;
  }
  const hostObj = Array.isArray(quote.host)
    ? quote.host[0]
    : (quote.host as {
        id?: string;
        display_name?: string;
        handle?: string;
        user_id?: string;
      } | null);

  // RLS already filtered to the owner's quotes — if the join returned
  // nothing, fail closed.
  if (!hostObj) return new NextResponse("Forbidden", { status: 403 });

  // Look up email + phone directly (the embedded join can be flaky to type).
  const { data: hostProfile } = await supabase
    .from("user_profiles")
    .select("email, phone")
    .eq("id", hostObj.user_id!)
    .maybeSingle();

  const { data: addons } = await supabase
    .from("quote_addons")
    .select("label, quantity, unit_price, subtotal")
    .eq("quote_id", params.id)
    .order("sort_order");

  // A requested version overrides the document content with its frozen snapshot
  // (host branding always stays live).
  type Snapshot = {
    quote_number?: string;
    status?: string;
    created_at?: string;
    valid_until?: string | null;
    guest_name?: string | null;
    guest_email?: string | null;
    guest_phone?: string | null;
    listing_name?: string | null;
    check_in?: string | null;
    check_out?: string | null;
    headcount?: number;
    base_amount?: number;
    cleaning_fee?: number;
    addons_total?: number;
    total_amount?: number;
    notes?: string | null;
    currency?: string;
    addons?: {
      label: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }[];
  };
  let snap: Snapshot | null = null;
  if (versionParam && /^\d+$/.test(versionParam)) {
    const { data: vrow } = await supabase
      .from("quote_versions")
      .select("snapshot")
      .eq("quote_id", params.id)
      .eq("version_no", Number(versionParam))
      .maybeSingle();
    snap = (vrow?.snapshot as Snapshot | undefined) ?? null;
  }

  const doc = {
    quoteNumber: snap?.quote_number ?? quote.quote_number,
    status: snap?.status ?? quote.status,
    createdAt: snap?.created_at ?? quote.created_at,
    validUntil: snap?.valid_until ?? quote.valid_until,
    guestName: snap?.guest_name ?? quote.guest_name,
    guestEmail: snap?.guest_email ?? quote.guest_email,
    guestPhone: snap?.guest_phone ?? quote.guest_phone,
    listingName: snap?.listing_name ?? listingObj?.name ?? null,
    checkIn: snap?.check_in ?? quote.check_in,
    checkOut: snap?.check_out ?? quote.check_out,
    headcount: snap?.headcount ?? quote.headcount,
    baseAmount: snap?.base_amount ?? quote.base_amount,
    cleaningFee: snap?.cleaning_fee ?? quote.cleaning_fee,
    addonsTotal: snap?.addons_total ?? quote.addons_total ?? 0,
    total: snap?.total_amount ?? quote.total_amount,
    discountAmount: Number(quote.discount_amount ?? 0),
    discountReason: quote.discount_reason ?? null,
    notes: snap?.notes ?? quote.notes,
    currency: snap?.currency ?? quote.currency,
    addons: snap?.addons ?? addons ?? [],
  };

  // Live banking + business (quotes always reflect the host's current values).
  // RLS gates these tables to the host owner — and we've already verified
  // ownership of the quote above.
  let banking: QuoteBanking | null = null;
  let business: QuoteBusiness | null = null;
  if (businessId) {
    const [{ data: bank }, { data: biz }] = await Promise.all([
      supabase
        .from("eft_banking_details")
        .select(
          "bank_name, account_holder, account_number, account_type, branch_code, swift_code",
        )
        .eq("business_id", businessId)
        .eq("is_default", true)
        .eq("is_archived", false)
        .maybeSingle(),
      // Alias the businesses columns to the billing_* keys shapeBusiness expects.
      supabase
        .from("businesses")
        .select(
          "legal_name, trading_name, vat_number, company_registration_number, billing_address_line1:address_line1, billing_address_line2:address_line2, billing_city:city, billing_postcode:postal_code, billing_country:country",
        )
        .eq("id", businessId)
        .maybeSingle(),
    ]);

    if (bank?.account_number) {
      try {
        banking = {
          bankName: bank.bank_name,
          accountHolder: bank.account_holder,
          accountNumber: decryptAccountNumber(bank.account_number),
          accountType: bank.account_type,
          branchCode: bank.branch_code,
          swiftCode: bank.swift_code,
        };
      } catch {
        banking = null;
      }
    }
    business = shapeBusiness(biz as BusinessRow | null);
  }

  const lineRows: {
    description: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[] = [];
  lineRows.push({
    description: isCustomQuote
      ? (quote.title ?? "Quote")
      : `${doc.listingName ?? "Stay"} — base`,
    quantity: 1,
    unit_price: doc.baseAmount,
    subtotal: doc.baseAmount,
  });
  if (doc.cleaningFee > 0) {
    lineRows.push({
      description: "Cleaning",
      quantity: 1,
      unit_price: doc.cleaningFee,
      subtotal: doc.cleaningFee,
    });
  }
  for (const a of doc.addons) {
    lineRows.push({
      description: a.label,
      quantity: a.quantity,
      unit_price: a.unit_price,
      subtotal: a.subtotal,
    });
  }
  if (doc.discountAmount > 0) {
    lineRows.push({
      description: doc.discountReason
        ? `Discount — ${doc.discountReason}`
        : "Discount",
      quantity: 1,
      unit_price: -doc.discountAmount,
      subtotal: -doc.discountAmount,
    });
  }

  // Absolute URL for the guest accept link in the PDF.
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const acceptUrl = `${proto}://${baseHost}/q/${quote.id}/${quote.accept_token}`;

  const nights =
    doc.checkIn && doc.checkOut
      ? Math.max(
          1,
          Math.round(
            (new Date(doc.checkOut).getTime() -
              new Date(doc.checkIn).getTime()) /
              86_400_000,
          ),
        )
      : 1;

  const buffer = await renderQuotePdf({
    quoteNumber: doc.quoteNumber,
    status: doc.status as
      | "draft"
      | "sent"
      | "accepted"
      | "declined"
      | "expired"
      | "converted",
    createdAt: doc.createdAt,
    validUntil: doc.validUntil,
    // Only the live quote shows an accept link; a historical version is read-only.
    acceptUrl: !snap && quote.status === "sent" ? acceptUrl : null,
    host: {
      displayName: hostObj.display_name ?? null,
      handle: hostObj.handle ?? null,
      email: hostProfile?.email ?? null,
      phone: hostProfile?.phone ?? null,
      banking,
      business,
    },
    guest: {
      name: doc.guestName,
      email: doc.guestEmail,
      phone: doc.guestPhone,
    },
    quoteType: isCustomQuote ? "custom" : "accommodation",
    title: quote.title ?? null,
    stay: {
      listingName: doc.listingName,
      checkIn: doc.checkIn,
      checkOut: doc.checkOut,
      nights,
      headcount: doc.headcount,
    },
    lines: lineRows,
    subtotal: doc.baseAmount + doc.cleaningFee + doc.addonsTotal,
    total: doc.total,
    currency: doc.currency,
    notes: doc.notes,
    logoUrl: await hostLogoDataUri(hostObj.id, businessId),
    brandName: await getBrandName(),
  });

  const fileName = snap
    ? `${doc.quoteNumber}-v${versionParam}.pdf`
    : `${doc.quoteNumber}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
