"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useEffect } from "react";

// Route-level error boundary for /admin/*. Catches anything the layout
// doesn't already handle — most importantly AdminPermissionDenied thrown
// from page-level requirePermission() calls. Without this the user sees
// the generic Next.js "Application error" 500 page.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real cause in Vercel server logs even when the user
    // sees a friendly UI.
    console.error("[admin] uncaught error", {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  const isPermissionDenied =
    error.name === "AdminPermissionDenied" ||
    error.message.toLowerCase().includes("permission");

  return (
    <div className="mx-auto max-w-xl space-y-5 py-10">
      <div className="flex items-start gap-3 rounded-card border border-amber-500/40 bg-amber-500/5 p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold text-brand-ink">
            {isPermissionDenied
              ? "You don't have access to this page"
              : "Something went wrong"}
          </h1>
          <p className="mt-1 text-sm text-brand-mute">
            {isPermissionDenied
              ? "Your admin role doesn't include the permission this page needs. Ask a super admin to grant it."
              : "An unexpected error stopped this page from loading. The details are in the server logs."}
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-[11px] text-brand-mute">
              digest: {error.digest}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
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
