import type { AnalyticsTrendPoint } from "@/lib/website/analytics";

// Pure SVG area chart of daily visitors. No deps, no client JS — the trend array
// is precomputed server-side. Falls back to a flat baseline when all-zero.
const W = 700;
const H = 160;

export function TrafficChart({ trend }: { trend: AnalyticsTrendPoint[] }) {
  const points =
    trend.length > 0 ? trend : [{ date: "", visitors: 0, pageviews: 0 }];
  const max = Math.max(1, ...points.map((p) => p.visitors));
  const stepX = points.length > 1 ? W / (points.length - 1) : W;

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = H - (p.visitors / max) * (H - 16) - 8;
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-[150px] w-full"
      role="img"
      aria-label="Visitor trend"
    >
      <defs>
        <linearGradient id="ovTrend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="#EDF3EF" strokeWidth="1">
        <line x1="0" y1={H * 0.25} x2={W} y2={H * 0.25} />
        <line x1="0" y1={H * 0.5} x2={W} y2={H * 0.5} />
        <line x1="0" y1={H * 0.75} x2={W} y2={H * 0.75} />
      </g>
      <path d={area} fill="url(#ovTrend)" />
      <path
        d={line}
        fill="none"
        stroke="#10B981"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
