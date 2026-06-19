"use client";

import { Loader2 } from "lucide-react";

export type RecordTab = { key: string; label: string; count?: number };

/**
 * Canonical underline tab bar used across the record/detail pages (booking
 * record, guest record, reviews manager) so every screen feels the same.
 * Presentational — the caller owns the active key + selection (URL param or
 * state).
 *
 * Supports loading state: pass `loadingKey` to show a spinner on a specific
 * tab while navigation is pending.
 */
export function RecordTabs({
  tabs,
  active,
  onSelect,
  loadingKey,
  className = "",
}: {
  tabs: RecordTab[];
  active: string;
  onSelect: (key: string) => void;
  /** Key of the tab currently loading (shows spinner). */
  loadingKey?: string | null;
  className?: string;
}) {
  return (
    <div className={`border-b border-brand-line ${className}`}>
      <nav className="flex items-stretch gap-6 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t.key === active;
          const isLoading = loadingKey === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect(t.key)}
              disabled={isLoading}
              className={`group relative whitespace-nowrap py-3 text-[14px] font-semibold transition-colors ${
                isActive
                  ? "text-brand-secondary"
                  : "text-brand-mute hover:text-brand-ink"
              } ${isLoading ? "pointer-events-none" : ""}`}
            >
              <span className="flex items-center gap-1.5">
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t.label}
                {t.count !== undefined ? (
                  <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
                    {t.count}
                  </span>
                ) : null}
              </span>
              {isActive ? (
                <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
              ) : (
                <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-line opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
