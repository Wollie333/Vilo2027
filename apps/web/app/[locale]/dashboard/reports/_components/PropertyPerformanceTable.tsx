import { createServerClient } from "@/lib/supabase/server";
import { PerformanceTableClient } from "./PerformanceTableClient";

interface PropertyPerformanceTableProps {
  hostId: string;
  startDate: string;
  endDate: string;
  listingId?: string;
}

interface PropertyData {
  property_id: string;
  listing_name: string;
  listing_slug: string;
  cover_image_url: string | null;
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
  sparkline: Array<{ date: string; revenue: number }>;
}

interface PropertyPerformanceResponse {
  properties: PropertyData[];
  total_count: number;
  page_size: number;
  offset: number;
}

export async function PropertyPerformanceTable({
  hostId,
  startDate,
  endDate,
  listingId, // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future filtering
}: PropertyPerformanceTableProps) {
  const supabase = createServerClient();

  // Fetch property performance data (default: first page, sorted by revenue desc)
  const { data, error } = await supabase.rpc("fetch_property_performance", {
    p_host_id: hostId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_sort_by: "revenue",
    p_sort_direction: "desc",
    p_limit: 25,
    p_offset: 0,
  });

  if (error) {
    console.error("Error fetching property performance:", error);
    return (
      <div className="rounded-card border border-brand-line bg-white p-8 text-center">
        <p className="text-sm text-brand-mute">
          Error loading property performance data.
        </p>
      </div>
    );
  }

  const performanceData = data as PropertyPerformanceResponse | null;

  if (!performanceData || performanceData.properties.length === 0) {
    return (
      <div className="rounded-card border border-brand-line bg-white p-8 text-center">
        <p className="text-sm text-brand-mute">
          No property performance data available for this period.
        </p>
      </div>
    );
  }

  return (
    <PerformanceTableClient
      initialData={performanceData.properties}
      totalCount={performanceData.total_count}
      hostId={hostId}
      startDate={startDate}
      endDate={endDate}
    />
  );
}
