"use server";

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

export async function exportPropertyPerformanceCSV(filters: ExportFilters) {
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

  // Build CSV content
  const headers = [
    "Property",
    "Status",
    "Revenue (Current)",
    "Revenue (Prior)",
    "Revenue Change %",
    "Nights Booked",
    "Occupancy % (Current)",
    "Occupancy % (Prior)",
    "Occupancy Change %",
    "ADR",
    "Bookings",
  ];

  const rows = performanceData.properties.map((property) => [
    escapeCSV(property.listing_name),
    property.listing_status,
    property.revenue.toFixed(2),
    property.revenue_prior.toFixed(2),
    property.revenue_delta !== null ? property.revenue_delta.toFixed(1) : "N/A",
    property.nights_booked.toString(),
    property.occupancy.toFixed(1),
    property.occupancy_prior.toFixed(1),
    property.occupancy_delta !== null
      ? property.occupancy_delta.toFixed(1)
      : "N/A",
    property.adr.toFixed(2),
    property.bookings_count.toString(),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Return CSV string
  return {
    success: true,
    data: {
      csv: csvContent,
      filename: `property-performance-${filters.startDate}-${filters.endDate}.csv`,
      rowCount: performanceData.properties.length,
    },
  };
}

// Helper: Escape CSV values (handle commas, quotes)
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
