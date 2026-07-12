import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialDocument,
  type DocLine,
} from "@/components/finance/FinancialDocument";
import {
  loadCommissionStatement,
  type CommissionStatement,
} from "@/lib/billing/commission-statement";
import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: "Commission statement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

// The public record page for an affiliate commission statement / payout
// remittance advice — the affiliate-facing sibling of /wielo-credit-note, using
// the same FinancialDocument paper. Issued BY Wielo TO the affiliate.
export default async function PublicCommissionStatementPage({
  params,
}: {
  params: { id: string; locale: string };
}) {
  const stmt: CommissionStatement | null = await loadCommissionStatement(
    params.id,
  );
  if (!stmt) notFound();

  const brandName = await getBrandName();
  const c = stmt.currency;

  const lineRows: DocLine[] = stmt.lines.map((l) => ({
    title: l.label,
    mid: null,
    amount: formatMoney(l.amount, c),
  }));

  return (
    <FinancialDocument
      kind={stmt.docKind}
      number={stmt.number}
      status={{ label: stmt.statusLabel, tone: stmt.statusTone }}
      brandName={brandName}
      brandTagline="Direct booking platform"
      from={stmt.issuer}
      to={{
        label: "Payable to",
        party: {
          name: stmt.affiliateName ?? "Affiliate",
          lines: [stmt.affiliateEmail].filter(Boolean) as string[],
        },
      }}
      metaRows={[{ label: "Date", value: fmtDate(stmt.dateIso) }]}
      lineHeaders={{ desc: "Description", amount: "Amount" }}
      lines={lineRows}
      totals={[{ label: "Subtotal", value: formatMoney(stmt.total, c) }]}
      grandTotal={{ label: stmt.totalLabel, value: formatMoney(stmt.total, c) }}
      pdfHref={`/${params.locale}/wielo-commission/${params.id}/pdf`}
      footerTitle={stmt.footerNote ? "Note" : undefined}
      footerNote={stmt.footerNote ?? undefined}
    />
  );
}
