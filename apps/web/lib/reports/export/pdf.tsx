import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

export interface PropertyPerformanceRow {
  listing_name: string;
  listing_status: string;
  revenue: number;
  revenue_prior: number;
  revenue_delta: number | null;
  nights_booked: number;
  occupancy: number;
  occupancy_prior: number;
  occupancy_delta: number | null;
  adr: number;
  bookings_count: number;
}

export interface ReportSummary {
  revenue: number;
  revenuePrior: number;
  revenueDelta: number | null;
  revpar: number;
  adr: number;
  occupancy: number;
  occupiedNights: number;
  availableNights: number;
  netValue: number;
  commissionSaved: number;
  avgRating: number;
  reviewCount: number;
  totalBookings: number;
  cancellationCount: number;
  cancellationRate: number;
  refundAmount: number;
  refundCount: number;
  quotesSent: number;
  quotesAccepted: number;
  acceptanceRate: number;
  listingViews: number;
}

export interface ReportData {
  properties: PropertyPerformanceRow[];
  startDate: string;
  endDate: string;
  hostName: string;
  summary?: ReportSummary;
  channels?: Array<{
    channel: string;
    revenue: number;
    bookings: number;
    percentage: number;
  }>;
  funnel?: {
    views: number;
    inquiries: number;
    quotes: number;
    bookings: number;
  } | null;
  lookingFor?: {
    quotesSent: number;
    quotesAccepted: number;
    acceptanceRate: number;
    revenue: number;
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#111827",
  },
  subtitle: {
    fontSize: 10,
    color: "#6B7280",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#064E3B",
    marginTop: 14,
    marginBottom: 8,
  },
  // KPI grid
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiCard: {
    width: "23%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 7,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#111827",
  },
  kpiSub: {
    fontSize: 7,
    color: "#9CA3AF",
    marginTop: 2,
  },
  table: {
    width: "100%",
    marginTop: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#10B981",
    padding: 6,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    padding: 6,
    fontSize: 8,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 6,
    fontSize: 8,
  },
  col1: { width: "18%", paddingRight: 4 },
  col2: { width: "8%", paddingRight: 4 },
  col3: { width: "11%", textAlign: "right", paddingRight: 4 },
  col4: { width: "10%", textAlign: "right", paddingRight: 4 },
  col5: { width: "9%", textAlign: "right", paddingRight: 4 },
  col6: { width: "8%", textAlign: "right", paddingRight: 4 },
  col7: { width: "10%", textAlign: "right", paddingRight: 4 },
  col8: { width: "10%", textAlign: "right", paddingRight: 4 },
  col9: { width: "8%", textAlign: "right", paddingRight: 4 },
  col10: { width: "8%", textAlign: "right", paddingRight: 4 },
  // simple two-column list rows (channels / funnel / LF)
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 3,
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    color: "#9CA3AF",
  },
});

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

