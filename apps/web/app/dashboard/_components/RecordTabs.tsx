"use client";

export type RecordTab = { key: string; label: string; count?: number };

/**
 * Canonical underline tab bar used across the record/detail pages (booking
 * record, guest record, reviews manager) so every screen feels the same.
 * Presentational — the caller owns the active key + selection (URL param or
 * state).
 */
export function RecordTabs({
  tabs,
  active,
  onSelect,
  className = "",
}: {
  tabs: RecordTab[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={`border-b border-brand-line ${className}`}>
      <nav className="flex items-stretch gap-6 overflow-x-auto">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect(t.key)}
              className={`relative whitespace-nowrap py-3 text-[14px] font-semibold transition-colors ${
                isActive
                  ? "text-brand-secondary"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              {t.label}
              {t.count !== undefined ? (
                <span className="ml-1.5 rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
                  {t.count}
                </span>
              ) : null}
              {isActive ? (
                <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-brand-primary" />
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
