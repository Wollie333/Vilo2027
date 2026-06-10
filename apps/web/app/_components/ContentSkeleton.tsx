/**
 * Shared loading skeleton for the padded content shell.
 *
 * Every logged-in page is `force-dynamic`, so each sidebar navigation is a
 * server roundtrip. Without a Suspense boundary the click blocks on the old
 * page until the server responds — which is what made the app feel laggy.
 *
 * A `loading.tsx` at each shell root (`/dashboard`, `/portal`, `/admin`)
 * renders this skeleton the instant a link is clicked, so navigation feels
 * immediate while the real content streams in. Next.js also prefetches this
 * boundary on link hover/viewport, so the skeleton is usually already warm.
 *
 * The shell (header + sidebar) lives in the layout and stays mounted across
 * navigation — this only fills the inner content column, and the layout
 * already provides the page padding, so we render bare content here.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-brand-line/70 ${className}`} />
  );
}

export function ContentSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      {/* Title row + primary action */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2.5">
          <Bar className="h-6 w-48" />
          <Bar className="h-3.5 w-64" />
        </div>
        <Bar className="h-9 w-32 shrink-0" />
      </div>

      {/* KPI / stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-card border border-brand-line bg-white p-4"
          >
            <Bar className="h-3 w-20" />
            <Bar className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>

      {/* Main content panel — list / table rows */}
      <div className="overflow-hidden rounded-card border border-brand-line bg-white">
        <div className="border-b border-brand-line px-5 py-4">
          <Bar className="h-4 w-40" />
        </div>
        <div className="divide-y divide-brand-line">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-brand-line/70" />
              <div className="min-w-0 flex-1 space-y-2">
                <Bar className="h-3.5 w-1/3" />
                <Bar className="h-3 w-1/2" />
              </div>
              <Bar className="hidden h-3.5 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
