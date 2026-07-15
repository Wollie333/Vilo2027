"use client";

import { useState, useTransition } from "react";
import {
  GitCompare,
  Home,
  Cable,
  FilterX,
  Download,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { DateRangePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportPropertyPerformanceCSV } from "../_actions/exportPropertyPerformanceCSV";
import { generateFullReportAction } from "../_actions/generateFullReportAction";

export interface ListingOption {
  id: string;
  name: string;
}

interface ReportsFiltersProps {
  startDate: string;
  endDate: string;
  compare?: boolean;
  listingId?: string;
  channel?: string;
  /** Real listings for the host, used to populate the Listing filter. */
  listings: ListingOption[];
  /** Distinct channel keys the host actually has bookings on (data-driven). */
  channelOptions: string[];
}

// Pretty labels for the channel keys the RPC returns.
const CHANNEL_LABELS: Record<string, string> = {
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

function channelLabel(key: string): string {
  return (
    CHANNEL_LABELS[key.toLowerCase()] ??
    key.charAt(0).toUpperCase() + key.slice(1)
  );
}

export function ReportsFilters({
  startDate,
  endDate,
  compare = false,
  listingId,
  channel,
  listings,
  channelOptions,
}: ReportsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isExporting, startExportTransition] = useTransition();
  const [isPending, startNavTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  // Merge a patch into the current query string and navigate. `null` clears a key.
  const applyPatch = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    startNavTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  const handleReset = () => {
    startNavTransition(() => {
      router.push(pathname);
    });
  };

  const selectedListingName =
    listingId && listings.find((l) => l.id === listingId)?.name;

  const handleExportCSV = () => {
    startExportTransition(async () => {
      setExportError(null);
      try {
        const result = await exportPropertyPerformanceCSV({
          startDate,
          endDate,
          listingId: listingId || undefined,
        });
        if (!result.success || !result.data) {
          setExportError(result.error || "Export failed");
          return;
        }
        triggerDownload(
          new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" }),
          result.data.filename,
        );
      } catch (err) {
        console.error("Export error:", err);
        setExportError("An unexpected error occurred");
      }
    });
  };

  const handleExportPDFOrXLSX = (format: "pdf" | "xlsx") => {
    startExportTransition(async () => {
      setExportError(null);
      try {
        const result = await generateFullReportAction(format, {
          startDate,
          endDate,
          listingId: listingId || undefined,
        });
        if (!result.success || !result.data) {
          setExportError(result.error || "Export failed");
          return;
        }
        const binaryString = atob(result.data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        triggerDownload(
          new Blob([bytes], { type: result.data.contentType }),
          result.data.filename,
        );
      } catch (err) {
        console.error("Export error:", err);
        setExportError("An unexpected error occurred");
      }
    });
  };

  const handleExport = (format: "csv" | "pdf" | "xlsx") => {
    if (format === "csv") handleExportCSV();
    else handleExportPDFOrXLSX(format);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-brand-line bg-white/70 px-5 py-2.5 lg:px-8">
      {/* Date Range Picker — writes ?start & ?end */}
      <div className="min-w-[240px]">
        <DateRangePicker
          from={startDate}
          to={endDate}
          labelFrom="From"
          labelTo="To"
          onChange={(from, to) => {
            // Only navigate once a full range is chosen (to is set).
            if (from && to) applyPatch({ start: from, end: to });
          }}
        />
      </div>

      {/* Compare Toggle — writes ?compare */}
      <button
        onClick={() => applyPatch({ compare: compare ? null : "true" })}
        className={`inline-flex items-center gap-1.5 rounded border border-brand-line px-3 py-2 text-sm transition-colors ${
          compare
            ? "bg-brand-accent text-brand-secondary"
            : "bg-white text-brand-ink hover:bg-brand-light"
        }`}
      >
        <GitCompare className="h-4 w-4" />
        <span>vs. prior period</span>
      </button>

      {/* Listing Filter — writes ?listing */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-light">
          <Home className="h-4 w-4 text-brand-mute" />
          <span className="max-w-[160px] truncate">
            {selectedListingName || "All listings"}
          </span>
          <span className="ml-1 rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold text-brand-secondary">
            {listings.length}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuItem onClick={() => applyPatch({ listing: null })}>
            All listings
          </DropdownMenuItem>
          {listings.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs text-brand-mute">
              No listings yet
            </DropdownMenuItem>
          ) : (
            listings.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onClick={() => applyPatch({ listing: l.id })}
                className={l.id === listingId ? "font-semibold" : ""}
              >
                {l.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Channel Filter — writes ?channel (data-driven) */}
      {channelOptions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-light">
            <Cable className="h-4 w-4 text-brand-mute" />
            <span>{channel ? channelLabel(channel) : "All channels"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-brand-mute" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => applyPatch({ channel: null })}>
              All channels
            </DropdownMenuItem>
            {channelOptions.map((c) => (
              <DropdownMenuItem
                key={c}
                onClick={() => applyPatch({ channel: c })}
                className={c === channel ? "font-semibold" : ""}
              >
                {channelLabel(c)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Reset — clears all filter params */}
      <button
        onClick={handleReset}
        className="inline-flex items-center gap-1.5 rounded px-2.5 py-2 text-sm text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
      >
        <FilterX className="h-3.5 w-3.5" />
        Reset
      </button>

      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
      )}

      {/* Right-aligned: Export */}
      <div className="ml-auto flex items-center gap-2">
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
                <DropdownMenuItem
                  onClick={() => handleExport("csv")}
                  disabled={isExporting}
                >
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("pdf")}
                  disabled={isExporting}
                >
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("xlsx")}
                  disabled={isExporting}
                >
                  Export as XLSX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="w-px bg-brand-line"></span>
            <span className="inline-flex items-center px-2 font-mono text-[10px] text-brand-mute">
              CSV · PDF · XLSX
            </span>
          </div>

          {exportError && (
            <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 shadow-lg">
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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
