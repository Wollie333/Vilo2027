import { NextResponse } from "next/server";

import { loadCommissionStatement } from "@/lib/billing/commission-statement";
import {
  getWieloBusinessProfile,
  wieloLogoDataUri,
  wieloSnapshotToBusiness,
} from "@/lib/billing/wielo-invoice";
import { getBrandName } from "@/lib/brand";
import { renderCreditNotePdf } from "@/lib/pdf/render";

export const dynamic = "force-dynamic";

// Affiliate commission statement / payout remittance PDF — reuses the generic
// credit-note paper (issuer = Wielo, recipient = the affiliate). Sibling of
// /wielo-credit-note/[token]/pdf.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const stmt = await loadCommissionStatement(params.id);
  if (!stmt) return new NextResponse("Not found", { status: 404 });

  const snap = await getWieloBusinessProfile();

  const buffer = await renderCreditNotePdf({
    creditNoteNumber: stmt.number,
    status: "issued",
    issuedAt: stmt.dateIso ?? new Date().toISOString(),
    reason: stmt.footerNote ?? null,
    docKind: stmt.docKind,
    toLabel: "Payable to",
    totalLabel: stmt.totalLabel,
    positive: true, // money owed to / paid the affiliate — ink, not red
    host: {
      displayName: snap.legal_name ?? null,
      handle: null,
      email: snap.email ?? null,
      phone: null,
      business: wieloSnapshotToBusiness(snap),
    },
    guest: {
      name: stmt.affiliateName ?? null,
      email: stmt.affiliateEmail ?? null,
      phone: null,
    },
    lines: stmt.lines,
    total: stmt.total,
    currency: stmt.currency,
    logoUrl: await wieloLogoDataUri(),
    // No custom Wielo logo uploaded → show the Wielo roundel, not "MP" initials.
    fallbackMark: { kind: "wielo" },
    brandName: await getBrandName(),
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${stmt.number}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
