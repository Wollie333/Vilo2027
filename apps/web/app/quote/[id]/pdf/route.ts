import { headers } from "next/headers";
import { NextResponse } from "next/server";

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
  _req: Request,
  { params }: { params: { id: string } },
) {
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
      guest_name, guest_email, guest_phone,
      check_in, check_out, headcount,
      base_amount, cleaning_fee, addons_total, total_amount, currency,
      notes,
      listing:listings ( name ),
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
    : (quote.listing as { name?: string } | null);
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

  // Live banking + business (quotes always reflect the host's current values).
  // RLS gates these tables to the host owner — and we've already verified
  // ownership of the quote above.
  let banking: QuoteBanking | null = null;
  let business: QuoteBusiness | null = null;
  if (hostObj.id) {
    const [{ data: bank }, { data: biz }] = await Promise.all([
      supabase
        .from("eft_banking_details")
        .select(
          "bank_name, account_holder, account_number, account_type, branch_code, swift_code",
        )
        .eq("host_id", hostObj.id)
        .eq("is_default", true)
        .eq("is_archived", false)
        .maybeSingle(),
      supabase
        .from("host_business_details")
        .select(
          "legal_name, trading_name, vat_number, company_registration_number, billing_address_line1, billing_address_line2, billing_city, billing_postcode, billing_country",
        )
        .eq("host_id", hostObj.id)
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
    description: `${listingObj?.name ?? "Stay"} — base`,
    quantity: 1,
    unit_price: quote.base_amount,
    subtotal: quote.base_amount,
  });
  if (quote.cleaning_fee > 0) {
    lineRows.push({
      description: "Cleaning",
      quantity: 1,
      unit_price: quote.cleaning_fee,
      subtotal: quote.cleaning_fee,
    });
  }
  for (const a of addons ?? []) {
    lineRows.push({
      description: a.label,
      quantity: a.quantity,
      unit_price: a.unit_price,
      subtotal: a.subtotal,
    });
  }

  // Absolute URL for the guest accept link in the PDF.
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const acceptUrl = `${proto}://${baseHost}/q/${quote.id}/${quote.accept_token}`;

  const nights =
    quote.check_in && quote.check_out
      ? Math.max(
          1,
          Math.round(
            (new Date(quote.check_out).getTime() -
              new Date(quote.check_in).getTime()) /
              86_400_000,
          ),
        )
      : 1;

  const buffer = await renderQuotePdf({
    quoteNumber: quote.quote_number,
    status: quote.status as
      | "draft"
      | "sent"
      | "accepted"
      | "declined"
      | "expired"
      | "converted",
    createdAt: quote.created_at,
    validUntil: quote.valid_until,
    acceptUrl: quote.status === "sent" ? acceptUrl : null,
    host: {
      displayName: hostObj.display_name ?? null,
      handle: hostObj.handle ?? null,
      email: hostProfile?.email ?? null,
      phone: hostProfile?.phone ?? null,
      banking,
      business,
    },
    guest: {
      name: quote.guest_name,
      email: quote.guest_email,
      phone: quote.guest_phone,
    },
    stay: {
      listingName: listingObj?.name ?? null,
      checkIn: quote.check_in,
      checkOut: quote.check_out,
      nights,
      headcount: quote.headcount,
    },
    lines: lineRows,
    subtotal:
      quote.base_amount + quote.cleaning_fee + (quote.addons_total ?? 0),
    total: quote.total_amount,
    currency: quote.currency,
    notes: quote.notes,
    logoUrl: await hostLogoDataUri(hostObj.id),
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quote_number}.pdf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
