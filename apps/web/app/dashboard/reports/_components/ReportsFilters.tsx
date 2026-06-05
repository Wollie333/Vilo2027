"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  GitCompare,
  Home,
  MapPin,
  Cable,
  FilterX,
  Clock,
  Download,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportPropertyPerformanceCSV } from "../_actions/exportPropertyPerformanceCSV";

interface ReportsFiltersProps {
  startDate?: string;
  endDate?: string;
  compare?: boolean;
  listingId?: string;
  region?: string;
  channel?: string;
  listingCount?: number;
}

export function ReportsFilters({
  startDate = "1 Jan",
  endDate = "30 Jun 2026",
  compare = false,
  listingId,
  region,
  channel,
  listingCount = 24,
}: ReportsFiltersProps) {
  const [filters, setFilters] = useState({
    dateRange: `${startDate} – ${endDate}`,
    compareEnabled: compare,
    selectedListing: listingId || "all",
    selectedRegion: region || "all",
    selectedChannel: channel || "all",
  });

  const [isExporting, startExportTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  const handleReset = () => {
    setFilters({
      dateRange: "1 Jan – 30 Jun 2026",
      compareEnabled: false,
      selectedListing: "all",
      selectedRegion: "all",
      selectedChannel: "all",
    });
  };

  const handleExportCSV = () => {
    startExportTransition(async () => {
      setExportError(null);

      try {
        const result = await exportPropertyPerformanceCSV({
          startDate: startDate || "2026-01-01",
          endDate: endDate || "2026-06-30",
          listingId: filters.selectedListing !== "all" ? filters.selectedListing : undefined,
        });

        if (!result.success || !result.data) {
          setExportError(result.error || "Export failed");
          return;
        }

        // Create Blob and trigger download
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Export error:", err);
        setExportError("An unexpected error occurred");
      }
    });
  };

  const handleExport = (format: "csv" | "pdf" | "xlsx") => {
    if (format === "csv") {
      handleExportCSV();
    } else {
      // TODO: Phase 9 - implement PDF and XLSX export
      setExportError(`${format.toUpperCase()} export coming in Phase 9`);
    }
  };

  const handleSchedule = () => {
    // TODO: Phase 10 - implement scheduled reports
    // Will open a sheet/modal with schedule configuration form
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-brand-line bg-white/70 px-5 py-2.5 lg:px-8">
      {/* Date Range Picker */}
      <button className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink hover:bg-brand-light transition-colors">
        <Calendar className="h-4 w-4 text-brand-primary" />
        <span className="font-medium">{filters.dateRange}</span>
        <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
      </button>

      {/* Compare Toggle */}
      <button
        onClick={() =>
          setFilters((prev) => ({
            ...prev,
            compareEnabled: !prev.compareEnabled,
          }))
        }
        className={`inline-flex items-center gap-1.5 rounded border border-brand-line px-3 py-2 text-sm transition-colors ${
          filters.compareEnabled
            ? "bg-brand-accent text-brand-secondary"
            : "bg-white text-brand-ink hover:bg-brand-light"
        }`}
      >
        <GitCompare className="h-4 w-4" />
        <span>vs. prior period</span>
        <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
      </button>

      {/* Listing Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink hover:bg-brand-light transition-colors">
          <Home className="h-4 w-4 text-brand-mute" />
          <span>
            {filters.selectedListing === "all"
              ? "All listings"
              : `Listing ${filters.selectedListing}`}
          </span>
          <span className="ml-1 rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold text-brand-secondary">
            {listingCount}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedListing: "all" }))}>
            All listings
          </DropdownMenuItem>
          {/* TODO: Phase 2 - populate with actual listings */}
          <DropdownMenuItem disabled className="text-xs text-brand-mute">
            Individual listings will appear here
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Region Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink hover:bg-brand-light transition-colors">
          <MapPin className="h-4 w-4 text-brand-mute" />
          <span>
            {filters.selectedRegion === "all" ? "All regions" : filters.selectedRegion}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedRegion: "all" }))}>
            All regions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedRegion: "Western Cape" }))}>
            Western Cape
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedRegion: "Gauteng" }))}>
            Gauteng
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedRegion: "KwaZulu-Natal" }))}>
            KwaZulu-Natal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedRegion: "Eastern Cape" }))}>
            Eastern Cape
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedRegion: "Other" }))}>
            Other
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Channel Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink hover:bg-brand-light transition-colors">
          <Cable className="h-4 w-4 text-brand-mute" />
          <span>
            {filters.selectedChannel === "all"
              ? "All channels"
              : filters.selectedChannel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedChannel: "all" }))}>
            All channels
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedChannel: "Direct" }))}>
            Direct
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedChannel: "Airbnb" }))}>
            Airbnb
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedChannel: "Booking.com" }))}>
            Booking.com
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedChannel: "Expedia" }))}>
            Expedia
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters((prev) => ({ ...prev, selectedChannel: "Other" }))}>
            Other
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        className="inline-flex items-center gap-1.5 rounded px-2.5 py-2 text-sm text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
      >
        <FilterX className="h-3.5 w-3.5" />
        Reset
      </button>

      {/* Right-aligned: Schedule + Export */}
      <div className="ml-auto flex items-center gap-2">
        {/* Schedule Button */}
        <button
          onClick={handleSchedule}
          className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-light"
        >
          <Clock className="h-4 w-4" />
          Schedule
        </button>

        {/* Export Button with Format Options */}
        <div className="relative">
          <div className="inline-flex items-stretch overflow-hidden rounded border border-brand-line bg-white text-sm">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                ) : (
                  <Download className="h-4 w-4 text-brand-primary" />
                )}
                {isExporting ? "Exporting..." : "Export"}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")} disabled={isExporting}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} disabled={isExporting}>
                  Export as PDF (Phase 9)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("xlsx")} disabled={isExporting}>
                  Export as XLSX (Phase 9)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="w-px bg-brand-line"></span>
            <span className="inline-flex items-center px-2 font-mono text-[10px] text-brand-mute">
              CSV · PDF · XLSX
            </span>
          </div>

          {/* Error Message */}
          {exportError && (
            <div className="absolute top-full right-0 z-50 mt-2 w-64 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 shadow-lg">
              <button
                onClick={() => setExportError(null)}
                className="float-right ml-2 text-red-500 hover:text-red-700"
              >
                ✕
              </button>
              {exportError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
