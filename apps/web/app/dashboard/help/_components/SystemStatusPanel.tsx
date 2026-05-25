import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { resolveHelpIcon } from "@/lib/help/icon-map";
import {
  type HelpStatusComponentStatus,
  type HelpStatusRow,
  parseSparkValues,
} from "@/lib/help/types";

type Props = {
  components: HelpStatusRow[];
  overall: HelpStatusComponentStatus;
};

const OVERALL_PILL: Record<HelpStatusComponentStatus, string> = {
  normal: "bg-brand-accent text-emerald-800",
  degraded: "bg-amber-100 text-amber-800",
  incident: "bg-red-100 text-red-700",
  maintenance: "bg-blue-100 text-blue-800",
};

const OVERALL_LABEL: Record<HelpStatusComponentStatus, string> = {
  normal: "All normal",
  degraded: "Degraded",
  incident: "Incident",
  maintenance: "Maintenance",
};

const DOT_CLASS: Record<HelpStatusComponentStatus, string> = {
  normal: "bg-emerald-500",
  degraded: "bg-amber-500",
  incident: "bg-red-500",
  maintenance: "bg-blue-500",
};

export function SystemStatusPanel({ components, overall }: Props) {
  return (
    <div
      id="status"
      className="flex scroll-mt-20 flex-col rounded-card border border-brand-line bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            Live
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-brand-ink">
            System status
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${OVERALL_PILL[overall]}`}
        >
          <span
            className={`inline-flex h-1.5 w-1.5 rounded-full ${DOT_CLASS[overall]}`}
          />
          {OVERALL_LABEL[overall]}
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {components.length === 0 ? (
          <li className="rounded border border-dashed border-brand-line px-3 py-4 text-center text-xs text-brand-mute">
            No status components configured.
          </li>
        ) : null}
        {components.map((c) => {
          const Icon = resolveHelpIcon(c.icon);
          const sparkValues = parseSparkValues(c.spark_values);
          return (
            <li key={c.id} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand-light">
                <Icon className="h-4 w-4 text-brand-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-brand-ink">
                  {c.name}
                </div>
                <div
                  className={`font-mono text-[11px] ${
                    c.status === "degraded" || c.status === "incident"
                      ? "text-amber-700"
                      : "text-brand-mute"
                  }`}
                >
                  {c.note ?? `${c.uptime_pct.toFixed(2)}% · 30d`}
                </div>
              </div>
              <Sparkline values={sparkValues} status={c.status} />
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-brand-line pt-4">
        <Link
          href="/status"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-secondary"
        >
          Subscribe to incident updates <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function Sparkline({
  values,
  status,
}: {
  values: number[];
  status: HelpStatusComponentStatus;
}) {
  return (
    <div className="flex h-5 items-end gap-px" aria-hidden>
      {values.slice(0, 7).map((v, i) => {
        const height = Math.max(8, Math.min(100, v));
        const bar =
          status === "incident"
            ? "bg-red-500"
            : status === "degraded" && height < 60
              ? "bg-amber-500"
              : status === "maintenance"
                ? "bg-blue-500"
                : "bg-emerald-500";
        return (
          <span
            key={i}
            className={`w-1 rounded-sm ${bar}`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
