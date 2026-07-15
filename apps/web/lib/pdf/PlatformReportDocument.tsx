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
    ["VAT collected", zar(k.vatCollected)],
    ["Take-rate", `${k.takeRate}%`],
    ["MoM revenue", k.momRevenue !== null ? `${k.momRevenue}%` : "—"],
    ["MoM signups", k.momSignups !== null ? `${k.momSignups}%` : "—"],
  ];

  const engagement: [string, string][] = [
    ["Credits bought", String(k.creditsPurchased)],
    ["Credits granted", String(k.creditsGranted)],
    ["Credits spent", String(k.creditsSpent)],
    ["Quotes created", String(k.quotesCreated)],
    ["Looking-For posts", String(k.lookingForPosts)],
    ["Looking-For quotes", String(k.lookingForResponses)],
    ["Affiliate commissions", zar(k.affiliateCommissions)],
    ["Affiliate payouts", zar(k.affiliatePayouts)],
  ];

  const retention: [string, string][] = [
    ["Lifetime rev / host", zar(k.lifetimeRevenuePerHost)],
    ["ARR / account", zar(k.arrPerAccount)],
    ["Est. LTV", k.estimatedLtv !== null ? zar(k.estimatedLtv) : "—"],
    [
      "Avg lifespan",
      k.avgLifespanMonths !== null ? `${k.avgLifespanMonths} mo` : "—",
    ],
    ["Monthly churn", `${k.monthlyChurnRate}%`],
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
        <Section title="Engagement, credits & affiliate" rows={engagement} />
        <Section title="Retention & lifetime value" rows={retention} />

        {report.plans.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={sectionTitle}>Plan distribution</Text>
            <View style={tableHeader}>
              <Text style={{ flex: 2 }}>Plan</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>Count</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>MRR / total</Text>
            </View>
            {report.plans.map((p) => (
              <View key={p.key} style={tableRow}>
                <Text style={{ flex: 2 }}>
                  {p.name}
                  {p.type === "one_off" ? " (one-off)" : ""}
                  {p.testOnly ? " (test)" : ""}
                </Text>
                <Text style={{ flex: 1, textAlign: "right" }}>
                  {p.count} {p.type === "one_off" ? "sold" : "subs"}
                </Text>
                <Text style={{ flex: 1, textAlign: "right" }}>
                  {zar(p.mrr)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {report.paymentMethods.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={sectionTitle}>
              Payment methods ({report.rangeLabel.toLowerCase()})
            </Text>
            <View style={tableHeader}>
              <Text style={{ flex: 2 }}>Provider</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>Charges</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>Collected</Text>
            </View>
            {report.paymentMethods.map((p) => (
              <View key={p.provider} style={tableRow}>
                <Text style={{ flex: 2 }}>{p.provider}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>{p.count}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>
                  {zar(p.amount)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {report.geography.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={sectionTitle}>Listings by province</Text>
            <View style={tableHeader}>
              <Text style={{ flex: 2 }}>Province</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>Listings</Text>
            </View>
            {report.geography.map((g) => (
              <View key={g.province} style={tableRow}>
                <Text style={{ flex: 2 }}>{g.province}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>
                  {g.listings}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {report.bookingStatus.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={sectionTitle}>Bookings by status</Text>
            <View style={tableHeader}>
              <Text style={{ flex: 2 }}>Status</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>Count</Text>
            </View>
            {report.bookingStatus.map((b) => (
              <View key={b.status} style={tableRow}>
                <Text style={{ flex: 2 }}>{b.status.replace(/_/g, " ")}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>{b.count}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={footer}>
          {brandName} · Wielo records only money paid to {brandName}{" "}
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
