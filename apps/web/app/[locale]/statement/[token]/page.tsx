import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FinancialDocument,
  type DocLine,
  type DocTotal,
} from "@/components/finance/FinancialDocument";
import { getBrandName } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import { loadStatement } from "@/lib/finance/statement";
import { verifyStatementToken } from "@/lib/finance/statement-token";

export const metadata: Metadata = {
  title: "Statement of account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function signed(amount: number, currency: string): string {
  if (!amount) return "—";
  const mag = formatMoney(Math.abs(amount), currency);
  return amount > 0 ? `+${mag}` : `−${mag}`;
}

export default async function StatementPage({
  params,
}: {
  params: { token: string; locale: string };
}) {
  const tok = verifyStatementToken(params.token);
  if (!tok) notFound();

  const stmt = await loadStatement(tok);
  if (!stmt) notFound();

  const brandName = await getBrandName();
  const c = stmt.currency;

  const periodLabel = stmt.periodFrom
    ? `${fmtDate(stmt.periodFrom)} – ${fmtDate(stmt.periodTo)}`
    : `All activity to ${fmtDate(stmt.periodTo)}`;

  // Opening "brought forward" line, then one signed movement per entry with the
  // running balance in the amount column.
  const lines: DocLine[] = [
    {
      title: "Balance brought forward",
      sub: stmt.periodFrom ? `As at ${fmtDate(stmt.periodFrom)}` : "Opening",
      mid: null,
      amount: formatMoney(stmt.openingBalance, c),
    },
    ...stmt.lines.map((l) => ({
      title: l.title,
      sub: [fmtDate(l.date), l.sub].filter(Boolean).join(" · "),
      mid: signed(l.amount, c),
      amount: formatMoney(l.balance, c),
    })),
  ];

  const totals: DocTotal[] = [
    { label: "Total charges", value: formatMoney(stmt.totalCharges, c) },
    {
      label: "Total payments & credits",
      value: `−${formatMoney(stmt.totalPayments, c)}`,
    },
  ];

  const trailingTotals: DocTotal[] =
    stmt.vatIncluded != null
      ? [
          {
            label: `VAT included (${stmt.vatRate ?? 15}%)`,
            value: formatMoney(stmt.vatIncluded, c),
            tone: "mute",
          },
        ]
      : [];

  return (
    <FinancialDocument
      kind={stmt.kind}
      number={stmt.reference}
      status={{
        label: stmt.outstanding ? "Balance due" : "Settled",
        tone: stmt.outstanding ? "amber" : "green",
      }}
      brandName={brandName}
      brandTagline="Direct booking platform"
      from={stmt.issuer}
      to={{ label: stmt.recipientLabel, party: stmt.recipient }}
      metaRows={[
        { label: "Statement date", value: fmtDate(stmt.issuedAt) },
        { label: "Period", value: periodLabel },
        { label: "Currency", value: c },
      ]}
      lineHeaders={{
        desc: "Date & description",
        mid: "Amount",
        amount: "Balance",
      }}
      lines={lines}
      totals={totals}
      grandTotal={{
        label: stmt.balanceLabel,
        value: formatMoney(stmt.closingBalance, c),
      }}
      trailingTotals={trailingTotals}
      pdfHref={`/${params.locale}/statement/${params.token}/pdf`}
      footerTitle="About this statement"
      footerNote="A summary of account activity for the period shown, as a running balance — a positive balance is owed, a negative balance is in credit. This is a summary, not a tax invoice."
    />
  );
}
