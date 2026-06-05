import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { ReportsFilters } from "./_components/ReportsFilters";
import { PrimaryKPIs } from "./_components/PrimaryKPIs";
import { SecondaryMetrics } from "./_components/SecondaryMetrics";
import { RevenueTrendChart } from "./_components/RevenueTrendChart";
import { ChannelMixPieChart } from "./_components/ChannelMixPieChart";
import { FunnelChart } from "./_components/FunnelChart";
import { CustomerJourney } from "./_components/CustomerJourney";
import { PropertyPerformanceTable } from "./_components/PropertyPerformanceTable";
import { RegionalBars } from "./_components/RegionalBars";
import { SeasonalityHeatmap } from "./_components/SeasonalityHeatmap";
import { GuestDemographics } from "./_components/GuestDemographics";
import { PopularRooms } from "./_components/PopularRooms";
import { RefundsCancellations } from "./_components/RefundsCancellations";
import { ScheduledReportsSection } from "./_components/ScheduledReportsSection";

export const metadata: Metadata = {
  title: "Analytics & Reports",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: {
    start?: string;
    end?: string;
    compare?: string;
    listing?: string;
    region?: string;
    channel?: string;
  };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/reports");
  }

  // Get host
  const { data: host } = await supabase
    .from("hosts")
    .select("id, display_name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    redirect("/dashboard");
  }

  // Check feature permission: analytics_basic (Basic+)
  const { data: featureRaw } = await supabase.rpc("check_feature_permission", {
    p_host_id: host.id,
    p_feature_key: "analytics_basic",
  });
  const feature = featureRaw as { is_enabled: boolean } | null;
  const hasBasic = feature?.is_enabled ?? false;

  if (!hasBasic) {
    // User doesn't have analytics access - show upgrade card
    return (
      <div className="space-y-6 px-5 py-6 lg:px-8 lg:py-7">
        <div className="rounded-card border border-brand-line bg-white p-8 shadow-card">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-secondary">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <div className="font-display text-lg font-bold text-brand-ink">
                Analytics isn&apos;t available on your plan
              </div>
              <p className="mt-1 text-sm text-brand-mute">
                Get insights into revenue, occupancy, guest demographics, and
                more. Available on Basic, Pro, and Business plans.
              </p>
              <a
                href="/dashboard/settings/subscription"
                className="mt-4 inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-secondary"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                See plans
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check for advanced features (Pro+)
  // TODO: Phase 2+ - use hasAdvanced to gate Pro+ sections (scheduled reports, advanced exports)
  const { data: advancedRaw } = await supabase.rpc("check_feature_permission", {
    p_host_id: host.id,
    p_feature_key: "analytics_advanced",
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hasAdvanced =
    (advancedRaw as { is_enabled: boolean } | null)?.is_enabled ?? false;

  // Parse filter params with defaults (YTD: Jan 1 to today)
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const startDate = searchParams?.start || startOfYear.toISOString().split("T")[0];
  const endDate = searchParams?.end || today.toISOString().split("T")[0];

  const filters = {
    startDate,
    endDate,
    compare: searchParams?.compare === "true",
    listingId: searchParams?.listing,
    region: searchParams?.region,
    channel: searchParams?.channel,
  };

  // Fetch analytics data in parallel
  const [
    primaryKpisRes,
    secondaryMetricsRes,
    revenueTrendRes,
    channelMixRes,
    conversionFunnelRes,
    timeToBookRes,
    regionalBreakdownRes,
    seasonalityHeatmapRes,
    guestDemographicsRes,
    popularRoomsRes,
    refundsCancellationsRes,
  ] = await Promise.all([
    supabase.rpc("fetch_primary_kpis", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: filters.listingId || null,
      p_channel: filters.channel || null,
    }),
    supabase.rpc("fetch_secondary_metrics", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: filters.listingId || null,
      p_channel: filters.channel || null,
    }),
    supabase.rpc("fetch_revenue_trend", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_grouping: "day",
      p_listing_id: filters.listingId || null,
      p_channel: filters.channel || null,
    }),
    supabase.rpc("fetch_channel_mix", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: filters.listingId || null,
    }),
    supabase.rpc("fetch_conversion_funnel", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: filters.listingId || null,
    }),
    supabase.rpc("fetch_time_to_book", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: filters.listingId || null,
    }),
    supabase.rpc("fetch_regional_breakdown", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: filters.listingId || null,
    }),
    supabase.rpc("fetch_seasonality_heatmap", {
      p_host_id: host.id,
      p_year: today.getFullYear(),
    }),
    supabase.rpc("fetch_guest_demographics", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: filters.listingId || null,
    }),
    supabase.rpc("fetch_popular_rooms", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_limit: 5,
    }),
    supabase.rpc("fetch_refunds_cancellations", {
      p_host_id: host.id,
      p_start_date: startDate,
      p_end_date: endDate,
      p_listing_id: filters.listingId || null,
    }),
  ]);

  // Log errors for debugging
  if (primaryKpisRes.error) console.error("fetch_primary_kpis error:", primaryKpisRes.error);
  if (secondaryMetricsRes.error) console.error("fetch_secondary_metrics error:", secondaryMetricsRes.error);
  if (revenueTrendRes.error) console.error("fetch_revenue_trend error:", revenueTrendRes.error);
  if (channelMixRes.error) console.error("fetch_channel_mix error:", channelMixRes.error);
  if (conversionFunnelRes.error) console.error("fetch_conversion_funnel error:", conversionFunnelRes.error);
  if (timeToBookRes.error) console.error("fetch_time_to_book error:", timeToBookRes.error);
  if (regionalBreakdownRes.error) console.error("fetch_regional_breakdown error:", regionalBreakdownRes.error);
  if (seasonalityHeatmapRes.error) console.error("fetch_seasonality_heatmap error:", seasonalityHeatmapRes.error);
  if (guestDemographicsRes.error) console.error("fetch_guest_demographics error:", guestDemographicsRes.error);
  if (popularRoomsRes.error) console.error("fetch_popular_rooms error:", popularRoomsRes.error);
  if (refundsCancellationsRes.error) console.error("fetch_refunds_cancellations error:", refundsCancellationsRes.error);

  const kpisError =
    primaryKpisRes.error ||
    secondaryMetricsRes.error ||
    revenueTrendRes.error ||
    channelMixRes.error ||
    conversionFunnelRes.error ||
    timeToBookRes.error ||
    regionalBreakdownRes.error ||
    seasonalityHeatmapRes.error ||
    guestDemographicsRes.error ||
    popularRoomsRes.error ||
    refundsCancellationsRes.error;

  // Type assertions for the RPC responses
  const primaryKpis = primaryKpisRes.data as {
    revenue: {
      current: number;
      prior: number;
      delta: number | null;
      sparkline: Array<{ date: string; value: number }>;
    };
    revpar: { current: number; prior: number; delta: number | null };
    adr: { current: number; prior: number; delta: number | null };
    occupancy: {
      current: number;
      prior: number;
      delta: number;
      occupied_nights: number;
      available_nights: number;
    };
  } | null;

  const secondaryMetrics = secondaryMetricsRes.data as {
    net_value: number;
    commission_saved: number;
    avg_rating: number;
    review_count: number;
    rating_delta: number | null;
    cancellation_rate: number;
    cancellation_count: number;
    total_bookings: number;
    refund_rate: number;
    refund_amount: number;
    refund_count: number;
    quotes_sent: number;
    quotes_accepted: number;
    acceptance_rate: number;
    listing_views: number;
    avg_session_seconds: number;
  } | null;

  const revenueTrend = revenueTrendRes.data as {
    current: Array<{ date: string; revenue: number }>;
    prior: Array<{ date: string; revenue: number }>;
    grouping: string;
  } | null;

  const channelMix = (channelMixRes.data || []) as Array<{
    channel: string;
    revenue: number;
    bookings: number;
    percentage: number;
  }>;

  const conversionFunnel = conversionFunnelRes.data as {
    views: number;
    inquiries: number;
    quotes: number;
    bookings: number;
    conversion_rates: {
      views_to_inquiries: number;
      inquiries_to_quotes: number;
      quotes_to_bookings: number;
      views_to_bookings: number;
    };
  } | null;

  const timeToBook = timeToBookRes.data as {
    median_days: number;
    breakdown: {
      same_day: number;
      one_to_three: number;
      three_to_seven: number;
      seven_to_fourteen: number;
      over_fourteen: number;
    };
    avg_touchpoints: number;
    avg_session_duration: number;
  } | null;

  const regionalBreakdown = (regionalBreakdownRes.data || []) as Array<{
    province: string;
    revenue: number;
    bookings: number;
    percentage: number;
  }>;

  const seasonalityHeatmap = seasonalityHeatmapRes.data as {
    months: string[];
    provinces: string[];
    data: Array<{
      month: string;
      month_num: number;
      [province: string]: string | number;
    }>;
  } | null;

  const guestDemographics = guestDemographicsRes.data as {
    returning_guests: number;
    new_guests: number;
    country_breakdown: Array<{
      country: string;
      bookings: number;
      percentage: number;
    }>;
  } | null;

  const popularRooms = (popularRoomsRes.data || []) as Array<{
    listing_id: string;
    listing_name: string;
    listing_slug: string;
    cover_image_url: string | null;
    occupancy_rate: number;
    nights_booked: number;
    revenue: number;
    bookings_count: number;
  }>;

  const refundsCancellations = refundsCancellationsRes.data as {
    refund_count: number;
    refund_amount: number;
    refund_rate: number;
    cancellation_count: number;
    cancellation_revenue_impact: number;
    cancellation_rate: number;
    cancellation_reasons: Array<{
      reason: string;
      count: number;
    }>;
    avg_refund_turnaround_days: number;
  } | null;

  // Fetch scheduled reports (separate from analytics data)
  const { data: scheduledReportsData } = await supabase
    .from("scheduled_reports")
    .select("*")
    .eq("host_id", host.id)
    .order("created_at", { ascending: false });

  const scheduledReports = (scheduledReportsData || []) as Array<{
    id: string;
    name: string;
    description: string | null;
    report_type: string;
    schedule_cron: string | null;
    schedule_label: string | null;
    format: string;
    is_active: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
    recipients: Array<{ email: string; name: string }>;
    scope_filter: Record<string, unknown>;
  }>;

  return (
    <>
      {/* Header */}
      <header className="border-b border-brand-line bg-white">
        <div className="px-5 py-6 lg:px-8 lg:py-7">
          <div className="text-[11px] font-medium text-brand-mute">
            Tools · Analytics
          </div>
          <h1 className="mt-0.5 font-display text-xl font-bold leading-none text-brand-ink lg:text-2xl">
            Analytics & Reports
          </h1>
        </div>

        {/* Filter Bar */}
        <ReportsFilters
          startDate={filters.startDate}
          endDate={filters.endDate}
          compare={filters.compare}
          listingId={filters.listingId}
          region={filters.region}
          channel={filters.channel}
          listingCount={24} // TODO: Phase 2 - fetch actual count
        />
      </header>

      {/* Page Body */}
      <div className="max-w-[1520px] space-y-6 px-5 py-6 lg:space-y-7 lg:px-8 lg:py-7">
        {/* Intro Section */}
        <section className="flex flex-col gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-brand-ink md:text-[28px]">
              Portfolio performance
            </h2>
            <p className="mt-1 text-sm text-brand-mute">
              {/* TODO: Fetch actual listing count */}
              24 active listings · last refreshed{" "}
              <span className="font-medium text-brand-ink">today</span> · data
              through {new Date(endDate).toLocaleDateString("en-ZA")}
            </p>
          </div>
          {filters.compare && (
            <div className="flex items-center gap-2 text-xs text-brand-mute md:ml-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-primary"></span>{" "}
                Current period
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-mute/50"></span>{" "}
                Prior period
              </span>
            </div>
          )}
        </section>

        {/* Primary KPIs */}
        {primaryKpis && secondaryMetrics ? (
          <>
            <PrimaryKPIs data={primaryKpis} />

            {/* Secondary Metrics */}
            <SecondaryMetrics data={secondaryMetrics} />

            {/* Revenue Trend + Channel Mix */}
            <section className="grid gap-3 lg:grid-cols-3 lg:gap-4">
              {revenueTrend && (
                <RevenueTrendChart
                  data={revenueTrend}
                  totalRevenue={primaryKpis.revenue.current}
                  revenueGrowth={primaryKpis.revenue.delta || 0}
                />
              )}

              {channelMix.length > 0 && <ChannelMixPieChart data={channelMix} />}
            </section>

            {/* Conversion Funnel + Customer Journey */}
            {(conversionFunnel || timeToBook) && (
              <section className="grid gap-3 lg:grid-cols-2 lg:gap-4">
                {conversionFunnel && <FunnelChart data={conversionFunnel} />}
                {timeToBook && <CustomerJourney data={timeToBook} />}
              </section>
            )}

            {/* Property Performance Table */}
            <section>
              <PropertyPerformanceTable
                hostId={host.id}
                startDate={startDate}
                endDate={endDate}
                listingId={filters.listingId}
              />
            </section>

            {/* Regional Breakdown + Seasonality Heatmap */}
            {(regionalBreakdown.length > 0 || seasonalityHeatmap) && (
              <section className="grid gap-3 lg:grid-cols-2 lg:gap-4">
                {regionalBreakdown.length > 0 && (
                  <RegionalBars data={regionalBreakdown} />
                )}
                {seasonalityHeatmap && (
                  <SeasonalityHeatmap
                    data={seasonalityHeatmap}
                    year={today.getFullYear()}
                  />
                )}
              </section>
            )}

            {/* Guest Demographics + Popular Rooms + Refunds */}
            {(guestDemographics || popularRooms.length > 0 || refundsCancellations) && (
              <section className="grid gap-3 lg:grid-cols-3 lg:gap-4">
                {guestDemographics && <GuestDemographics data={guestDemographics} />}
                {popularRooms.length > 0 && <PopularRooms data={popularRooms} />}
                {refundsCancellations && (
                  <RefundsCancellations data={refundsCancellations} />
                )}
              </section>
            )}

            {/* Scheduled Reports Section */}
            <section className="border-t border-brand-line pt-6 lg:pt-7">
              <ScheduledReportsSection initialReports={scheduledReports} />
            </section>
          </>
        ) : (
          <div className="rounded-card border border-brand-line bg-white p-8">
            {kpisError ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-brand-ink">
                  Failed to Load Analytics
                </h3>
                <p className="mb-4 text-sm text-brand-mute">
                  The analytics database functions are not available. This usually means
                  the analytics migrations haven&apos;t been applied yet.
                </p>
                <div className="rounded-lg bg-brand-light/50 p-4 text-left">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-mute">
                    To fix this issue:
                  </p>
                  <ol className="space-y-2 text-sm text-brand-ink">
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-brand-mute">1.</span>
                      <span>
                        Apply analytics migrations:{" "}
                        <code className="rounded bg-brand-light px-1.5 py-0.5 font-mono text-xs">
                          supabase db push --linked
                        </code>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-brand-mute">2.</span>
                      <span>Refresh this page</span>
                    </li>
                  </ol>
                </div>
                <p className="mt-4 text-xs text-brand-mute">
                  Check browser console (F12) for detailed error messages
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-brand-mute">
                  No data available for the selected period.
                </p>
                <p className="mt-2 text-xs text-brand-mute">
                  Try selecting a different date range or run{" "}
                  <code className="rounded bg-brand-light px-1.5 py-0.5 font-mono text-xs">
                    npm run seed:all
                  </code>{" "}
                  to generate demo data
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
