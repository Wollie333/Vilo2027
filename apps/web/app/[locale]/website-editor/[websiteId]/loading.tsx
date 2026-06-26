/**
 * Instant Suspense fallback for the full-screen website editors (page builder,
 * blog/form/navigation editors). These are the heaviest routes in the app and
 * had NO loading boundary — so clicking "Edit page" froze the previous screen
 * until the builder finished loading. This paints a builder-shaped skeleton
 * (toolbar + palette · canvas · inspector) the instant the link is clicked, so
 * the navigation feels immediate while the real editor streams in. Pairs with
 * the global top-bar + the "Opening the editor…" busy overlay on the trigger.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-brand-line/70 ${className}`} />
  );
}

export default function WebsiteEditorLoading() {
  return (
    <div
      aria-hidden
      className="flex h-screen w-full flex-col bg-brand-light/60"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-brand-line bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <Bar className="h-7 w-7 rounded-full" />
          <Bar className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Bar className="h-8 w-24" />
          <Bar className="h-8 w-28" />
        </div>
      </div>

      {/* Palette · canvas · inspector */}
      <div className="flex min-h-0 flex-1">
        {/* Left palette */}
        <div className="hidden w-64 shrink-0 space-y-3 border-r border-brand-line bg-white p-4 lg:block">
          <Bar className="h-4 w-28" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Bar key={i} className="h-9 w-full" />
          ))}
        </div>

        {/* Canvas */}
        <div className="min-w-0 flex-1 overflow-hidden p-6">
          <div className="mx-auto max-w-3xl space-y-5">
            <Bar className="h-48 w-full" />
            <Bar className="h-5 w-1/2" />
            <Bar className="h-3.5 w-3/4" />
            <Bar className="h-3.5 w-2/3" />
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Bar className="h-32 w-full" />
              <Bar className="h-32 w-full" />
            </div>
          </div>
        </div>

        {/* Right inspector */}
        <div className="hidden w-80 shrink-0 space-y-4 border-l border-brand-line bg-white p-4 xl:block">
          <Bar className="h-4 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-3 w-20" />
              <Bar className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
