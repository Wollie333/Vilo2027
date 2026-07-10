"use client";

import { ArrowLeft, Download, Printer, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

// The canonical record-page "paper" for EVERY financial document — invoice,
// receipt, quote, credit note, refund. Same shell, different content, so the
// brand experience is identical wherever money is documented. Presentational +
// print-aware (the action bar is hidden when printing).

export type DocTone = "green" | "amber" | "red" | "indigo" | "grey";

const TONE: Record<DocTone, { tag: string; dot: string }> = {
  green: {
    tag: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  amber: {
    tag: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  red: { tag: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
  indigo: {
    tag: "bg-indigo-50 text-indigo-600 border-indigo-200",
    dot: "bg-indigo-500",
  },
  grey: {
    tag: "bg-brand-light text-brand-mute border-brand-line",
    dot: "bg-brand-mute",
  },
};

export type DocParty = { name: string; lines: string[] };
export type DocMetaRow = { label: string; value: string; strong?: boolean };
export type DocLine = {
  title: string;
  sub?: string | null;
  mid?: string | null;
  amount: string;
};
export type DocTotal = {
  label: string;
  value: string;
  tone?: "ink" | "mute" | "good";
};

export type FinancialDocumentProps = {
  kind: string;
  number: string;
  status: { label: string; tone: DocTone };
  brandName: string;
  brandTagline?: string;
  from: DocParty;
  to: { label: string; party: DocParty };
  metaRows: DocMetaRow[];
  stay?: {
    listingName: string | null;
    checkIn: string;
    checkOut: string;
    nights: string;
  } | null;
  lineHeaders: { desc: string; mid?: string; amount: string };
  lines: DocLine[];
  totals: DocTotal[];
  grandTotal: { label: string; value: string };
  trailingTotals?: DocTotal[];
  banking?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    accountType: string;
    branchCode: string;
    swiftCode: string | null;
    reference: string | null;
  } | null;
  /** Heading over the banking card (default "Payment details"). Paid documents
   *  pass "Banking details" since it's informational, not a request to pay. */
  bankingLabel?: string;
  stamp?: string | null;
  footerTitle?: string;
  footerNote?: string;
  backHref?: string;
  pdfHref: string;
  viewHref?: { href: string; label: string } | null;
  /** Extra action-bar buttons (e.g. a Send control). */
  actions?: ReactNode;
  /** Interactive content rendered under the paper (e.g. quote accept/decline).
   *  Hidden when printing. */
  belowPaper?: ReactNode;
};

export function FinancialDocument(p: FinancialDocumentProps) {
  const tone = TONE[p.status.tone];

  return (
    <div className="min-h-screen bg-[#EEF4F0]">
      {/* action bar */}
      <div className="no-print sticky top-0 z-20 border-b border-brand-line bg-[#EEF4F0]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[860px] items-center gap-3 px-5 py-3">
          {p.backHref ? (
            <Link
              href={p.backHref}
              className="flex h-9 w-9 items-center justify-center rounded-pill text-brand-mute transition hover:bg-white hover:text-brand-ink"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : null}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold leading-none text-brand-mute">
              {p.kind}
            </div>
            <div className="mt-1 truncate font-mono text-[12.5px] font-semibold text-brand-ink">
              {p.number}
            </div>
          </div>
          <span
            className={`ml-1 hidden items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-semibold sm:inline-flex ${tone.tag}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {p.status.label}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <PrintButton />
            {p.actions}
            <a
              href={p.pdfHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-primary px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,.6)] transition hover:bg-brand-secondary"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </div>
        </div>
      </div>

      {/* paper */}
      <div className="sheet-wrap px-4 py-8 sm:py-10">
        <div className="mx-auto max-w-[820px] overflow-hidden rounded-[20px] border border-brand-line bg-white shadow-[0_30px_70px_-32px_rgba(6,78,59,.28),0_6px_16px_rgba(6,78,59,.05)]">
          <div className="p-8 sm:p-12">
            {/* header */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="font-display text-[19px] font-extrabold leading-none tracking-tight text-brand-ink">
                  {p.brandName}
                </div>
                {p.brandTagline ? (
                  <div className="mt-1.5 text-[11.5px] text-brand-mute">
                    {p.brandTagline}
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="font-display text-[26px] font-extrabold leading-none tracking-tight text-brand-ink">
                  {p.kind}
                </div>
                <div className="mt-2 font-mono text-[12px] text-brand-mute">
                  {p.number}
                </div>
                <div className="mt-2.5 flex justify-end">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-semibold ${tone.tag}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {p.status.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="my-8 h-px bg-brand-line" />

            {/* parties + meta */}
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <Party label="From" party={p.from} />
              <Party label={p.to.label} party={p.to.party} />
              <div className="rounded-[12px] border border-brand-line bg-[#F6FAF7] p-4">
                {p.metaRows.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 text-[12.5px] ${i > 0 ? "mt-2" : ""}`}
                  >
                    <span className="text-brand-mute">{m.label}</span>
                    <span className="font-semibold text-brand-ink">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* stay summary */}
            {p.stay ? (
              <div className="mt-9">
                <div className="eyebrow mb-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8AA89B]">
                  Stay summary
                </div>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-brand-line bg-brand-line sm:grid-cols-4">
                  <Cell label="Listing" value={p.stay.listingName ?? "—"} dot />
                  <Cell label="Check-in" value={p.stay.checkIn} />
                  <Cell label="Check-out" value={p.stay.checkOut} />
                  <Cell label="Nights" value={p.stay.nights} />
                </div>
              </div>
            ) : null}

            {/* line items */}
            <div className="mt-9">
              <div className="grid grid-cols-[1fr_auto] gap-x-8 border-b-2 border-brand-secondary/15 pb-2.5 sm:grid-cols-[1fr_auto_auto]">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7C9A8C]">
                  {p.lineHeaders.desc}
                </div>
                {p.lineHeaders.mid ? (
                  <div className="hidden text-right text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7C9A8C] sm:block">
                    {p.lineHeaders.mid}
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}
                <div className="text-right text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#7C9A8C]">
                  {p.lineHeaders.amount}
                </div>
              </div>

              {p.lines.map((l, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-8 border-b border-brand-line py-4 sm:grid-cols-[1fr_auto_auto]"
                >
                  <div>
                    <div className="text-[14px] font-semibold text-brand-ink">
                      {l.title}
                    </div>
                    {l.sub ? (
                      <div className="mt-0.5 text-[12px] text-brand-mute">
                        {l.sub}
                      </div>
                    ) : null}
                  </div>
                  <div className="num hidden whitespace-nowrap text-right text-[13px] text-brand-mute sm:block">
                    {l.mid ?? ""}
                  </div>
                  <div className="num whitespace-nowrap text-right text-[14px] font-semibold text-brand-ink">
                    {l.amount}
                  </div>
                </div>
              ))}

              {/* totals */}
              <div className="flex justify-end pt-5">
                <div className="w-full max-w-[300px]">
                  {p.totals.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5 text-[13px]"
                    >
                      <span className="text-brand-mute">{t.label}</span>
                      <span
                        className={`num whitespace-nowrap ${t.tone === "mute" ? "text-brand-mute" : "font-semibold text-brand-ink"}`}
                      >
                        {t.value}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between rounded-[12px] bg-brand-secondary px-4 py-3 text-white">
                    <span className="whitespace-nowrap font-display text-[13px] font-bold">
                      {p.grandTotal.label}
                    </span>
                    <span className="num whitespace-nowrap font-display text-[19px] font-extrabold">
                      {p.grandTotal.value}
                    </span>
                  </div>
                  {p.trailingTotals?.map((t, i) => (
                    <div
                      key={i}
                      className="mt-2.5 flex items-center justify-between py-1 text-[13px]"
                    >
                      <span className="text-brand-mute">{t.label}</span>
                      <span
                        className={`num font-semibold ${t.tone === "good" ? "text-status-confirmed" : "text-brand-ink"}`}
                      >
                        {t.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* banking — small light-green card, bottom-left. Each detail on its
                own line, always ending with the document number as the payment
                reference. Identical on every invoice (Wielo → user + host →
                guest). */}
            {p.banking ? (
              <div className="mt-8 w-full max-w-[300px] rounded-[12px] border border-emerald-100 bg-[#F0F9F3] p-4">
                <div className="eyebrow mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8AA89B]">
                  {p.bankingLabel ?? "Payment details"}
                </div>
                <dl className="space-y-1 text-[12.5px]">
                  <BankRow label="Bank" value={p.banking.bankName} />
                  {p.banking.accountHolder ? (
                    <BankRow
                      label="Account name"
                      value={p.banking.accountHolder}
                    />
                  ) : null}
                  <BankRow
                    label="Account no"
                    value={p.banking.accountNumber}
                    mono
                  />
                  {p.banking.branchCode ? (
                    <BankRow label="Branch" value={p.banking.branchCode} mono />
                  ) : null}
                  {p.banking.swiftCode ? (
                    <BankRow label="SWIFT" value={p.banking.swiftCode} mono />
                  ) : null}
                  <BankRow label="Ref #" value={p.number} mono emphasize />
                </dl>
              </div>
            ) : null}

            {/* stamp */}
            {p.stamp ? (
              <div className="my-9 flex items-center gap-5">
                <div className="h-px flex-1 bg-brand-line" />
                <span className="rotate-[-9deg] rounded-[12px] border-[2.5px] border-emerald-500/55 px-4 py-1.5 font-display text-[20px] font-extrabold uppercase tracking-[0.12em] text-emerald-700/70 shadow-[inset_0_0_0_2px_rgba(16,185,129,.12)]">
                  {p.stamp}
                </span>
                <div className="h-px flex-1 bg-brand-line" />
              </div>
            ) : null}

            {/* footer */}
            {p.footerTitle || p.footerNote ? (
              <div className="mt-9 flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-md">
                  {p.footerTitle ? (
                    <div className="text-[13px] font-semibold text-brand-ink">
                      {p.footerTitle}
                    </div>
                  ) : null}
                  {p.footerNote ? (
                    <p className="mt-1 text-[12px] leading-relaxed text-brand-mute">
                      {p.footerNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-brand-mute">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />{" "}
                  Issued via {p.brandName}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {p.belowPaper ? (
          <div className="no-print mx-auto mt-4 max-w-[820px]">
            {p.belowPaper}
          </div>
        ) : null}

        {p.viewHref ? (
          <div className="no-print mx-auto mt-4 max-w-[820px] px-2 text-center text-[11.5px] text-brand-mute">
            <Link
              href={p.viewHref.href}
              className="font-medium text-brand-secondary hover:underline"
            >
              {p.viewHref.label}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// One stacked bank-detail line: muted label on the left, value on the right.
function BankRow({
  label,
  value,
  mono,
  emphasize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-brand-mute">{label}</dt>
      <dd
        className={`text-right font-semibold ${mono ? "num" : "font-sans"} ${
          emphasize ? "text-brand-secondary" : "text-brand-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Party({ label, party }: { label: string; party: DocParty }) {
  return (
    <div>
      <div className="eyebrow text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8AA89B]">
        {label}
      </div>
      <div className="mt-2.5 text-[14.5px] font-semibold text-brand-ink">
        {party.name}
      </div>
      {party.lines.map((l, i) => (
        <div key={i} className="mt-0.5 text-[12.5px] text-brand-mute">
          {l}
        </div>
      ))}
    </div>
  );
}

function Cell({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot?: boolean;
}) {
  return (
    <div className="bg-white p-4">
      <div className="text-[11px] text-brand-mute">{label}</div>
      <div className="num mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-brand-ink">
        {dot ? (
          <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
        ) : null}
        {value}
      </div>
    </div>
  );
}

function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-9 w-9 items-center justify-center rounded-pill text-brand-mute transition hover:bg-white hover:text-brand-ink"
      title="Print"
    >
      <Printer className="h-[18px] w-[18px]" />
    </button>
  );
}
