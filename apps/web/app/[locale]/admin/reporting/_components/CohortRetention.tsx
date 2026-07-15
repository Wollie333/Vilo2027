import type { CohortAnalysis } from "@/lib/billing/platform-report";

import { AdminKpiCard } from "../../_components/AdminKpiCard";

// Retention heat cell: green at 100%, fading through amber to red at 0.
function cellStyle(pct: number | null): { bg: string; fg: string } {
  if (pct === null) return { bg: "transparent", fg: "transparent" };
  // Blend green (16,185,129) → amber (244,168,54) → red (239,68,68).
  const t = Math.max(0, Math.min(100, pct)) / 100;
  let r: number, g: number, b: number;
  if (t >= 0.5) {
    const u = (t - 0.5) / 0.5; // amber→green
    r = Math.round(244 + (16 - 244) * u);
    g = Math.round(168 + (185 - 168) * u);
    b = Math.round(54 + (129 - 54) * u);
  } else {
    const u = t / 0.5; // red→amber
    r = Math.round(239 + (244 - 239) * u);
    g = Math.round(68 + (168 - 68) * u);
    b = Math.round(68 + (54 - 68) * u);
  }
  return { bg: `rgba(${r},${g},${b},0.16)`, fg: `rgb(${r},${g},${b})` };
}

export function CohortRetention({ data }: { data: CohortAnalysis }) {
  if (!data.hasData) return null;

  return (
    <section>
      <h2 className="mb-3 font-display text-base font-bold text-brand-ink">
        Cohort retention
      </h2>
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminKpiCard
          label="Net revenue retention"
          value={data.nrr !== null ? `${data.nrr}%` : "—"}
          sub="retained MRR ÷ starting MRR"
        />
        <AdminKpiCard
          label="Logo retention"
          value={data.logoRetention !== null ? `${data.logoRetention}%` : "—"}
          sub="active ÷ started (≥1mo)"
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-brand-line bg-white p-5 shadow-card lg:p-6">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-brand-mute">
          % of each start-month cohort still subscribed, by months since signup
        </div>
        <table className="w-full min-w-[520px] border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold text-brand-mute">
                Cohort
              </th>
              <th className="px-2 py-1.5 font-semibold text-brand-mute">
                Subs
              </th>
              {data.offsets.map((n) => (
                <th
                  key={n}
                  className="px-2 py-1.5 font-semibold text-brand-mute"
                >
                  M{n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.label} className="border-t border-brand-line">
                <td className="px-2 py-1.5 text-left font-medium text-brand-ink">
                  {row.label}
                </td>
                <td className="px-2 py-1.5 text-brand-mute">{row.size}</td>
                {row.retention.map((pct, i) => {
                  const { bg, fg } = cellStyle(pct);
                  return (
                    <td key={i} className="px-1 py-1">
                      {pct === null ? (
                        <span className="text-brand-line">·</span>
                      ) : (
                        <span
                          className="inline-block w-full rounded px-1.5 py-1 font-semibold"
                          style={{ backgroundColor: bg, color: fg }}
                        >
                          {pct}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
