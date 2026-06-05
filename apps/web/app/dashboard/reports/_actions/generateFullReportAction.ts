"use server";

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { generatePDF } from "@/lib/reports/export/pdf";
import { generateXLSX } from "@/lib/reports/export/xlsx";

interface PropertyPerformanceRow {
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

interface ExportFilters {
  startDate: string;
  endDate: string;
  listingId?: string;
}

export async function generateFullReportAction(
  format: "pdf" | "xlsx",
  filters: ExportFilters
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
    return {
      success: false,
      error: "Host not found",
    };
  }

  // Fetch property performance data (all properties, no pagination)
  const { data, error } = await supabase.rpc("fetch_property_performance", {
    p_host_id: host.id,
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_sort_by: "revenue",
    p_sort_direction: "desc",
    p_limit: 1000, // Export all properties
    p_offset: 0,
  });

  if (error || !data) {
    return {
      success: false,
      error: "Failed to fetch property performance data",
    };
  }

  const performanceData = data as {
    properties: PropertyPerformanceRow[];
    total_count: number;
  };

  if (!performanceData.properties || performanceData.properties.length === 0) {
    return {
      success: false,
      error: "No data available to export",
    };
  }

  // Prepare report data
  const reportData = {
    properties: performanceData.properties,
    startDate: filters.startDate,
    endDate: filters.endDate,
    hostName: host.display_name || "Your Properties",
  };

  try {
    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === "pdf") {
      buffer = await generatePDF(reportData);
      contentType = "application/pdf";
      filename = `property-performance-${filters.startDate}-${filters.endDate}.pdf`;
    } else if (format === "xlsx") {
      buffer = await generateXLSX(reportData);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      filename = `property-performance-${filters.startDate}-${filters.endDate}.xlsx`;
    } else {
      return {
        success: false,
        error: "Invalid format specified",
      };
    }

    // Convert buffer to base64 for transmission
    const base64 = buffer.toString("base64");

    return {
      success: true,
      data: {
        buffer: base64,
        contentType,
        filename,
        rowCount: performanceData.properties.length,
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
