import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialDocument,
  type DocLine,
} from "@/components/finance/FinancialDocument";
import {
  wieloCreditNoteLabels,
  wieloIssuerLines,
  type WieloBusinessProfile,
  type WieloCreditNoteKind,
} from "@/lib/billing/wielo-invoice";
import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Credit note",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};
type BuyerSnap = { name?: string | null; email?: string | null };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

// The public record page for a Wielo credit note / refund / adjustment — the
// sibling of /wielo-invoice/[token], using the same FinancialDocument paper.
export default async function PublicWieloCreditNotePage({
  params,
}: {
  params: { token: string; locale: string };
}) {
  const admin = createAdminClient();
  const { data: cn } = await admin
    .from("wielo_credit_notes")
    .select(
      "credit_note_number, kind, status, issued_at, subtotal, vat_amount, total_amount, signed_amount, currency, reason, wielo_snapshot, buyer_snapshot, line_items, hosted_token",
    )
    .eq("hosted_token", params.token)
    .maybeSingle();

  if (!cn) notFound();

  const brandName = await getBrandName();
  const c = cn.currency;
  const kind = cn.kind as WieloCreditNoteKind;
  const labels = wieloCreditNoteLabels(kind, Number(cn.signed_amount));
  const issuer = wieloIssuerLines(
    (cn.wielo_snapshot ?? {}) as Partial<WieloBusinessProfile>,
  );
  const buyer = (cn.buyer_snapshot ?? {}) as BuyerSnap;
  const lines = (
    Array.isArray(cn.line_items) ? cn.line_items : []
  ) as LineItem[];
  const vat = Number(cn.vat_amount ?? 0);
  const hasVat = vat > 0.005;
  const cancelled = cn.status === "cancelled";
  const sign = labels.positive ? "+" : "−";

  const lineRows: DocLine[] = lines.map((l) => ({
    title: l.description,
    mid: l.quantity > 1 ? `× ${l.quantity}` : null,
    amount: `${sign}${formatMoney(l.subtotal, c)}`,
  }));

  return (
    <FinancialDocument
      kind={labels.docKind}
      number={cn.credit_note_number}
      status={{
        label: cancelled ? "Cancelled" : "Issued",
        tone: cancelled ? "grey" : labels.statusTone,
      }}
      brandName={brandName}
      brandTagline="Direct booking platform"
      from={issuer}
      fromMark={{ kind: "wielo" }}
      to={{
        label: labels.toLabel,
        party: {
          name: buyer.name ?? "Customer",
          lines: [buyer.email].filter(Boolean) as string[],
        },
      }}
      balance={{
        label:
          kind === "refund"
            ? "Amount Refunded"
            : kind === "credit"
              ? "Credit Amount"
              : "Adjustment",
        value: `${sign}${formatMoney(cn.total_amount, c)}`,
        positive: labels.positive,
      }}
      metaRows={[{ label: "Issue date", value: fmtDate(cn.issued_at) }]}
      lineHeaders={{ desc: "Description", amount: "Amount" }}
      lines={lineRows}
      totals={[
        {
          label: "Subtotal",
          value: `${sign}${formatMoney(cn.subtotal, c)}`,
        },
        ...(hasVat
          ? [{ label: "VAT (15%)", value: `${sign}${formatMoney(vat, c)}` }]
          : []),
      ]}
      grandTotal={{
        label: labels.totalLabel,
        value: `${sign}${formatMoney(cn.total_amount, c)}`,
      }}
      pdfHref={`/${params.locale}/wielo-credit-note/${cn.hosted_token}/pdf`}
      footerTitle={cn.reason ? "Reason" : undefined}
      footerNote={cn.reason ?? undefined}
    />
  );
}
