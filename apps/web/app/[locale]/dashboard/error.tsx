"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useEffect } from "react";

// Route-level error boundary for /dashboard/*. Renders inside the dashboard
// layout, so the sidebar/nav stay put and only the content area shows the
// failure. Catches throws from page-level queries wrapped in throwOnError()
// (lib/supabase/query.ts) — a failed list/figure now shows loudly here
// instead of silently rendering as an empty/zero state.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real cause in Vercel server logs even when the user sees a
    // friendly UI. (The throwOnError() helper already logs the original
    // Postgrest error server-side; this catches anything else too.)
    console.error("[dashboard] uncaught error", {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-5 py-10">
      <div className="flex items-start gap-3 rounded-card border border-status-cancelled/40 bg-status-cancelled/5 p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-cancelled" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold text-brand-ink">
            Couldn&apos;t load this page
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            Something went wrong fetching the data for this page, so we&apos;ve
            stopped rather than show you an empty or incorrect view. Try again;
            if it keeps happening, the details are in the server logs.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-[11px] text-brand-mute">
              digest: {error.digest}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
            </Link>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-secondary"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
