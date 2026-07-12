import { NextResponse } from "next/server";

import { getBrandName } from "@/lib/brand";
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
  const { data: fs } = await db
    .from("forfeit_statements")
    .select(
      "statement_number, created_at, currency, booking_total, amount_paid, amount_forfeited, amount_refunded, amount_written_off, policy_applied, reason, host_id, host_snapshot, guest_snapshot",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!fs) return new NextResponse("Not found", { status: 404 });

  const host = fs.host_snapshot as Snap;
  const guest = fs.guest_snapshot as GuestSnap;
  const refunded = Number(fs.amount_refunded ?? 0);

  const lines = [
    { label: "Booking total", amount: Number(fs.booking_total) },
    { label: "Amount paid", amount: Number(fs.amount_paid) },
    { label: "Outstanding written off", amount: Number(fs.amount_written_off) },
    ...(refunded > 0 ? [{ label: "Refunded to guest", amount: refunded }] : []),
  ];

  const buffer = await renderCreditNotePdf({
    creditNoteNumber: fs.statement_number,
    status: "issued",
    issuedAt: fs.created_at,
    docKind: "Forfeit statement",
    toLabel: "Guest",
    totalLabel: "Retained by host",
    positive: true,
    reason:
      fs.reason ??
      `No-show / abandoned booking${fs.policy_applied ? ` · ${fs.policy_applied}` : ""}. Amount paid retained; outstanding written off. No refund due.`,
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
    total: Number(fs.amount_forfeited),
    currency: fs.currency,
    logoUrl: await hostLogoDataUri(fs.host_id),
    brandName: await getBrandName(),
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fs.statement_number}.pdf"`,
    },
  });
}
