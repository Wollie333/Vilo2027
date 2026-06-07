import { NextResponse } from "next/server";

import { getBrandName } from "@/lib/brand";
import { hostLogoDataUri } from "@/lib/pdf/logo";
import { renderReceiptPdf } from "@/lib/pdf/render";
import { getReceiptByToken } from "@/lib/payments/receipt-data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const receipt = await getReceiptByToken(params.token);
  if (!receipt) return new NextResponse("Not found", { status: 404 });

  const [logoUrl, brandName] = await Promise.all([
    hostLogoDataUri(receipt.hostId),
    getBrandName(),
  ]);

  const buffer = await renderReceiptPdf({
    receiptNumber: receipt.receiptNumber,
    paidAt: receipt.paidAt,
    method: receipt.method,
    kindLabel: receipt.kindLabel,
    host: receipt.host,
    guest: receipt.guest,
    stay: receipt.stay,
    bookingRef: receipt.bookingRef,
    amount: receipt.amount,
    currency: receipt.currency,
    balanceAfter: receipt.balanceAfter,
    logoUrl,
    brandName,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receipt.receiptNumber}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
