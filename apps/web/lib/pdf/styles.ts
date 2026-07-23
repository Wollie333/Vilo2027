import { StyleSheet } from "@react-pdf/renderer";

export const BRAND = {
  primary: "#10B981",
  deep: "#064E3B",
  ink: "#052E1F",
  mute: "#4A7C6A",
  line: "#E4EFE8",
  light: "#F0FDF4",
  soft: "#F6FAF7",
  accent: "#D1FAE5",
  eyebrow: "#8AA89B",
  paid: "#10B981",
  unpaid: "#F59E0B",
};

// PDF paper styled to match the on-screen FinancialDocument / the founder's
// billing-template pack: gradient-ish brand mark, large document title, a
// dark-header line table, a filled grand-total bar, bordered summary strip and
// soft-bordered notes box. @react-pdf uses the built-in Helvetica (registering
// the web fonts risks production render failures — the exact typeface is the
// only intentional divergence from the on-screen render).
export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: BRAND.ink,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },

  // ── header ──
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  brandSquare: {
    width: 42,
    height: 42,
    backgroundColor: BRAND.deep,
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 10,
    borderRadius: 10,
    marginRight: 11,
  },
  brandLogo: {
    width: 44,
    height: 44,
    objectFit: "contain",
    borderRadius: 8,
    marginRight: 11,
  },
  brandWordmark: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    letterSpacing: -0.2,
  },
  brandTag: {
    fontSize: 8,
    color: BRAND.mute,
    marginTop: 3,
  },
  brandMetaLine: {
    fontSize: 8,
    color: BRAND.mute,
    lineHeight: 1.45,
  },
  docMeta: {
    alignItems: "flex-end",
    maxWidth: 240,
  },
  docKind: {
    fontSize: 19,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "right",
  },
  docNumber: {
    fontSize: 9,
    marginTop: 4,
    color: BRAND.mute,
    textAlign: "right",
  },
  docDate: {
    fontSize: 8.5,
    marginTop: 3,
    color: BRAND.mute,
    textAlign: "right",
  },
  statusPill: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 9,
    backgroundColor: BRAND.accent,
    color: BRAND.deep,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    borderRadius: 4,
  },
  // Prominent amount box under the document title.
  balanceBox: {
    marginTop: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minWidth: 190,
    backgroundColor: BRAND.light,
    borderWidth: 1,
    borderColor: BRAND.accent,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  balanceBoxLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND.deep,
  },
  balanceBoxValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BRAND.deep,
    marginLeft: 18,
  },

  rule: {
    height: 1.5,
    backgroundColor: BRAND.deep,
    opacity: 0.14,
    marginTop: 16,
    marginBottom: 18,
  },

  // ── parties + meta ──
  twoCols: {
    flexDirection: "row",
    gap: 26,
    marginBottom: 18,
  },
  col: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 7.5,
    color: BRAND.eyebrow,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 8.5,
    color: BRAND.mute,
    marginBottom: 1.5,
    lineHeight: 1.4,
  },
  // Bordered key/value facts card (invoice dates, terms…).
  factsCard: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 9,
    overflow: "hidden",
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  factRowBorder: {
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
  },
  factKey: { fontSize: 9, color: BRAND.mute },
  factVal: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND.ink },

  // ── summary strip ──
  staySummaryBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 9,
    marginBottom: 16,
    overflow: "hidden",
  },
  staySummaryItem: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderLeftWidth: 1,
    borderLeftColor: BRAND.line,
  },
  staySummaryLabel: {
    fontSize: 7.5,
    color: BRAND.mute,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  staySummaryValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
  },

  // ── line table (dark header) ──
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND.deep,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
  },
  th: {
    fontSize: 7.5,
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  td: {
    fontSize: 9.5,
    color: BRAND.ink,
  },
  tdMute: {
    fontSize: 8.5,
    color: BRAND.mute,
    marginTop: 1.5,
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1.4, textAlign: "right" },
  colTotal: { flex: 1.4, textAlign: "right" },

  // ── totals ──
  totalsBlock: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: 240,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  totalsLabel: {
    color: BRAND.mute,
    fontSize: 9.5,
  },
  totalsValue: {
    color: BRAND.ink,
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
  },
  sepLine: {
    height: 1,
    backgroundColor: BRAND.line,
    marginVertical: 3,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: BRAND.deep,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  grandTotalValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  dueLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND.ink },
  dueValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND.deep },

  // ── notes / payment box ──
  notesBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: BRAND.soft,
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 9,
  },
  notesLabel: {
    fontSize: 7.5,
    color: BRAND.eyebrow,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  notesBody: {
    fontSize: 9,
    color: BRAND.ink,
    lineHeight: 1.5,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
    fontSize: 8,
    color: BRAND.mute,
    textAlign: "center",
  },
});

export function formatMoney(
  amount: number | null | undefined,
  currency = "ZAR",
): string {
  const symbol = currency === "ZAR" ? "R" : currency + " ";
  // Guard: a missing/non-finite amount must never render as "R NaN".
  if (amount == null || !Number.isFinite(amount)) return `${symbol} —`;
  const formatted = Math.round(amount)
    .toLocaleString("en-ZA")
    .replace(/,/g, " ");
  return `${symbol} ${formatted}`;
}

/**
 * Money to the cent, for INVOICE / CREDIT-NOTE documents where the exact amount
 * and its VAT split must appear (a tax invoice rounding R 113,85 to "R 114" —
 * where 99 + 15 ≠ 113,85 — is wrong). `formatMoney` (whole rand) stays for the
 * PDF's summary chrome. en-ZA gives "R 1 234,56": space thousands, comma decimal.
 */
export function formatMoneyExact(
  amount: number | null | undefined,
  currency = "ZAR",
): string {
  const symbol = currency === "ZAR" ? "R" : currency + " ";
  if (amount == null || !Number.isFinite(amount)) return `${symbol} —`;
  // Manual build (not Intl currency) so Node and the browser agree. SA
  // convention: space thousands, comma decimal -> "R 1 234,56".
  const neg = amount < 0;
  const cents = Math.round(Math.abs(amount) * 100);
  const rand = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  const grouped = rand.toLocaleString("en-ZA").replace(/,/g, " ");
  return `${neg ? "-" : ""}${symbol} ${grouped},${frac}`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
