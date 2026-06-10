/**
 * Full-bleed loading skeleton for the shared inbox (host + guest).
 *
 * The inbox is a full-bleed two-pane chat, so the generic ContentSkeleton
 * (which assumes the padded content shell) would render flush against the
 * viewport edge and look broken. This mirrors the real list + conversation
 * layout so navigating into the inbox feels instant.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-brand-line/70 ${className}`} />
  );
}

export function InboxSkeleton() {
  return (
    <div aria-hidden className="flex min-h-0 flex-1">
      {/* Conversation list */}
      <div className="hidden w-[320px] shrink-0 flex-col border-r border-brand-line bg-white md:flex">
        <div className="border-b border-brand-line px-4 py-4">
          <Bar className="h-9 w-full" />
        </div>
        <div className="divide-y divide-brand-line">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-brand-line/70" />
              <div className="min-w-0 flex-1 space-y-2">
                <Bar className="h-3.5 w-2/3" />
                <Bar className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation pane */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#fbfbfb]">
        <div className="flex items-center gap-3 border-b border-brand-line bg-white px-5 py-4">
          <div className="h-9 w-9 animate-pulse rounded-full bg-brand-line/70" />
          <Bar className="h-4 w-40" />
        </div>
        <div className="flex-1 space-y-4 px-5 py-6">
          <Bar className="h-12 w-2/3 rounded-card" />
          <div className="flex justify-end">
            <Bar className="h-12 w-1/2 rounded-card" />
          </div>
          <Bar className="h-12 w-3/5 rounded-card" />
          <div className="flex justify-end">
            <Bar className="h-12 w-2/5 rounded-card" />
          </div>
        </div>
        <div className="border-t border-brand-line bg-white px-5 py-4">
          <Bar className="h-11 w-full rounded-pill" />
        </div>
      </div>
    </div>
  );
}
