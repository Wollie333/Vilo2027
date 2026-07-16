"use client";

import { Loader2 } from "lucide-react";

import { Link } from "@/i18n/navigation";

export type RecordTab = {
  key: string;
  label: string;
  count?: number;
  /**
   * Route for tabs that are real pages rather than in-page panels. When set the
   * tab renders as a <Link> (prefetch, middle-click, open-in-new-tab all work)
   * and `onSelect` is not needed.
   */
  href?: string;
};

/**
 * Canonical underline tab bar. Used by the record/detail pages (booking record,
 * guest record, admin user record, reviews manager) AND by section navs that
 * are separate routes (guest settings, admin subscriptions) — one component so
 * "tabs" look identical everywhere instead of each page hand-rolling a variant.
 *
 * Two modes, mix freely:
 *   - panel tabs  → pass `onSelect`; caller owns the active key (state/URL param)
 *   - route tabs  → give each tab an `href`; `active` matches the tab's `key`
 *
 * Presentational otherwise. Pass `loadingKey` to spin a specific tab while
 * navigation is pending.
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
  /** Required for panel tabs; optional when every tab has an `href`. */
  onSelect?: (key: string) => void;
  /** Key of the tab currently loading (shows spinner). */
  loadingKey?: string | null;
  className?: string;
}) {
  return (
    <div className={`border-b border-brand-line ${className}`}>
      <nav className="thin-scroll flex items-stretch gap-6 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t.key === active;
          const isLoading = loadingKey === t.key;

          // One class string + one body for both modes, so a <Link> tab and a
          // <button> tab can never drift apart visually.
          const cls = `group relative whitespace-nowrap py-3 text-[14px] font-semibold transition-colors ${
            isActive
              ? "text-brand-secondary"
              : "text-brand-mute hover:text-brand-ink"
          } ${isLoading ? "pointer-events-none" : ""}`;

          const body = (
            <>
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
            </>
          );

          return t.href ? (
            <Link
              key={t.key}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect?.(t.key)}
              className={cls}
            >
              {body}
            </Link>
          ) : (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect?.(t.key)}
              disabled={isLoading}
              aria-current={isActive ? "page" : undefined}
              className={cls}
            >
              {body}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
