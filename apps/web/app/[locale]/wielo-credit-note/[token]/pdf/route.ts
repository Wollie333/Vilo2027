import { NextResponse } from "next/server";

import {
  wieloCreditNoteLabels,
  wieloLogoDataUri,
  wieloSnapshotToBusiness,
  type WieloBusinessProfile,
  type WieloCreditNoteKind,
} from "@/lib/billing/wielo-invoice";
import { getBrandName } from "@/lib/brand";
import { renderCreditNotePdf } from "@/lib/pdf/render";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type LineItem = { description: string; subtotal: number };
type BuyerSnap = { name?: string | null; email?: string | null };

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const supabase = createAdminClient();
  const { data: cn } = await supabase
    .from("wielo_credit_notes")
    .select(
      "credit_note_number, kind, status, issued_at, currency, total_amount, signed_amount, reason, wielo_snapshot, buyer_snapshot, line_items",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!cn) {
    return new NextResponse("Not found", { status: 404 });
  }

  const snap = (cn.wielo_snapshot ?? {}) as Partial<WieloBusinessProfile>;
  const buyer = (cn.buyer_snapshot ?? {}) as BuyerSnap;
  const lines = (
    Array.isArray(cn.line_items) ? cn.line_items : []
  ) as LineItem[];
  const kind = cn.kind as WieloCreditNoteKind;
  const labels = wieloCreditNoteLabels(kind, Number(cn.signed_amount));
  const brandName = await getBrandName();
  const logoUrl = await wieloLogoDataUri();
  const issuerName = snap.legal_name?.trim() || brandName;
  const legalLine =
    issuerName.toLowerCase() === brandName.toLowerCase()
      ? null
      : `${issuerName} trading as ${brandName}`;

  const buffer = await renderCreditNotePdf({
    creditNoteNumber: cn.credit_note_number,
    status: cn.status === "cancelled" ? "cancelled" : "issued",
    issuedAt: cn.issued_at,
    reason: cn.reason ?? null,
    docKind: labels.docKind,
    toLabel: labels.toLabel,
    totalLabel: labels.totalLabel,
    positive: labels.positive,
    host: {
      displayName: snap.legal_name ?? null,
      handle: null,
      email: snap.email ?? null,
      phone: null,
      business: wieloSnapshotToBusiness(snap),
    },
    guest: {
      name: buyer.name ?? null,
      email: buyer.email ?? null,
      phone: null,
    },
    lines: lines.map((l) => ({
      label: l.description,
      amount: Number(l.subtotal),
    })),
    total: Number(cn.total_amount),
    currency: cn.currency,
    legalLine,
    logoUrl,
    // No custom Wielo logo uploaded → show the Wielo roundel, not "MP" initials.
    fallbackMark: { kind: "wielo" },
    brandName,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${cn.credit_note_number}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
