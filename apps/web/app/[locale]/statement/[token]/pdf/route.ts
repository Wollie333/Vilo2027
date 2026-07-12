import { NextResponse } from "next/server";

import { getBrandName } from "@/lib/brand";
import { loadStatement } from "@/lib/finance/statement";
import { verifyStatementToken } from "@/lib/finance/statement-token";
import { renderStatementPdf } from "@/lib/pdf/render";

export const dynamic = "force-dynamic";

// Statement of Account PDF — derives the same slice from the live ledger as the
// hosted page (no stored copy) and renders it via the shared react-pdf paper.
export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const tok = verifyStatementToken(params.token);
  if (!tok) return new NextResponse("Not found", { status: 404 });

  const stmt = await loadStatement(tok);
  if (!stmt) return new NextResponse("Not found", { status: 404 });

  const buffer = await renderStatementPdf({
    reference: stmt.reference,
    issuer: stmt.issuer,
    recipientLabel: stmt.recipientLabel,
    recipient: stmt.recipient,
    periodFrom: stmt.periodFrom,
    periodTo: stmt.periodTo,
    issuedAt: stmt.issuedAt,
    currency: stmt.currency,
    openingBalance: stmt.openingBalance,
    lines: stmt.lines,
    closingBalance: stmt.closingBalance,
    totalCharges: stmt.totalCharges,
    totalPayments: stmt.totalPayments,
    vatIncluded: stmt.vatIncluded,
    vatRate: stmt.vatRate,
    balanceLabel: stmt.balanceLabel,
    brandName: await getBrandName(),
    logoUrl: null,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${stmt.reference}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
