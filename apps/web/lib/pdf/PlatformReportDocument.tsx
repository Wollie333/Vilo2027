import { Document, Page, Text, View } from "@react-pdf/renderer";

import type { PlatformReport } from "@/lib/billing/platform-report";

import { DocHeader } from "./DocHeader";
import { BRAND, styles as base } from "./styles";

// Investor-grade one-page business report. Text + tables only (charts are shown
// in the app); this is the downloadable summary the admin shares.

function zar(n: number): string {
  return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export type PlatformReportProps = {
  report: PlatformReport;
  brandName: string;
};

export function PlatformReportDocument({
  report,
  brandName,
}: PlatformReportProps) {
  const k = report.kpis;

  const headline: [string, string][] = [
    ["MRR", zar(k.mrr)],
    ["ARR", zar(k.arr)],
    ["ARPU", zar(k.arpu)],
    ["Paying hosts", String(k.payingHosts)],
    ["Collected (all-time)", zar(k.collectedAllTime)],
    [`Collected (${report.rangeLabel.toLowerCase()})`, zar(k.collectedPeriod)],
    ["Outstanding", zar(k.outstanding)],
    ["Refunded", zar(k.refunded)],
  ];

  const growth: [string, string][] = [
    ["Total users", k.totalUsers.toLocaleString("en-ZA")],
    ["Hosts", k.hosts.toLocaleString("en-ZA")],
    ["Guests", k.guests.toLocaleString("en-ZA")],
    [
      `New users (${report.rangeLabel.toLowerCase()})`,
      String(k.newUsersPeriod),
    ],
    ["On trial", String(k.trials)],
    ["Trial → paid", `${k.trialConversion}%`],
    ["Churned", String(k.churned)],
    ["Churn rate", `${k.churnRate}%`],
  ];

  const ops: [string, string][] = [
    ["GMV processed", zar(k.gmv)],
    ["Revenue bookings", k.bookingCount.toLocaleString("en-ZA")],
    ["Active listings", k.activeListings.toLocaleString("en-ZA")],
  ];

  return (
    <Document>
      <Page size="A4" style={base.page}>
        <View style={base.headerRow}>
          <DocHeader
            businessName={brandName}
            brandName={brandName}
            tagline="Business performance report"
          />
          <View style={base.docMeta}>
            <Text style={base.docKind}>Report</Text>
            <Text style={base.docNumber}>{report.rangeLabel}</Text>
            <Text style={base.docDate}>
              Generated {fmtDate(report.generatedAt)}
            </Text>
          </View>
        </View>

        <Section title="Revenue & subscriptions" rows={headline} />
        <Section title="Growth & retention" rows={growth} />
        <Section title="Platform volume" rows={ops} />

        {report.plans.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={sectionTitle}>Plan distribution</Text>
            <View style={tableHeader}>
              <Text style={{ flex: 2 }}>Plan</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>Subs</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>MRR</Text>
            </View>
            {report.plans.map((p) => (
              <View key={p.key} style={tableRow}>
                <Text style={{ flex: 2 }}>{p.name}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>{p.count}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>
                  {zar(p.mrr)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={footer}>
          {brandName} · Vilo records only money paid to {brandName}{" "}
          (subscriptions + products). GMV is host↔guest booking value flowing
          directly between parties — {brandName} never holds it.
        </Text>
      </Page>
    </Document>
  );
}

const sectionTitle = {
  fontSize: 11,
  fontFamily: "Helvetica-Bold",
  color: BRAND.deep,
  marginBottom: 8,
} as const;

const tableHeader = {
  flexDirection: "row" as const,
  borderBottomWidth: 1,
  borderBottomColor: BRAND.line,
  paddingBottom: 4,
  fontSize: 8,
  color: BRAND.mute,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const tableRow = {
  flexDirection: "row" as const,
  paddingVertical: 4,
  borderBottomWidth: 0.5,
  borderBottomColor: BRAND.line,
  fontSize: 10,
};

const footer = {
  marginTop: 24,
  fontSize: 8,
  color: BRAND.mute,
  lineHeight: 1.5,
};

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={sectionTitle}>{title}</Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
        }}
      >
        {rows.map(([label, value]) => (
          <View
            key={label}
            style={{
              width: "25%",
              paddingVertical: 6,
              paddingRight: 8,
            }}
          >
            <Text style={{ fontSize: 8, color: BRAND.mute }}>{label}</Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Helvetica-Bold",
                color: BRAND.ink,
                marginTop: 2,
              }}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
