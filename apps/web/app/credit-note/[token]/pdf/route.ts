import { NextResponse } from "next/server";

import type { InvoiceBusiness } from "@/lib/pdf/InvoiceDocument";
import { hostLogoDataUri } from "@/lib/pdf/logo";
import { renderCreditNotePdf } from "@/lib/pdf/render";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
  business?: BusinessSnap | null;
};
type GuestSnap = { name?: string; email?: string; phone?: string };
type CnLine = { label: string; amount: number | string };

function buildBusiness(
  snap: BusinessSnap | null | undefined,
): InvoiceBusiness | null {
  if (!snap) return null;
  const addressLines = [
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
  { params }: { params: { token: string } },
) {
  const db = createAdminClient();
  const { data: cn } = await db
    .from("credit_notes")
    .select(
      "credit_note_number, status, issued_at, currency, total_amount, reason, host_id, host_snapshot, guest_snapshot, line_items, invoice:invoices!inner ( invoice_number )",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!cn) return new NextResponse("Not found", { status: 404 });

  const host = cn.host_snapshot as Snap;
  const guest = cn.guest_snapshot as GuestSnap;
  const lines = ((cn.line_items as CnLine[]) ?? []).map((l) => ({
    label: l.label,
    amount: Number(l.amount),
  }));
  const invoiceNumber =
    (cn.invoice as unknown as { invoice_number?: string } | null)
      ?.invoice_number ?? null;

  const buffer = await renderCreditNotePdf({
    creditNoteNumber: cn.credit_note_number,
    status: cn.status as "draft" | "issued" | "cancelled",
    issuedAt: cn.issued_at,
    invoiceNumber,
    reason: cn.reason,
    host: {
      displayName: host.display_name ?? null,
      handle: host.handle ?? null,
      email: host.email ?? null,
      phone: host.phone ?? null,
      business: buildBusiness(host.business),
    },
    guest: {
      name: guest.name ?? null,
      email: guest.email ?? null,
      phone: guest.phone ?? null,
    },
    lines,
    total: Number(cn.total_amount),
    currency: cn.currency,
    logoUrl: await hostLogoDataUri(cn.host_id),
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${cn.credit_note_number}.pdf"`,
    },
  });
}
