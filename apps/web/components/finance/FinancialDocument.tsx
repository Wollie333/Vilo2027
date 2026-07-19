"use client";

import { ArrowLeft, Download, Printer, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

// The canonical record-page "paper" for EVERY financial document — invoice,
// receipt, quote, credit note, refund, statement. Same shell, different content,
// so the brand experience is identical wherever money is documented. A faithful
// port of the founder's billing-template pack (Wielo → user + host → guest):
// logo-marked issuer header, balance box, bordered facts card, summary strip,
// dark-header line table, grand-total bar, payment + notes/terms foot, thanks
// band and a running footer. Presentational + print-aware (the action bar and
// interactive extras are hidden when printing).

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
  /** Middle column (e.g. "× 2") for the simple 3-column shape. */
  mid?: string | null;
  /** Qty column — when set (with `rate`) the full #/Qty/Rate/Amount table shows. */
  qty?: string | null;
  /** Rate (unit price) column. */
  rate?: string | null;
  amount: string;
  /** Tints the amount green (a credit received) or red (a charge). */
  amountTone?: "pos" | "neg" | null;
};
export type DocTotal = {
  label: string;
  value: string;
  tone?: "ink" | "mute" | "good";
};

/** Header logo mark: the Wielo roundel, a gradient initials square, or a logo. */
export type DocMark =
  | { kind: "wielo" }
  | { kind: "initials"; text: string }
  | { kind: "logo"; url: string };

/** One cell of the summary strip (stay details / subscription / statement). */
export type DocSummaryCell = {
  label: string;
  value: string;
  dot?: boolean;
  mono?: boolean;
};

/** A key/value row inside the left foot box (payment / contact details). */
export type DocFootRow = { k: string; v: string; mono?: boolean };
/** A titled paragraph in the right foot column (Notes, Terms & Conditions). */
export type DocNote = { title: string; body: string };

export type DocBanking = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: string;
  branchCode: string;
  swiftCode: string | null;
  reference: string | null;
};

export type FinancialDocumentProps = {
  kind: string;
  number: string;
  status: { label: string; tone: DocTone };
  brandName: string;
  brandTagline?: string;

  /** Issuer identity shown top-left with a logo mark. */
  from: DocParty;
  /** Header logo mark. Defaults to a gradient square of `from.name`'s initials. */
  fromMark?: DocMark;
  to: { label: string; party: DocParty };
  metaRows: DocMetaRow[];

  /** Prominent amount box under the document title (Balance Due / Amount
   *  Received). When omitted, the header shows the status pill instead. */
  balance?: { label: string; value: string; positive?: boolean } | null;

  /** Booking stay strip. Superseded by `summary` when that is provided. */
  stay?: {
    listingName: string | null;
    checkIn: string;
    checkOut: string;
    nights: string;
  } | null;
  /** Custom summary strip (2–5 cells) — subscription period, statement totals… */
  summary?: DocSummaryCell[] | null;

  lineHeaders: {
    desc: string;
    mid?: string;
    qty?: string;
    rate?: string;
    amount: string;
  };
  lines: DocLine[];

  totals: DocTotal[];
  grandTotal: { label: string; value: string };
  /** Bold rows under the grand-total bar (Balance Due, Credit Remaining…). */
  trailingTotals?: DocTotal[];

  banking?: DocBanking | null;
  /** Heading over the synthesized payment box (default "Payment details"). */
  bankingLabel?: string;
  /** Left foot box (payment / account contact). Overrides the `banking` box. */
  footBox?: { title: string; rows: DocFootRow[]; dashed?: boolean } | null;
  /** Right foot column paragraphs (Notes, Terms & Conditions). */
  notes?: DocNote[];

  stamp?: string | null;
  /** Thanks band (bottom). Falls back to footerTitle / footerNote. */
  thanks?: { title: string; subtitle?: string } | null;
  footerTitle?: string;
  footerNote?: string;

  /** Running footer at the foot of the paper. Auto-derived when omitted. */
  runningFooter?: { left: string; right: string } | null;
  /** Very-small-print legal line under the footer (e.g. "X trading as Wielo"). */
  legalLine?: string | null;

  backHref?: string;
  pdfHref: string;
  viewHref?: { href: string; label: string } | null;
  /** Extra action-bar buttons (e.g. a Send control). */
  actions?: ReactNode;
  /** Interactive content rendered under the paper (e.g. quote accept/decline).
   *  Hidden when printing. */
  belowPaper?: ReactNode;
};

