"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { exportPropertyPerformanceCSV } from "../_actions/exportPropertyPerformanceCSV";

interface ExportButtonProps {
  startDate: string;
  endDate: string;
  listingId?: string;
}

export function ExportButton({
  startDate,
  endDate,
  listingId,
}: ExportButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleExportCSV = () => {
    startTransition(async () => {
      setError(null);

      try {
        const result = await exportPropertyPerformanceCSV({
          startDate,
          endDate,
          listingId,
        });

        if (!result.success || !result.data) {
          setError(result.error || "Export failed");
          return;
        }

        // Create Blob from CSV string
        const blob = new Blob([result.data.csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);

        // Trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Export error:", err);
        setError("An unexpected error occurred");
      }
    });
  };

  return (
    <div className="relative">
      <button
        onClick={handleExportCSV}
        disabled={isPending}
        className="flex items-center gap-2 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span>{isPending ? "Exporting..." : "Export CSV"}</span>
      </button>

      {error && (
        <div className="absolute top-full mt-2 w-64 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
