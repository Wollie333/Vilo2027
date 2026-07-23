import { formatMoneyExact } from "@/lib/format";

import type {
  CommissionByKind,
  Funnel,
  ScorePoint,
} from "@/lib/affiliate/metrics";

// Shared, purely-presentational metric pieces for the affiliate Metrics tab and
// the program analytics page. All server-rendered — the sparkline is inline SVG,
// no client JS. Styling uses the affiliate-manager design classes (am-card /
// smallcaps / num / tag / brand-* tokens).

const KIND_LABELS: Record<string, string> = {
  subscription: "Subscriptions",
  conversion_bonus: "Conversion bonuses",
  upgrade: "Upgrades",
  setup_fee: "Setup fees",
};

function pct(n: number, of: number): string {
  if (of <= 0) return "—";
  return `${Math.round((n / of) * 100)}%`;
}

/**
 * The attribution funnel as a strip of steps. Each step shows its count and, from
 * the second step on, its conversion rate off the PREVIOUS step (the drop-off).
 */
export function FunnelStrip({
  steps,
}: {
  steps: { label: string; value: number; hint?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-3 lg:grid-cols-5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]!.value : null;
        return (
          <div key={s.label} className="bg-white p-4">
            <div className="smallcaps">{s.label}</div>
            <div className="num mt-1.5 font-display text-[22px] font-extrabold leading-none text-brand-ink">
              {s.value.toLocaleString("en-ZA")}
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              {prev != null ? (
                <span>
                  <span className="font-semibold text-brand-primary">
                    {pct(s.value, prev)}
                  </span>{" "}
                  of previous
                </span>
              ) : (
                (s.hint ?? "top of funnel")
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A labelled stat tile matching the campaign Overview band. */
export function StatTile({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ink" | "primary" | "mute";
}) {
  const valueCls =
    tone === "primary"
      ? "text-brand-primary"
      : tone === "mute"
        ? "text-brand-mute"
        : "text-brand-ink";
  return (
    <div className="bg-[#FAFCFB] p-4">
      <div className="smallcaps">{label}</div>
      <div
        className={`num mt-1.5 font-display text-[16px] font-bold leading-tight ${valueCls}`}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-1 text-[11px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}

/** Wrap a set of StatTiles in the seamless bordered band. */
export function StatBand({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-brand-line bg-brand-line sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </section>
  );
}

/** Net commission by kind, as labelled proportional bars. */
export function KindBreakdown({
  rows,
  currency,
}: {
  rows: CommissionByKind[];
  currency: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  if (!rows.length) {
    return (
      <div className="px-5 py-8 text-center text-[13px] text-brand-mute">
        No commission has accrued here yet.
      </div>
    );
  }
  return (
    <div className="space-y-3 px-5 py-4">
      {rows.map((r) => (
        <div key={r.kind}>
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-medium text-brand-ink">
              {KIND_LABELS[r.kind] ?? r.kind}
              <span className="ml-1.5 text-[11px] text-brand-mute">
                ×{r.count}
              </span>
            </span>
            <span
              className={`num font-semibold ${r.net < 0 ? "text-red-600" : "text-brand-ink"}`}
            >
              {formatMoneyExact(r.net, currency)}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-light">
            <div
              className={`h-full rounded-full ${r.net < 0 ? "bg-red-400" : "bg-brand-primary"}`}
              style={{ width: `${Math.round((Math.abs(r.net) / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Inline-SVG sparkline of daily live listings. Degrades gracefully: one point
 * renders a dot, none renders an empty-state message.
 */
export function Sparkline({
  points,
  height = 64,
}: {
  points: ScorePoint[];
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-[13px] text-brand-mute">
        No scoring snapshots yet — the daily cron writes the first one
        overnight.
      </div>
    );
  }
  const w = 600;
  const h = height;
  const pad = 6;
  const max = Math.max(1, ...points.map((p) => p.listings));
  const n = points.length;
  const x = (i: number) =>
    n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const last = points[n - 1]!;
  const first = points[0]!;
  const line = points.map((p, i) => `${x(i)},${y(p.listings)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${x(n - 1)},${h - pad}`;

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-baseline justify-between text-[11.5px] text-brand-mute">
        <span>{first.date}</span>
        <span>
          <span className="num font-semibold text-brand-ink">
            {last.listings}
          </span>{" "}
          live · {last.date}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-16 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Daily live listings"
      >
        <polygon
          points={area}
          fill="var(--brand-primary, #1f7a5a)"
          opacity="0.08"
        />
        <polyline
          points={line}
          fill="none"
          stroke="var(--brand-primary, #1f7a5a)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {n === 1 ? (
          <circle
            cx={x(0)}
            cy={y(points[0]!.listings)}
            r="3"
            fill="var(--brand-primary, #1f7a5a)"
          />
        ) : null}
      </svg>
    </div>
  );
}

/** Compact one-line funnel summary used inside the program page header. */
export function funnelSummary(f: Funnel): string {
  return `${f.referrals} referred · ${f.hosts} became hosts · ${f.payingHosts} paying`;
}
