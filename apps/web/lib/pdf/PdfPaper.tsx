import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { BRAND } from "./styles";

// Shared react-pdf "paper" — a faithful port of the founder's billing-template
// pack, matching the on-screen FinancialDocument: logo-marked issuer header with
// full contact block, balance box, bordered facts card, summary strip,
// dark-header line table, filled grand-total bar, payment + notes/terms foot, a
// thanks band and a fixed "Issued via Wielo" running footer bottom-right. Every
// PDF document maps its own data onto this one layout so the paper is identical
// wherever money is documented. @react-pdf renders with the built-in Helvetica
// (registering the web fonts risks production failures — the typeface is the
// only intentional divergence from the on-screen render).

export type PdfMark =
  | { kind: "initials"; text: string }
  | { kind: "logo"; url: string };

export type PdfColumn = {
  label: string;
  flex: number;
  align?: "left" | "right" | "center";
};
export type PdfCell = {
  text: string;
  sub?: string | null;
  align?: "left" | "right" | "center";
  bold?: boolean;
  color?: string;
};
export type PdfFact = { label: string; value: string };
export type PdfSummaryCell = { label: string; value: string };
export type PdfTotal = { label: string; value: string; mute?: boolean };
export type PdfFootRow = { k: string; v: string };
export type PdfNote = { title: string; body: string };

export type PdfPaperProps = {
  kind: string;
  number: string;
  brandName: string;
  issuer: { mark: PdfMark; name: string; metaLines: string[] };
  billTo: { label: string; name: string; lines: string[] };
  facts: PdfFact[];
  balance: { label: string; value: string; positive?: boolean };
  summary?: PdfSummaryCell[] | null;
  columns: PdfColumn[];
  rows: PdfCell[][];
  totals: PdfTotal[];
  grand: { label: string; value: string };
  dueRows?: { label: string; value: string; color?: string }[];
  footBox?: { title: string; rows: PdfFootRow[] } | null;
  notes?: PdfNote[];
  thanks?: { title: string; subtitle?: string } | null;
  stamp?: string | null;
  runningFooter: { left: string; right: string };
  /** Very-small-print legal line under the footer (e.g. "X trading as Wielo"). */
  legalLine?: string | null;
};

const POS = "#047857";