const EYEBROW =
  "text-[9.5px] font-bold uppercase tracking-[0.13em] text-[#8AA89B]";
const MONO = "font-mono num";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "W";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function FinancialDocument(p: FinancialDocumentProps) {
  const tone = TONE[p.status.tone];
  const mark: DocMark = p.fromMark ?? {
    kind: "initials",
    text: initialsOf(p.from.name),
  };

  // Summary strip: explicit cells win; else derive from the booking stay.
  const summary: DocSummaryCell[] | null =
    p.summary ??
    (p.stay
      ? [
          { label: "Listing", value: p.stay.listingName ?? "—", dot: true },
          { label: "Check-in", value: p.stay.checkIn, mono: true },
          { label: "Check-out", value: p.stay.checkOut, mono: true },
          { label: "Nights", value: p.stay.nights, mono: true },
        ]
      : null);

  // Any line carrying qty/rate opts the whole table into the #/Qty/Rate/Amount
  // layout; otherwise it's the compact Description [· mid] Amount shape.
  const richTable = p.lines.some((l) => l.qty != null || l.rate != null);
  const hasMid = !richTable && p.lines.some((l) => l.mid != null);

  // Left foot box: explicit footBox wins; else synthesize from banking details.
  const footBox =
    p.footBox ?? bankingToFootBox(p.banking, p.bankingLabel, p.number);
  const notes = p.notes ?? [];
  const thanks =
    p.thanks ??
    (p.footerTitle || p.footerNote
      ? { title: p.footerTitle ?? "Thank you", subtitle: p.footerNote }
      : null);

  const runningFooter = p.runningFooter ?? {
    left: `${p.from.name} · ${p.kind} ${p.number}`,
    right: `Issued via ${p.brandName} · wielo.co.za`,
  };

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
      <div className="sheet-wrap px-3 py-8 sm:py-10">
        <div className="mx-auto max-w-[794px] overflow-hidden rounded-[20px] border border-brand-line bg-white text-[12.5px] leading-[1.5] text-brand-ink shadow-[0_30px_70px_-32px_rgba(6,78,59,.28),0_6px_16px_rgba(6,78,59,.05)]">
          <div className="px-6 py-9 sm:px-14 sm:py-14">
            {/* ── header ── */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex items-start gap-3.5">
                <Mark mark={mark} />
                <div>
                  <div className="font-display text-[19px] font-extrabold leading-[1.05] tracking-[-0.01em] text-brand-ink">
                    {p.from.name}
                  </div>
                  <div className="mt-1.5 text-[11.5px] leading-[1.55] text-brand-mute">
                    {p.from.lines.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-left sm:shrink-0 sm:text-right">
                <div className="font-display text-[22px] font-extrabold uppercase leading-none tracking-[-0.01em] text-brand-ink sm:text-[27px]">
                  {p.kind}
                </div>
                <div className="mt-1.5 text-[11.5px] text-brand-mute">
                  # {p.number}
                </div>
                {p.balance ? (
                  <div
                    className={`mt-3 flex w-full items-center justify-between gap-5 rounded-[12px] border px-4 py-3 sm:w-auto sm:min-w-[250px] ${
                      p.balance.positive
                        ? "border-emerald-200 bg-[#F0FDF4]"
                        : "border-brand-accent bg-brand-light"
                    }`}
                  >
                    <span className="font-display text-[13px] font-bold text-brand-secondary">
                      {p.balance.label}
                    </span>
                    <span
                      className={`${MONO} text-[20px] font-semibold ${
                        p.balance.positive
                          ? "text-emerald-700"
                          : "text-brand-secondary"
                      }`}
                    >
                      {p.balance.value}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2.5 flex justify-end">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-semibold ${tone.tag}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                      />
                      {p.status.label}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="my-[22px] h-[2px] bg-brand-secondary/[0.14]" />

            {/* ── bill-to + facts ── */}
            <div className="grid grid-cols-1 gap-[26px] sm:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className={EYEBROW}>{p.to.label}</div>
                <div className="mt-[7px] text-[14px] font-bold text-brand-ink">
                  {p.to.party.name}
                </div>
                <div className="mt-1 text-[11.8px] leading-[1.55] text-brand-mute">
                  {p.to.party.lines.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </div>
              <div className="self-start overflow-hidden rounded-[12px] border border-[#E4EFE8]">
                {p.metaRows.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2 text-[12px] ${
                      i > 0 ? "border-t border-[#E4EFE8]" : ""
                    }`}
                  >
                    <span className="text-brand-mute">{m.label}</span>
                    <span className="font-semibold text-brand-ink">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── summary strip ── */}
            {summary && summary.length > 0 ? (
              <div
                className="mt-[22px] grid gap-px overflow-hidden rounded-[12px] border border-[#E4EFE8] bg-[#E4EFE8]"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                }}
              >
                {summary.map((c, i) => (
                  <div key={i} className="bg-white px-3.5 py-[11px]">
                    <div className="text-[10px] tracking-[0.02em] text-brand-mute">
                      {c.label}
                    </div>
                    <div
                      className={`mt-[3px] flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-ink ${
                        c.mono ? MONO : ""
                      }`}
                    >
                      {c.dot ? (
                        <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand-primary" />
                      ) : null}
                      {c.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* ── line items ── */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-brand-secondary text-white">
                    <th className="hidden w-[34px] rounded-l-lg px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.06em] sm:table-cell">
                      #
                    </th>
                    <th className="rounded-l-lg px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.06em] sm:rounded-none">
                      {p.lineHeaders.desc}
                    </th>
                    {richTable ? (
                      <>
                        <th className="hidden px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.06em] sm:table-cell">
                          {p.lineHeaders.qty ?? "Qty"}
                        </th>
                        <th className="hidden px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.06em] sm:table-cell">
                          {p.lineHeaders.rate ?? "Rate"}
                        </th>
                      </>
                    ) : hasMid ? (
                      <th className="hidden px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.06em] sm:table-cell">
                        {p.lineHeaders.mid ?? ""}
                      </th>
                    ) : null}
                    <th className="rounded-r-lg px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.06em]">
                      {p.lineHeaders.amount}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.lines.map((l, i) => (
                    <tr key={i} className="border-b border-[#E4EFE8]">
                      <td className="hidden px-3 py-3 text-center align-top text-[11px] text-brand-mute sm:table-cell">
                        {i + 1}
                      </td>
                      <td className="px-3 py-3 text-left align-top">
                        <div className="text-[13px] font-semibold text-brand-ink">
                          {l.title}
                        </div>
                        {l.sub ? (
                          <div className="mt-0.5 text-[11.3px] text-brand-mute">
                            {l.sub}
                          </div>
                        ) : null}
                      </td>
                      {richTable ? (
                        <>
                          <td
                            className={`hidden px-3 py-3 text-right align-top text-[12.5px] text-brand-ink sm:table-cell ${MONO}`}
                          >
                            {l.qty ?? "1"}
                          </td>
                          <td
                            className={`hidden px-3 py-3 text-right align-top text-[12.5px] text-brand-ink sm:table-cell ${MONO}`}
                          >
                            {l.rate ?? ""}
                          </td>
                        </>
                      ) : hasMid ? (
                        <td
                          className={`hidden px-3 py-3 text-right align-top text-[12.5px] text-brand-mute sm:table-cell ${MONO}`}
                        >
                          {l.mid ?? ""}
                        </td>
                      ) : null}
                      <td
                        className={`whitespace-nowrap px-3 py-3 text-right align-top text-[12.5px] font-semibold ${MONO} ${
                          l.amountTone === "pos"
                            ? "text-emerald-700"
                            : l.amountTone === "neg"
                              ? "text-red-700"
                              : "text-brand-ink"
                        }`}
                      >
                        {l.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── totals ── */}
            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-[290px]">
                {p.totals.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-1 py-1.5 text-[12.5px]"
                  >
                    <span className="text-brand-mute">{t.label}</span>
                    <span
                      className={`${MONO} whitespace-nowrap ${
                        t.tone === "mute"
                          ? "text-brand-mute"
                          : "font-semibold text-brand-ink"
                      }`}
                    >
                      {t.value}
                    </span>
                  </div>
                ))}
                <div className="my-1 h-px bg-[#E4EFE8]" />
                <div className="mt-1.5 flex items-center justify-between rounded-[11px] bg-brand-secondary px-4 py-3 text-white">
                  <span className="whitespace-nowrap font-display text-[13px] font-bold">
                    {p.grandTotal.label}
                  </span>
                  <span
                    className={`${MONO} whitespace-nowrap text-[19px] font-semibold`}
                  >
                    {p.grandTotal.value}
                  </span>
                </div>
                {p.trailingTotals?.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-1 pt-2.5 text-[12.5px] font-semibold"
                  >
                    <span className="text-brand-ink">{t.label}</span>
                    <span
                      className={`${MONO} whitespace-nowrap ${
                        t.tone === "good"
                          ? "text-emerald-700"
                          : "text-brand-secondary"
                      }`}
                    >
                      {t.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── foot: payment box + notes/terms ── */}
            {footBox && notes.length > 0 ? (
              <div className="mt-8 grid grid-cols-1 gap-[26px] sm:grid-cols-2">
                <FootBox box={footBox} />
                <NotesCol notes={notes} />
              </div>
            ) : notes.length > 0 ? (
              <div className="mt-8">
                <NotesCol notes={notes} />
              </div>
            ) : footBox ? (
              <div className="mt-8 max-w-[320px]">
                <FootBox box={footBox} />
              </div>
            ) : null}

            {/* ── stamp ── */}
            {p.stamp ? (
              <div className="mt-9 flex items-center gap-5">
                <div className="h-px flex-1 bg-brand-line" />
                <span className="rotate-[-8deg] rounded-[12px] border-[2.5px] border-emerald-500/55 px-4 py-1.5 font-display text-[18px] font-extrabold uppercase tracking-[0.12em] text-emerald-700/70">
                  {p.stamp}
                </span>
                <div className="h-px flex-1 bg-brand-line" />
              </div>
            ) : null}

            {/* ── thanks ── */}
            {thanks ? (
              <div className="mt-[26px] flex flex-wrap items-end justify-between gap-4 border-t border-[#E4EFE8] pt-[18px]">
                <div className="max-w-[340px]">
                  <div className="text-[13px] font-bold text-brand-ink">
                    {thanks.title}
                  </div>
                  {thanks.subtitle ? (
                    <div className="mt-[3px] text-[11.3px] leading-[1.55] text-brand-mute">
                      {thanks.subtitle}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-brand-mute">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" />
                  Issued via {p.brandName}
                </div>
              </div>
            ) : null}

            {/* ── running footer ── */}
            <div className="mt-6 border-t border-[#E4EFE8] pt-2">
              <div className="flex items-center justify-between gap-3 text-[10.5px] text-brand-mute">
                <span className="truncate">{runningFooter.left}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <WieloFooterMark />
                  {runningFooter.right}
                </span>
              </div>
              {p.legalLine ? (
                <div className="mt-1.5 text-center text-[9px] leading-tight text-brand-mute/75">
                  {p.legalLine}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {p.belowPaper ? (
          <div className="no-print mx-auto mt-4 max-w-[794px]">
            {p.belowPaper}
          </div>
        ) : null}

        {p.viewHref ? (
          <div className="no-print mx-auto mt-4 max-w-[794px] px-2 text-center text-[11.5px] text-brand-mute">
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

// Synthesize the left "Payment details" box from a banking block (back-compat
// for callers that pass `banking` rather than an explicit footBox). Ends with
// the document number as the payment reference, exactly like the mockup.
function bankingToFootBox(
  banking: DocBanking | null | undefined,
  label: string | undefined,
  docNumber: string,
): { title: string; rows: DocFootRow[]; dashed: boolean } | null {
  if (!banking) return null;
  const rows: DocFootRow[] = [{ k: "Bank", v: banking.bankName }];
  if (banking.accountHolder)
    rows.push({ k: "Account name", v: banking.accountHolder });
  rows.push({ k: "Account no.", v: banking.accountNumber, mono: true });
  if (banking.branchCode)
    rows.push({ k: "Branch code", v: banking.branchCode, mono: true });
  if (banking.swiftCode)
    rows.push({ k: "SWIFT", v: banking.swiftCode, mono: true });
  rows.push({ k: "Reference", v: banking.reference ?? docNumber, mono: true });
  return { title: label ?? "Payment details", rows, dashed: true };
}

function FootBox({
  box,
}: {
  box: { title: string; rows: DocFootRow[]; dashed?: boolean };
}) {
  return (
    <div>
      <h4 className={`mb-[7px] ${EYEBROW}`}>{box.title}</h4>
      <div
        className={`rounded-[11px] bg-[#F6FAF7] px-[15px] py-[13px] ${
          box.dashed
            ? "border border-dashed border-[#E4EFE8]"
            : "border border-[#E4EFE8]"
        }`}
      >
        {box.rows.map((r, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-4 py-0.5 text-[11.8px]"
          >
            <span className="text-brand-mute">{r.k}</span>
            <span
              className={`text-right font-semibold text-brand-ink ${
                r.mono ? MONO : ""
              }`}
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesCol({ notes }: { notes: DocNote[] }) {
  return (
    <div>
      {notes.map((n, i) => (
        <div key={i} className={i > 0 ? "mt-3.5" : ""}>
          <h4 className={`mb-[7px] ${EYEBROW}`}>{n.title}</h4>
          <p className="text-[11.5px] leading-[1.6] text-brand-mute">
            {n.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function Mark({ mark }: { mark: DocMark }) {
  if (mark.kind === "logo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mark.url}
        alt=""
        className="h-[52px] w-[52px] shrink-0 rounded-[13px] object-contain"
      />
    );
  }
  if (mark.kind === "wielo") {
    return (
      <svg
        width="52"
        height="52"
        viewBox="0 0 200 200"
        className="block shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="wbg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#12B886" />
            <stop offset="1" stopColor="#0B7A5A" />
          </linearGradient>
          <linearGradient id="wf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#C8EBDC" />
          </linearGradient>
          <linearGradient id="wbk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0E9D74" />
            <stop offset="1" stopColor="#075740" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#wbg)" />
        <path
          d="M52 62 L79 138 L100 92 L121 138 L148 62"
          fill="none"
          stroke="url(#wbk)"
          strokeWidth="26"
          strokeLinejoin="round"
          transform="translate(6,7)"
          opacity="0.9"
        />
        <path
          d="M52 62 L79 138 L100 92 L121 138 L148 62"
          fill="none"
          stroke="url(#wf)"
          strokeWidth="26"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <div className="brand-gradient flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[13px] font-display text-[21px] font-extrabold tracking-[0.02em] text-white">
      {mark.text}
    </div>
  );
}

// Tiny Wielo roundel shown in the "Issued via Wielo" running footer of every
// financial document (both families). A miniature of the header mark; its own
// gradient ids so it never collides with the header roundel on Wielo docs.
function WieloFooterMark() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 200 200"
      className="block shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wfoot-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12B886" />
          <stop offset="1" stopColor="#0B7A5A" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#wfoot-bg)" />
      <path
        d="M52 62 L79 138 L100 92 L121 138 L148 62"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="26"
        strokeLinejoin="round"
      />
    </svg>
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
