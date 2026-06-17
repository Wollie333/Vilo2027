"use client";

import { useState, useTransition } from "react";
import {
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

interface PerformanceTableClientProps {
  initialData: PropertyData[];
  totalCount: number;
  hostId: string;
  startDate: string;
  endDate: string;
}

type SortColumn =
  | "revenue"
  | "occupancy"
  | "nights_booked"
  | "adr"
  | "listing_name";
type SortDirection = "asc" | "desc";

export function PerformanceTableClient({
  initialData,
  totalCount,
  hostId,
  startDate,
  endDate,
}: PerformanceTableClientProps) {
  const [properties, setProperties] = useState<PropertyData[]>(initialData);
  const [sortBy, setSortBy] = useState<SortColumn>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);

  const supabase = createClient();

  const fetchSortedData = async (
    column: SortColumn,
    direction: SortDirection,
    page: number,
  ) => {
    const offset = (page - 1) * pageSize;

    const { data, error } = await supabase.rpc("fetch_property_performance", {
      p_host_id: hostId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_sort_by: column,
      p_sort_direction: direction,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (!error && data) {
      const response = data as { properties: PropertyData[] };
      setProperties(response.properties || []);
    }
  };

  const handleSort = (column: SortColumn) => {
    startTransition(async () => {
      const newDirection =
        sortBy === column && sortDirection === "desc" ? "asc" : "desc";
      setSortBy(column);
      setSortDirection(newDirection);
      setCurrentPage(1);
      await fetchSortedData(column, newDirection, 1);
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    startTransition(async () => {
      setCurrentPage(newPage);
      await fetchSortedData(sortBy, sortDirection, newPage);
    });
  };

  return (
    <div className="rounded-card border border-brand-line bg-white">
      {/* Header */}
      <div className="border-b border-brand-line p-5 lg:p-6">
        <div className="text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          Property performance
        </div>
        <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
          {totalCount} {totalCount === 1 ? "property" : "properties"}
        </h3>
        <div className="mt-0.5 text-xs text-brand-mute">
          Revenue, occupancy, and ADR by listing
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-line bg-brand-light text-xs">
              <th className="px-4 py-3 text-left font-medium text-brand-mute">
                <button
                  onClick={() => handleSort("listing_name")}
                  className="flex items-center gap-1.5 hover:text-brand-ink"
                  disabled={isPending}
                >
                  Property
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium text-brand-mute">
                <button
                  onClick={() => handleSort("revenue")}
                  className="ml-auto flex items-center gap-1.5 hover:text-brand-ink"
                  disabled={isPending}
                >
                  Revenue
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium text-brand-mute">
                <button
                  onClick={() => handleSort("occupancy")}
                  className="ml-auto flex items-center gap-1.5 hover:text-brand-ink"
                  disabled={isPending}
                >
                  Occupancy
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium text-brand-mute">
                <button
                  onClick={() => handleSort("nights_booked")}
                  className="ml-auto flex items-center gap-1.5 hover:text-brand-ink"
                  disabled={isPending}
                >
                  Nights
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium text-brand-mute">
                <button
                  onClick={() => handleSort("adr")}
                  className="ml-auto flex items-center gap-1.5 hover:text-brand-ink"
                  disabled={isPending}
                >
                  ADR
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium text-brand-mute">
                Trend (30d)
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <tr
                key={property.property_id}
                className="border-b border-brand-line last:border-0 hover:bg-brand-light/50"
              >
                {/* Property Name + Status */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {property.cover_image_url ? (
                      <img
                        src={property.cover_image_url}
                        alt={property.listing_name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-light text-xs font-medium text-brand-mute">
                        {property.listing_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-brand-ink">
                        {property.listing_name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${
                            property.listing_status === "active"
                              ? "bg-green-100 text-green-800"
                              : property.listing_status === "draft"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {property.listing_status}
                        </span>
                        <span className="text-xs text-brand-mute">
                          {property.bookings_count}{" "}
                          {property.bookings_count === 1
                            ? "booking"
                            : "bookings"}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Revenue */}
                <td className="px-4 py-3 text-right">
                  <div className="text-sm font-semibold text-brand-ink">
                    R {formatCurrency(property.revenue)}
                  </div>
                  {property.revenue_delta !== null && (
                    <div
                      className={`mt-0.5 flex items-center justify-end gap-1 text-xs ${
                        property.revenue_delta > 0
                          ? "text-green-600"
                          : property.revenue_delta < 0
                            ? "text-red-600"
                            : "text-brand-mute"
                      }`}
                    >
                      {property.revenue_delta > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : property.revenue_delta < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      <span>
                        {property.revenue_delta > 0 ? "+" : ""}
                        {property.revenue_delta.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </td>

                {/* Occupancy */}
                <td className="px-4 py-3 text-right">
                  <div className="text-sm font-semibold text-brand-ink">
                    {property.occupancy.toFixed(1)}%
                  </div>
                  {property.occupancy_delta !== null && (
                    <div
                      className={`mt-0.5 flex items-center justify-end gap-1 text-xs ${
                        property.occupancy_delta > 0
                          ? "text-green-600"
                          : property.occupancy_delta < 0
                            ? "text-red-600"
                            : "text-brand-mute"
                      }`}
                    >
                      {property.occupancy_delta > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : property.occupancy_delta < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      <span>
                        {property.occupancy_delta > 0 ? "+" : ""}
                        {property.occupancy_delta.toFixed(1)}pp
                      </span>
                    </div>
                  )}
                </td>

                {/* Nights Booked */}
                <td className="px-4 py-3 text-right">
                  <div className="text-sm font-semibold text-brand-ink">
                    {property.nights_booked}
                  </div>
                </td>

                {/* ADR */}
                <td className="px-4 py-3 text-right">
                  <div className="text-sm font-semibold text-brand-ink">
                    R {property.adr.toFixed(0)}
                  </div>
                </td>

                {/* Sparkline */}
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <Sparkline data={property.sparkline} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-brand-line px-4 py-3">
          <div className="text-xs text-brand-mute">
            Page {currentPage} of {totalPages} · {totalCount} total properties
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
              className="flex h-8 w-8 items-center justify-center rounded border border-brand-line bg-white text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
              className="flex h-8 w-8 items-center justify-center rounded border border-brand-line bg-white text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-accent border-t-brand-primary"></div>
        </div>
      )}
    </div>
  );
}

// Helper: Format currency with spaces for thousands
function formatCurrency(value: number): string {
  return value
    .toLocaleString("en-ZA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/,/g, " ");
}

// Helper: Sparkline component (mini line chart)
function Sparkline({
  data,
}: {
  data: Array<{ date: string; revenue: number }>;
}) {
  if (!data || data.length === 0) return null;

  const values = data.map((d) => d.revenue);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;

  const width = 80;
  const height = 24;
  const padding = 2;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - padding * 2) + padding;
      const y =
        height - ((value - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke="#10B981"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}
