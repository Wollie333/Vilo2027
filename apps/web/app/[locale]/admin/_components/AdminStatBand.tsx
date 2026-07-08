import { Link } from "@/i18n/navigation";

// Seamless KPI band — the same look the admin overview uses (rounded-16 shell,
// hairline gap-px dividers on a brand-line background). Reuse across admin list
// pages so the whole console reads as one system.

export type AdminStat = {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  /** Coloured value — e.g. amber for an at-attention count. */
  tone?: "default" | "amber" | "primary";
};

// Grid classes tuned per tile count so rows always fill evenly (no orphan tile).
const GRID: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

export function AdminStatBand({
  stats,
  cols = 4,
}: {
  stats: AdminStat[];
  cols?: 3 | 4 | 5 | 6;
}) {
  return (
    <section
      className={`grid gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line ${GRID[cols] ?? GRID[4]}`}
    >
      {stats.map((s) => {
        const valueCls =
          s.tone === "amber"
            ? "text-status-pending"
            : s.tone === "primary"
              ? "text-brand-primary"
              : "text-brand-ink";
        const body = (
          <>
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
              {s.label}
            </div>
            <div
              className={`num mt-1.5 font-display text-[22px] font-bold leading-none ${valueCls}`}
            >
              {s.value}
            </div>
            {s.sub ? (
              <div className="mt-1 text-[11px] text-brand-mute">{s.sub}</div>
            ) : null}
          </>
        );
        return s.href ? (
          <Link
            key={s.label}
            href={s.href}
            className="bg-[#FAFCFB] p-4 transition-colors hover:bg-white"
          >
            {body}
          </Link>
        ) : (
          <div key={s.label} className="bg-[#FAFCFB] p-4">
            {body}
          </div>
        );
      })}
    </section>
  );
}