function AnalyticsPDF({ data }: { data: ReportData }) {
  const s = data.summary;
  return (
    <Document>
      {/* Page 1 — headline summary */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Wielo Analytics Report</Text>
          <Text style={styles.subtitle}>
            {data.hostName} · {data.startDate} to {data.endDate}
          </Text>
        </View>

        {s ? (
          <>
            <Text style={styles.sectionTitle}>Headline performance</Text>
            <View style={styles.kpiRow}>
              <Kpi
                label="Total revenue"
                value={`R ${formatNumber(s.revenue)}`}
                sub={
                  s.revenueDelta !== null
                    ? `${s.revenueDelta >= 0 ? "+" : ""}${s.revenueDelta.toFixed(1)}% vs prior`
                    : `vs R ${formatNumber(s.revenuePrior)} prior`
                }
              />
              <Kpi
                label="RevPAR"
                value={`R ${formatNumber(s.revpar)}`}
                sub="per available night"
              />
              <Kpi
                label="ADR"
                value={`R ${formatNumber(s.adr)}`}
                sub="average daily rate"
              />
              <Kpi
                label="Occupancy"
                value={`${s.occupancy.toFixed(1)}%`}
                sub={`${formatNumber(s.occupiedNights)} / ${formatNumber(s.availableNights)} nights`}
              />
              <Kpi
                label="Net value"
                value={`R ${formatNumber(s.netValue)}`}
                sub="after refunds"
              />
              <Kpi
                label="Commission saved"
                value={`R ${formatNumber(s.commissionSaved)}`}
                sub="vs OTAs"
              />
              <Kpi
                label="Avg rating"
                value={s.reviewCount > 0 ? s.avgRating.toFixed(2) : "—"}
                sub={`${s.reviewCount} reviews`}
              />
              <Kpi label="Total bookings" value={String(s.totalBookings)} />
              <Kpi
                label="Cancellations"
                value={String(s.cancellationCount)}
                sub={`${s.cancellationRate.toFixed(1)}% rate`}
              />
              <Kpi
                label="Refunds"
                value={`R ${formatNumber(s.refundAmount)}`}
                sub={`${s.refundCount} refunds`}
              />
              <Kpi
                label="Quotes"
                value={`${s.quotesAccepted}/${s.quotesSent}`}
                sub={`${s.acceptanceRate.toFixed(0)}% accepted`}
              />
              <Kpi label="Listing views" value={formatNumber(s.listingViews)} />
            </View>
          </>
        ) : null}

        {data.channels && data.channels.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Channel mix</Text>
            {data.channels.map((c, i) => (
              <View key={i} style={styles.listRow}>
                <Text>{channelName(c.channel)}</Text>
                <Text>
                  R {formatNumber(c.revenue)} · {c.bookings} bookings ·{" "}
                  {c.percentage}%
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {data.funnel ? (
          <>
            <Text style={styles.sectionTitle}>Conversion funnel</Text>
            <View style={styles.listRow}>
              <Text>Views</Text>
              <Text>{formatNumber(data.funnel.views)}</Text>
            </View>
            <View style={styles.listRow}>
              <Text>Inquiries</Text>
              <Text>{formatNumber(data.funnel.inquiries)}</Text>
            </View>
            <View style={styles.listRow}>
              <Text>Quotes</Text>
              <Text>{formatNumber(data.funnel.quotes)}</Text>
            </View>
            <View style={styles.listRow}>
              <Text>Bookings</Text>
              <Text>{formatNumber(data.funnel.bookings)}</Text>
            </View>
          </>
        ) : null}

        {data.lookingFor && data.lookingFor.quotesSent > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Looking For</Text>
            <View style={styles.listRow}>
              <Text>Quotes sent</Text>
              <Text>{data.lookingFor.quotesSent}</Text>
            </View>
            <View style={styles.listRow}>
              <Text>Accepted</Text>
              <Text>
                {data.lookingFor.quotesAccepted} (
                {data.lookingFor.acceptanceRate.toFixed(0)}%)
              </Text>
            </View>
            <View style={styles.listRow}>
              <Text>Revenue</Text>
              <Text>R {formatNumber(data.lookingFor.revenue)}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.footer} fixed>
          Generated by Wielo Analytics on{" "}
          {new Date().toLocaleDateString("en-ZA")}
        </Text>
      </Page>

      {/* Page 2+ — property performance table */}
      {data.properties.length > 0 ? (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Property Performance</Text>
            <Text style={styles.subtitle}>
              {data.hostName} · {data.startDate} to {data.endDate}
            </Text>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Property</Text>
              <Text style={styles.col2}>Status</Text>
              <Text style={styles.col3}>Revenue</Text>
              <Text style={styles.col4}>Rev Prior</Text>
              <Text style={styles.col5}>Rev Δ %</Text>
              <Text style={styles.col6}>Nights</Text>
              <Text style={styles.col7}>Occ %</Text>
              <Text style={styles.col8}>Occ Prior</Text>
              <Text style={styles.col9}>Occ Δ</Text>
              <Text style={styles.col10}>ADR</Text>
            </View>

            {data.properties.map((property, index) => {
              const rowStyle =
                index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
              return (
                <View key={index} style={rowStyle}>
                  <Text style={styles.col1}>{property.listing_name}</Text>
                  <Text style={styles.col2}>{property.listing_status}</Text>
                  <Text style={styles.col3}>
                    R {formatNumber(property.revenue)}
                  </Text>
                  <Text style={styles.col4}>
                    R {formatNumber(property.revenue_prior)}
                  </Text>
                  <Text style={styles.col5}>
                    {property.revenue_delta !== null
                      ? `${property.revenue_delta.toFixed(1)}%`
                      : "N/A"}
                  </Text>
                  <Text style={styles.col6}>{property.nights_booked}</Text>
                  <Text style={styles.col7}>
                    {property.occupancy.toFixed(1)}%
                  </Text>
                  <Text style={styles.col8}>
                    {property.occupancy_prior.toFixed(1)}%
                  </Text>
                  <Text style={styles.col9}>
                    {property.occupancy_delta !== null
                      ? `${property.occupancy_delta.toFixed(1)}pp`
                      : "N/A"}
                  </Text>
                  <Text style={styles.col10}>
                    R {formatNumber(property.adr)}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.footer} fixed>
            Generated by Wielo Analytics on{" "}
            {new Date().toLocaleDateString("en-ZA")} · {data.properties.length}{" "}
            properties
          </Text>
        </Page>
      ) : null}
    </Document>
  );
}

export async function generatePDF(data: ReportData): Promise<Buffer> {
  const doc = <AnalyticsPDF data={data} />;
  const buffer = await renderToBuffer(doc);
  return buffer;
}

// Helper: Format number with spaces for thousands
function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function channelName(channel: string): string {
  const map: Record<string, string> = {
    direct: "Wielo",
    wielo: "Wielo",
    vilo: "Wielo",
    website: "Website",
    "web-referred": "Web referral",
    airbnb: "Airbnb",
    booking: "Booking.com",
    "booking.com": "Booking.com",
    expedia: "Expedia",
    lekkerslaap: "LekkerSlaap",
    other: "Other",
  };
  const k = channel.toLowerCase();
  return map[k] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}
