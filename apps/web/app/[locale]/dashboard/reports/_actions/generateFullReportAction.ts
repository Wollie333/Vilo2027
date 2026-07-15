"use server";

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  generatePDF,
  type ReportData,
  type PropertyPerformanceRow,
} from "@/lib/reports/export/pdf";
import { generateXLSX } from "@/lib/reports/export/xlsx";

interface ExportFilters {
  startDate: string;
  endDate: string;
  listingId?: string;
}

export async function generateFullReportAction(
  format: "pdf" | "xlsx",
  filters: ExportFilters,
) {
  const supabase = createServerClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get host
  const { data: host } = await supabase
    .from("hosts")
    .select("id, display_name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    return { success: false, error: "Host not found" };
  }

  const listingId = filters.listingId || null;

  // Fetch the property table AND every headline analytics block in parallel so
  // the "full report" export actually contains the full report — not just the
  // property table it used to ship.
  const [
    performanceRes,
    kpisRes,
    secondaryRes,
    channelRes,
    funnelRes,
    lookingForRes,
  ] = await Promise.all([
    supabase.rpc("fetch_property_performance", {
      p_host_id: host.id,
      p_start_date: filters.startDate,
      p_end_date: filters.endDate,
      p_sort_by: "revenue",
      p_sort_direction: "desc",
      p_limit: 1000,
      p_offset: 0,
    }),
    supabase.rpc("fetch_primary_kpis", {
      p_host_id: host.id,
      p_start_date: filters.startDate,
      p_end_date: filters.endDate,
      p_listing_id: listingId,
      p_channel: null,
    }),
    supabase.rpc("fetch_secondary_metrics", {
      p_host_id: host.id,
      p_start_date: filters.startDate,
      p_end_date: filters.endDate,
      p_listing_id: listingId,
      p_channel: null,
    }),
    supabase.rpc("fetch_channel_mix", {
      p_host_id: host.id,
      p_start_date: filters.startDate,
      p_end_date: filters.endDate,
      p_listing_id: listingId,
    }),
    supabase.rpc("fetch_conversion_funnel", {
      p_host_id: host.id,
      p_start_date: filters.startDate,
      p_end_date: filters.endDate,
      p_listing_id: listingId,
    }),
    supabase.rpc("fetch_looking_for_stats", {
      p_host_id: host.id,
      p_start_date: filters.startDate,
      p_end_date: filters.endDate,
    }),
  ]);

  if (performanceRes.error || !performanceRes.data) {
    return {
      success: false,
      error: "Failed to fetch property performance data",
    };
  }

  const performanceData = performanceRes.data as {
    properties: PropertyPerformanceRow[];
    total_count: number;
  };
  const properties = performanceData.properties ?? [];

  const kpis = kpisRes.data as {
    revenue: { current: number; prior: number; delta: number | null };
    revpar: { current: number };
    adr: { current: number };
    occupancy: {
      current: number;
      occupied_nights: number;
      available_nights: number;
    };
  } | null;

  const secondary = secondaryRes.data as {
    net_value: number;
    commission_saved: number;
    avg_rating: number;
    review_count: number;
    cancellation_rate: number;
    cancellation_count: number;
    total_bookings: number;
    refund_amount: number;
    refund_count: number;
    quotes_sent: number;
    quotes_accepted: number;
    acceptance_rate: number;
    listing_views: number;
  } | null;

  const channels = (channelRes.data ?? []) as ReportData["channels"];

  const funnel = funnelRes.data as ReportData["funnel"] | null;

  const lookingForRaw = lookingForRes.data as {
    quotes_sent: number;
    quotes_accepted: number;
    acceptance_rate: number;
    revenue_from_looking_for: number;
  } | null;

  const summary: ReportData["summary"] =
    kpis || secondary
      ? {
          revenue: kpis?.revenue.current ?? 0,
          revenuePrior: kpis?.revenue.prior ?? 0,
          revenueDelta: kpis?.revenue.delta ?? null,
          revpar: kpis?.revpar.current ?? 0,
          adr: kpis?.adr.current ?? 0,
          occupancy: kpis?.occupancy.current ?? 0,
          occupiedNights: kpis?.occupancy.occupied_nights ?? 0,
          availableNights: kpis?.occupancy.available_nights ?? 0,
          netValue: secondary?.net_value ?? 0,
          commissionSaved: secondary?.commission_saved ?? 0,
          avgRating: secondary?.avg_rating ?? 0,
          reviewCount: secondary?.review_count ?? 0,
          totalBookings: secondary?.total_bookings ?? 0,
          cancellationCount: secondary?.cancellation_count ?? 0,
          cancellationRate: secondary?.cancellation_rate ?? 0,
          refundAmount: secondary?.refund_amount ?? 0,
          refundCount: secondary?.refund_count ?? 0,
          quotesSent: secondary?.quotes_sent ?? 0,
          quotesAccepted: secondary?.quotes_accepted ?? 0,
          acceptanceRate: secondary?.acceptance_rate ?? 0,
          listingViews: secondary?.listing_views ?? 0,
        }
      : undefined;

  const lookingFor: ReportData["lookingFor"] = lookingForRaw
    ? {
        quotesSent: lookingForRaw.quotes_sent,
        quotesAccepted: lookingForRaw.quotes_accepted,
        acceptanceRate: lookingForRaw.acceptance_rate,
        revenue: lookingForRaw.revenue_from_looking_for,
      }
    : undefined;

  // A report with no property rows AND no summary has nothing to say.
  if (properties.length === 0 && !summary) {
    return { success: false, error: "No data available to export" };
  }

  const reportData: ReportData = {
    properties,
    startDate: filters.startDate,
    endDate: filters.endDate,
    hostName: host.display_name || "Your Properties",
    summary,
    channels,
    funnel,
    lookingFor,
  };

  try {
    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === "pdf") {
      buffer = await generatePDF(reportData);
      contentType = "application/pdf";
      filename = `wielo-analytics-${filters.startDate}-${filters.endDate}.pdf`;
    } else if (format === "xlsx") {
      buffer = await generateXLSX(reportData);
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      filename = `wielo-analytics-${filters.startDate}-${filters.endDate}.xlsx`;
    } else {
      return { success: false, error: "Invalid format specified" };
    }

    const base64 = buffer.toString("base64");

    return {
      success: true,
      data: {
        buffer: base64,
        contentType,
        filename,
        rowCount: properties.length,
      },
    };
  } catch (err) {
    console.error("Report generation error:", err);
    return {
      success: false,
      error: `Failed to generate ${format.toUpperCase()} report`,
    };
  }
}
