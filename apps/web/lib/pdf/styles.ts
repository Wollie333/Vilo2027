import { StyleSheet } from "@react-pdf/renderer";

export const BRAND = {
  primary: "#10B981",
  deep: "#064E3B",
  ink: "#052E1F",
  mute: "#4A7C6A",
  line: "#DCEAE0",
  light: "#F0FDF4",
  accent: "#D1FAE5",
  paid: "#10B981",
  unpaid: "#F59E0B",
};

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: BRAND.ink,
    fontFamily: "Helvetica",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandSquare: {
    width: 36,
    height: 36,
    backgroundColor: BRAND.primary,
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 6,
    marginRight: 10,
  },
  brandLogo: {
    width: 44,
    height: 44,
    objectFit: "contain",
    marginRight: 10,
  },
  brandWordmark: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: BRAND.deep,
    letterSpacing: 1,
  },
  brandTag: {
    fontSize: 8,
    color: BRAND.mute,
    marginTop: 2,
  },
  docMeta: {
    alignItems: "flex-end",
  },
  docKind: {
    fontSize: 10,
    color: BRAND.mute,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  docNumber: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    color: BRAND.ink,
  },
  docDate: {
    fontSize: 9,
    marginTop: 4,
    color: BRAND.mute,
  },
  statusPill: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: BRAND.accent,
    color: BRAND.deep,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    borderRadius: 2,
  },
  twoCols: {
    flexDirection: "row",
    gap: 30,
    marginBottom: 24,
  },
  col: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 8,
    color: BRAND.mute,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 9,
    color: BRAND.mute,
    marginBottom: 1,
  },
  staySummaryBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: BRAND.light,
    borderTopWidth: 2,
    borderTopColor: BRAND.primary,
    marginBottom: 18,
  },
  staySummaryItem: {
    alignItems: "flex-start",
  },
  staySummaryLabel: {
    fontSize: 8,
    color: BRAND.mute,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  staySummaryValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
    paddingBottom: 5,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
  },
  th: {
    fontSize: 8,
    color: BRAND.mute,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  td: {
    fontSize: 10,
    color: BRAND.ink,
  },
  tdMute: {
    fontSize: 9,
    color: BRAND.mute,
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1.4, textAlign: "right" },
  colTotal: { flex: 1.4, textAlign: "right" },
  totalsBlock: {
    marginTop: 14,
    alignSelf: "flex-end",
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: {
    color: BRAND.mute,
    fontSize: 10,
  },
  totalsValue: {
    color: BRAND.ink,
    fontSize: 10,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
    marginTop: 4,
    paddingTop: 8,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND.ink,
  },
  grandTotalValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: BRAND.primary,
  },
  notesBox: {
    marginTop: 24,
    padding: 12,
    backgroundColor: BRAND.light,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.primary,
  },
  notesLabel: {
    fontSize: 8,
    color: BRAND.mute,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  notesBody: {
    fontSize: 10,
    color: BRAND.ink,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
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

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