export function PdfPaper(p: PdfPaperProps) {
  const positive = !!p.balance.positive;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* running footer — repeats on every page, bottom corners */}
        <View fixed style={s.pageFooter}>
          <View style={s.pageFooterRow}>
            <Text style={s.pfLeft}>{p.runningFooter.left}</Text>
            <View style={s.pfRight}>
              <View style={s.pwmark} />
              <Text style={s.pfRightText}>{p.runningFooter.right}</Text>
            </View>
          </View>
          {p.legalLine ? <Text style={s.pfLegal}>{p.legalLine}</Text> : null}
        </View>

        {/* header */}
        <View style={s.headerRow}>
          <View style={s.brandBlock}>
            {p.issuer.mark.kind === "logo" ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={p.issuer.mark.url} style={s.logo} />
            ) : (
              <Text style={s.markSquare}>{p.issuer.mark.text}</Text>
            )}
            <View style={s.issuerText}>
              <Text style={s.bizName}>{p.issuer.name}</Text>
              {p.issuer.metaLines.map((l, i) => (
                <Text key={i} style={s.bizMeta}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docTitle}>{p.kind}</Text>
            <Text style={s.docSub}># {p.number}</Text>
            <View style={[s.balanceBox, positive ? s.balanceBoxPos : {}]}>
              <Text style={s.balLabel}>{p.balance.label}</Text>
              <Text style={[s.balValue, positive ? { color: POS } : {}]}>
                {p.balance.value}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.rule} />

        {/* bill-to + facts */}
        <View style={s.band}>
          <View style={s.billTo}>
            <Text style={s.eyebrow}>{p.billTo.label}</Text>
            <Text style={s.partyName}>{p.billTo.name}</Text>
            {p.billTo.lines.map((l, i) => (
              <Text key={i} style={s.partyLine}>
                {l}
              </Text>
            ))}
          </View>
          <View style={s.facts}>
            {p.facts.map((f, i) => (
              <View key={i} style={[s.factRow, i > 0 ? s.factRowBorder : {}]}>
                <Text style={s.factK}>{f.label}</Text>
                <Text style={s.factV}>{f.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* summary strip */}
        {p.summary && p.summary.length > 0 ? (
          <View style={s.strip}>
            {p.summary.map((c, i) => (
              <View key={i} style={[s.stripCell, i > 0 ? s.stripDivider : {}]}>
                <Text style={s.stripLabel}>{c.label}</Text>
                <Text style={s.stripValue}>{c.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* line table */}
        <View style={s.thead}>
          {p.columns.map((c, i) => (
            <Text
              key={i}
              style={[s.th, { flex: c.flex, textAlign: c.align ?? "right" }]}
            >
              {c.label}
            </Text>
          ))}
        </View>
        {p.rows.map((row, ri) => (
          <View key={ri} style={s.trow} wrap={false}>
            {row.map((cell, ci) => {
              const col = p.columns[ci];
              const align = cell.align ?? col?.align ?? "right";
              const flex = col?.flex ?? 1;
              if (cell.sub) {
                return (
                  <View key={ci} style={{ flex }}>
                    <Text style={[s.cellMain, { textAlign: align }]}>
                      {cell.text}
                    </Text>
                    <Text style={[s.cellSub, { textAlign: align }]}>
                      {cell.sub}
                    </Text>
                  </View>
                );
              }
              return (
                <Text
                  key={ci}
                  style={[
                    s.cell,
                    {
                      flex,
                      textAlign: align,
                      fontFamily: cell.bold ? "Helvetica-Bold" : "Helvetica",
                      color: cell.color ?? BRAND.ink,
                    },
                  ]}
                >
                  {cell.text}
                </Text>
              );
            })}
          </View>
        ))}

        {/* totals */}
        <View style={s.totalsBlock}>
          {p.totals.map((t, i) => (
            <View key={i} style={s.totalRow}>
              <Text style={s.totalLabel}>{t.label}</Text>
              <Text style={t.mute ? s.totalValMute : s.totalVal}>
                {t.value}
              </Text>
            </View>
          ))}
          <View style={s.sep} />
          <View style={s.grand}>
            <Text style={s.grandLabel}>{p.grand.label}</Text>
            <Text style={s.grandValue}>{p.grand.value}</Text>
          </View>
          {p.dueRows?.map((d, i) => (
            <View key={i} style={s.dueRow}>
              <Text style={s.dueLabel}>{d.label}</Text>
              <Text style={[s.dueValue, d.color ? { color: d.color } : {}]}>
                {d.value}
              </Text>
            </View>
          ))}
        </View>

        {/* payment box (left) + notes/terms (right, or left when no box) */}
        {p.footBox || (p.notes && p.notes.length > 0) ? (
          <View style={s.foot}>
            <View style={s.footCol}>
              {p.footBox ? (
                <>
                  <Text style={s.h4}>{p.footBox.title}</Text>
                  <View style={s.payBox}>
                    {p.footBox.rows.map((r, i) => (
                      <View key={i} style={s.payRow}>
                        <Text style={s.payK}>{r.k}</Text>
                        <Text style={s.payV}>{r.v}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Notes notes={p.notes ?? []} />
              )}
            </View>
            <View style={s.footCol}>
              {p.footBox ? <Notes notes={p.notes ?? []} /> : null}
            </View>
          </View>
        ) : null}

        {/* stamp */}
        {p.stamp ? (
          <View style={s.stampWrap}>
            <View style={s.stampLine} />
            <Text style={s.stamp}>{p.stamp}</Text>
            <View style={s.stampLine} />
          </View>
        ) : null}

        {/* thanks */}
        {p.thanks ? (
          <View style={s.thanks}>
            <View style={s.thanksCol}>
              <Text style={s.thanksT}>{p.thanks.title}</Text>
              {p.thanks.subtitle ? (
                <Text style={s.thanksS}>{p.thanks.subtitle}</Text>
              ) : null}
            </View>
            <Text style={s.thanksR}>Issued via {p.brandName}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

function Notes({ notes }: { notes: PdfNote[] }) {
  return (
    <>
      {notes.map((n, i) => (
        <View key={i} style={i > 0 ? { marginTop: 12 } : {}}>
          <Text style={s.h4}>{n.title}</Text>
          <Text style={s.note}>{n.body}</Text>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 54,
    fontSize: 10,
    color: BRAND.ink,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },

  // header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
  },
  brandBlock: { flexDirection: "row", alignItems: "flex-start", flex: 1 },
  markSquare: {
    width: 44,
    height: 44,
    backgroundColor: BRAND.deep,
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 11,
    borderRadius: 11,
    marginRight: 12,
  },
  logo: {
    width: 44,
    height: 44,
    objectFit: "contain",
    borderRadius: 8,
    marginRight: 12,
  },
  issuerText: { flex: 1 },
  bizName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    letterSpacing: -0.2,
  },
  bizMeta: { fontSize: 8, color: BRAND.mute, lineHeight: 1.5, marginTop: 1 },
  docMeta: { alignItems: "flex-end", width: 250 },
  docTitle: {
    fontSize: 21,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "right",
  },
  docSub: { fontSize: 9, color: BRAND.mute, marginTop: 4, textAlign: "right" },
  balanceBox: {
    marginTop: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minWidth: 200,
    backgroundColor: BRAND.light,
    borderWidth: 1,
    borderColor: BRAND.accent,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  balanceBoxPos: { borderColor: "#A7F3D0" },
  balLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND.deep },
  balValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: BRAND.deep,
    marginLeft: 16,
  },

  rule: {
    height: 1.5,
    backgroundColor: BRAND.deep,
    opacity: 0.14,
    marginTop: 18,
    marginBottom: 18,
  },

  // band
  band: { flexDirection: "row", gap: 26, marginBottom: 18 },
  billTo: { flex: 1.15 },
  eyebrow: {
    fontSize: 7.5,
    color: BRAND.eyebrow,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    marginBottom: 3,
  },
  partyLine: { fontSize: 8.5, color: BRAND.mute, lineHeight: 1.5 },
  facts: {
    flex: 0.85,
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 9,
    alignSelf: "flex-start",
    width: "100%",
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  factRowBorder: { borderTopWidth: 1, borderTopColor: BRAND.line },
  factK: { fontSize: 9, color: BRAND.mute },
  factV: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND.ink },

  // summary strip
  strip: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 9,
    marginBottom: 4,
  },
  stripCell: { flex: 1, paddingVertical: 9, paddingHorizontal: 11 },
  stripDivider: { borderLeftWidth: 1, borderLeftColor: BRAND.line },
  stripLabel: {
    fontSize: 7.5,
    color: BRAND.mute,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  stripValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND.ink },

  // table
  thead: {
    flexDirection: "row",
    backgroundColor: BRAND.deep,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 9,
    marginTop: 18,
  },
  th: {
    fontSize: 7.5,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  trow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
  },
  cell: { fontSize: 9.5 },
  cellMain: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND.ink },
  cellSub: { fontSize: 8.5, color: BRAND.mute, marginTop: 1.5 },

  // totals
  totalsBlock: { marginTop: 12, alignSelf: "flex-end", width: 250 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  totalLabel: { color: BRAND.mute, fontSize: 9.5 },
  totalVal: { color: BRAND.ink, fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  totalValMute: { color: BRAND.mute, fontSize: 9.5 },
  sep: { height: 1, backgroundColor: BRAND.line, marginVertical: 4 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: BRAND.deep,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  grandValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginTop: 3,
  },
  dueLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND.ink },
  dueValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND.deep },

  // foot
  foot: { flexDirection: "row", gap: 26, marginTop: 22 },
  footCol: { flex: 1 },
  h4: {
    fontSize: 7.5,
    color: BRAND.eyebrow,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  payBox: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 9,
    backgroundColor: BRAND.soft,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.5,
  },
  payK: { fontSize: 9, color: BRAND.mute },
  payV: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND.ink },
  note: { fontSize: 9, color: BRAND.mute, lineHeight: 1.55 },

  // stamp
  stampWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
  stampLine: { flex: 1, height: 1, backgroundColor: BRAND.line },
  stamp: {
    borderWidth: 2,
    borderColor: "#6EE7B7",
    color: "#0F766E",
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    textTransform: "uppercase",
    letterSpacing: 2,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 8,
  },

  // thanks
  thanks: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
  },
  thanksCol: { flex: 1, maxWidth: 340 },
  thanksT: { fontSize: 11, fontFamily: "Helvetica-Bold", color: BRAND.ink },
  thanksS: { fontSize: 8.5, color: BRAND.mute, marginTop: 3, lineHeight: 1.5 },
  thanksR: { fontSize: 8.5, color: BRAND.mute },

  // running footer (fixed)
  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
  },
  pageFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pfLegal: {
    fontSize: 6.5,
    color: BRAND.mute,
    textAlign: "center",
    marginTop: 3,
  },
  pfLeft: { fontSize: 8, color: BRAND.mute },
  pfRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  pwmark: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: BRAND.deep,
  },
  pfRightText: { fontSize: 8, color: BRAND.mute },
});
