"use client";

import { useEffect, useRef, useState } from "react";

import {
  type CalBooking,
  type CalListing,
  type CalOrigin,
  type CalStatus,
  fmtShort,
  MONTH_NAMES,
  nightsBetween,
  ORIGIN_META,
  STATUS_META,
  vmoney,
} from "./calendar-data";

// ── Icon ───────────────────────────────────────────────────────────
const PATHS: Record<string, string> = {
  x: "M18 6L6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  chevD: "M6 9l6 6 6-6",
  chevR: "M9 6l6 6-6 6",
  chevL: "M15 6l-6 6 6 6",
  arrowR: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  user: "M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  pin: "M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  ban: "M5.6 5.6l12.8 12.8M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  pencil: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  sliders:
    "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  check: "M20 6L9 17l-5-5",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
  cash: "M2 6h20v12H2zM2 10h20M6 14h4",
  layout: "M3 3h18v18H3zM3 9h18M9 21V9",
  cols: "M3 3h18v18H3zM9 3v18M15 3v18",
  filter: "M3 4h18l-7 8v6l-4 2v-8z",
  funnel: "M3 4h18l-7 8v6l-4 2v-8z",
};
export function Icon({
  k,
  d,
  size = 16,
  cls = "",
  sw = 1.7,
}: {
  k?: string;
  d?: string;
  size?: number;
  cls?: string;
  sw?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-hidden
    >
      <path d={d ?? PATHS[k ?? ""] ?? ""} />
    </svg>
  );
}

export function Avatar({
  src,
  name,
  size = 32,
  ring,
}: {
  src: string | null;
  name: string;
  size?: number;
  ring?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full"
      style={{
        height: size,
        width: size,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center bg-brand-gradient font-bold text-white"
          style={{ fontSize: size * 0.36 }}
        >
          {initials || "·"}
        </span>
      )}
    </span>
  );
}

export function StatusDot({
  status,
  size = 7,
}: {
  status: CalStatus;
  size?: number;
}) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        height: size,
        width: size,
        background: STATUS_META[status].color,
      }}
    />
  );
}

export function OriginMark({
  origin,
  size = 12,
}: {
  origin: CalOrigin;
  size?: number;
}) {
  const o = ORIGIN_META[origin];
  return (
    <span
      className="inline-flex items-center justify-center rounded-[3px] font-extrabold text-white"
      style={{
        height: size,
        width: size,
        fontSize: size * 0.62,
        background: o.color,
      }}
    >
      {o.mark}
    </span>
  );
}

// ── Dropdown shell ─────────────────────────────────────────────────
function Menu({
  button,
  children,
  align = "right",
  width = 248,
}: {
  button: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {button(open)}
      </button>
      {open ? (
        <div
          className="absolute z-40 mt-1.5 overflow-hidden rounded-card border border-brand-line bg-white p-1.5 shadow-peek"
          style={{ width, [align]: 0 }}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

// ── View toggle (Month / Timeline) ─────────────────────────────────
export function ViewToggle({
  value,
  onChange,
}: {
  value: "month" | "timeline";
  onChange: (v: "month" | "timeline") => void;
}) {
  return (
    <div className="inline-flex rounded-[10px] border border-brand-line bg-white p-0.5">
      {(["month", "timeline"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={
            "rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold capitalize transition-colors " +
            (value === v
              ? "bg-brand-secondary text-white"
              : "text-brand-mute hover:text-brand-ink")
          }
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ── Layout toggle (A / B) ──────────────────────────────────────────
export function LayoutToggle({
  value,
  onChange,
}: {
  value: "A" | "B";
  onChange: (v: "A" | "B") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-[10px] border border-brand-line bg-white p-0.5">
      {(["A", "B"] as const).map((v) => (
        <button
          key={v}
          type="button"
          title={v === "A" ? "Console layout" : "KPI-first layout"}
          onClick={() => onChange(v)}
          className={
            "inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors " +
            (value === v
              ? "bg-brand-accent text-brand-secondary"
              : "text-brand-mute hover:text-brand-ink")
          }
        >
          <Icon k={v === "A" ? "layout" : "cols"} size={14} />
          {v === "A" ? "Console" : "KPIs"}
        </button>
      ))}
    </div>
  );
}

export function MonthNav({
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onPrev}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-brand-line bg-white text-brand-mute hover:bg-brand-accent/40 hover:text-brand-ink"
      >
        <Icon k="chevL" size={16} />
      </button>
      <div className="num min-w-[140px] px-1 text-center font-display text-[15px] font-bold text-brand-ink">
        {MONTH_NAMES[month]} {year}
      </div>
      <button
        type="button"
        onClick={onNext}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-brand-line bg-white text-brand-mute hover:bg-brand-accent/40 hover:text-brand-ink"
      >
        <Icon k="chevR" size={16} />
      </button>
      <button
        type="button"
        onClick={onToday}
        className="ml-1 h-9 rounded-[10px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-accent/40"
      >
        Today
      </button>
    </div>
  );
}

export function ListingSwitcher({
  listings,
  value,
  onChange,
}: {
  listings: CalListing[];
  value: string;
  onChange: (id: string) => void;
}) {
  const current = listings.find((l) => l.id === value);
  return (
    <Menu
      width={272}
      button={() => (
        <span className="flex h-9 items-center gap-2 rounded-[10px] border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-accent/40">
          {current ? (
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: current.tone }}
            />
          ) : (
            <Icon k="layout" size={14} cls="text-brand-mute" />
          )}
          <span className="max-w-[180px] truncate">
            {current ? current.name : "All listings"}
          </span>
          <Icon k="chevD" size={14} cls="text-brand-mute" />
        </span>
      )}
    >
      {(close) => (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onChange("all");
              close();
            }}
            className={
              "flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left hover:bg-brand-light " +
              (value === "all" ? "bg-brand-light" : "")
            }
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-brand-accent text-brand-secondary">
              <Icon k="cols" size={15} />
            </span>
            <span className="text-[12.5px] font-semibold text-brand-ink">
              All listings
            </span>
          </button>
          {listings.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                onChange(l.id);
                close();
              }}
              className={
                "flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left hover:bg-brand-light " +
                (value === l.id ? "bg-brand-light" : "")
              }
            >
              <span className="h-8 w-8 shrink-0 overflow-hidden rounded-[8px] bg-brand-accent">
                {l.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.photo}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12.5px] font-semibold text-brand-ink">
                  {l.name}
                </span>
                <span className="block truncate text-[10.5px] text-brand-mute">
                  {l.location || `${l.rooms} room${l.rooms === 1 ? "" : "s"}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Menu>
  );
}

function CheckRow({
  on,
  onToggle,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[12.5px] hover:bg-brand-light"
    >
      <span
        className={
          "flex h-4 w-4 items-center justify-center rounded-[5px] border " +
          (on
            ? "border-brand-primary bg-brand-primary text-white"
            : "border-brand-line bg-white text-transparent")
        }
      >
        <Icon k="check" size={11} sw={3} />
      </span>
      <span className="flex flex-1 items-center gap-2 text-brand-ink">
        {children}
      </span>
    </button>
  );
}

export function FilterMenu({
  statusSet,
  originSet,
  onToggleStatus,
  onToggleOrigin,
  onClear,
}: {
  statusSet: Set<string>;
  originSet: Set<string>;
  onToggleStatus: (k: string) => void;
  onToggleOrigin: (k: string) => void;
  onClear: () => void;
}) {
  const statuses: CalStatus[] = [
    "confirmed",
    "pending",
    "inhouse",
    "completed",
    "cancelled",
  ];
  const origins: CalOrigin[] = ["direct", "manual", "quote"];
  const active =
    statuses.length - statusSet.size + (origins.length - originSet.size);
  return (
    <Menu
      width={236}
      button={() => (
        <span className="relative flex h-9 items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-accent/40">
          <Icon k="funnel" size={14} cls="text-brand-mute" />
          Filter
          {active > 0 ? (
            <span className="num rounded-pill bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
              {active}
            </span>
          ) : null}
        </span>
      )}
    >
      {() => (
        <div>
          <div className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-mute">
            Status
          </div>
          {statuses.map((k) => (
            <CheckRow
              key={k}
              on={statusSet.has(k)}
              onToggle={() => onToggleStatus(k)}
            >
              <StatusDot status={k} />
              {STATUS_META[k].label}
            </CheckRow>
          ))}
          <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-brand-mute">
            Origin
          </div>
          {origins.map((k) => (
            <CheckRow
              key={k}
              on={originSet.has(k)}
              onToggle={() => onToggleOrigin(k)}
            >
              <OriginMark origin={k} />
              {ORIGIN_META[k].label}
            </CheckRow>
          ))}
          <div className="mt-1 border-t border-brand-line pt-1.5">
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-[8px] px-2 py-1.5 text-left text-[12px] font-semibold text-brand-primary hover:bg-brand-light"
            >
              Reset filters
            </button>
          </div>
        </div>
      )}
    </Menu>
  );
}

const FIELD_LABELS: { k: string; label: string }[] = [
  { k: "avatar", label: "Guest avatar" },
  { k: "name", label: "Guest name" },
  { k: "status", label: "Status colour" },
  { k: "channel", label: "Origin mark" },
  { k: "price", label: "Nightly price" },
  { k: "rate", label: "Booking rate" },
  { k: "times", label: "Check-in time" },
  { k: "guests", label: "Guest count" },
];
export function FieldMenu({
  fields,
  onToggle,
}: {
  fields: Set<string>;
  onToggle: (k: string) => void;
}) {
  return (
    <Menu
      width={210}
      button={() => (
        <span className="flex h-9 items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-accent/40">
          <Icon k="sliders" size={14} cls="text-brand-mute" />
          Fields
        </span>
      )}
    >
      {() => (
        <div>
          {FIELD_LABELS.map((f) => (
            <CheckRow
              key={f.k}
              on={fields.has(f.k)}
              onToggle={() => onToggle(f.k)}
            >
              {f.label}
            </CheckRow>
          ))}
        </div>
      )}
    </Menu>
  );
}

export function LegendBar() {
  const items: { label: string; color: string }[] = [
    { label: "Confirmed", color: STATUS_META.confirmed.color },
    { label: "Pending", color: STATUS_META.pending.color },
    { label: "In-house", color: STATUS_META.inhouse.color },
    { label: "Completed", color: STATUS_META.completed.color },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((i) => (
        <span
          key={i.label}
          className="inline-flex items-center gap-1.5 text-[11px] text-brand-mute"
        >
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: i.color }}
          />
          {i.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-[11px] text-brand-mute">
        <span
          className="h-2.5 w-3 rounded-[3px]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg,rgba(148,163,148,0.5) 0 3px,transparent 3px 6px)",
          }}
        />
        Blocked
      </span>
    </div>
  );
}

// ── Occupancy ring ─────────────────────────────────────────────────
export function OccupancyRing({
  pct,
  size = 120,
}: {
  pct: number;
  size?: number;
}) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#DCEAE0"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#10B981"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        className="num fill-brand-ink font-display"
        style={{ fontSize: size * 0.26, fontWeight: 700 }}
      >
        {pct}%
      </text>
      <text
        x="50%"
        y="64%"
        textAnchor="middle"
        className="fill-brand-mute"
        style={{ fontSize: size * 0.1, fontWeight: 700, letterSpacing: 1 }}
      >
        OCCUPIED
      </text>
    </svg>
  );
}

export function OriginMix({
  data,
}: {
  data: { k: CalOrigin; value: number }[];
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-pill bg-brand-light">
        {data.map((d) => (
          <span
            key={d.k}
            style={{
              width: `${(d.value / total) * 100}%`,
              background: ORIGIN_META[d.k].color,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {data.map((d) => (
          <span
            key={d.k}
            className="inline-flex items-center gap-1.5 text-[11px] text-brand-mute"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: ORIGIN_META[d.k].color }}
            />
            {ORIGIN_META[d.k].label}
            <span className="num font-semibold text-brand-ink">{d.value}</span>
          </span>
        ))}
        {data.length === 0 ? (
          <span className="text-[11px] text-brand-mute">No nights booked.</span>
        ) : null}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[12px] border border-brand-line bg-white px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-[18px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      {sub ? (
        <div className="num mt-1 text-[10.5px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  sub,
  trend,
  dark,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: string;
  dark?: boolean;
  icon?: string;
}) {
  if (dark) {
    return (
      <div className="relative overflow-hidden rounded-card bg-brand-gradient-dark p-4 text-white shadow-card">
        <div className="dotgrid absolute inset-0 opacity-25" aria-hidden />
        <div
          aria-hidden
          className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-primary/30 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent/80">
              {label}
            </span>
            {trend ? (
              <span className="num rounded-pill bg-brand-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-brand-primary">
                {trend}
              </span>
            ) : null}
          </div>
          <div className="num mt-2 font-display text-[26px] font-bold leading-none">
            {value}
          </div>
          {sub ? (
            <div className="num mt-1 text-[11px] text-brand-accent/70">
              {sub}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-mute">
          {label}
        </span>
        {icon ? <Icon k={icon} size={15} cls="text-brand-mute" /> : null}
      </div>
      <div className="num mt-2 font-display text-[26px] font-bold leading-none text-brand-ink">
        {value}
      </div>
      {sub ? (
        <div className="num mt-1 text-[11px] text-brand-mute">{sub}</div>
      ) : null}
    </div>
  );
}

function ActivityRow({ b, kind }: { b: CalBooking; kind: "in" | "out" }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 hover:bg-brand-light">
      <Avatar src={b.avatar} name={b.guest} size={28} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-semibold text-brand-ink">
          {b.guest}
        </div>
        <div className="text-[10.5px] text-brand-mute">
          {kind === "in"
            ? `Checking in · ${b.ciTime ?? ""}`
            : `Checking out · ${b.coTime ?? ""}`}
        </div>
      </div>
      <span
        className="num rounded-pill px-1.5 py-0.5 text-[10px] font-bold"
        style={{
          background: kind === "in" ? "#D1FAE5" : "#FEF3C7",
          color: kind === "in" ? "#047857" : "#B45309",
        }}
      >
        {kind === "in" ? "Arrival" : "Departure"}
      </span>
    </div>
  );
}

export function TodayBoard({
  today,
  arrivals,
  departures,
}: {
  today: string;
  arrivals: CalBooking[];
  departures: CalBooking[];
}) {
  const total = arrivals.length + departures.length;
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="whitespace-nowrap font-display text-[13.5px] font-bold text-brand-ink">
          Today · {fmtShort(today)}
        </span>
        <span className="num shrink-0 rounded-pill bg-brand-accent px-2 py-0.5 text-[10.5px] font-bold text-brand-secondary">
          {total} move{total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] bg-brand-light p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            <Icon k="arrowR" size={12} />
            Arrivals
          </div>
          <div className="num mt-1 font-display text-[22px] font-bold leading-none text-brand-ink">
            {arrivals.length}
          </div>
        </div>
        <div className="rounded-[10px] bg-brand-light p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <Icon k="arrowR" size={12} cls="rotate-180" />
            Departures
          </div>
          <div className="num mt-1 font-display text-[22px] font-bold leading-none text-brand-ink">
            {departures.length}
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        {arrivals.map((b) => (
          <ActivityRow key={"in" + b.id} b={b} kind="in" />
        ))}
        {departures.map((b) => (
          <ActivityRow key={"out" + b.id} b={b} kind="out" />
        ))}
        {total === 0 ? (
          <div className="py-3 text-center text-[12px] text-brand-mute">
            No arrivals or departures today.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function UpcomingList({
  upcoming,
  listings,
  today,
}: {
  upcoming: CalBooking[];
  listings: CalListing[];
  today: string;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-[13.5px] font-bold text-brand-ink">
          Upcoming check-ins
        </span>
        <a
          href="/dashboard/bookings"
          className="text-[11px] font-semibold text-brand-primary hover:underline"
        >
          All
        </a>
      </div>
      <div className="space-y-0.5">
        {upcoming.slice(0, 5).map((b) => {
          const l = listings.find((x) => x.id === b.listingId);
          return (
            <a
              key={b.id}
              href={`/dashboard/bookings/${b.id}`}
              className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 hover:bg-brand-light"
            >
              <Avatar src={b.avatar} name={b.guest} size={30} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[12.5px] font-semibold text-brand-ink">
                  {b.guest}
                </div>
                <div className="flex items-center gap-1.5 truncate text-[10.5px] text-brand-mute">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: l?.tone ?? "#94A3B8" }}
                  />
                  {l?.name ?? "Listing"}
                </div>
              </div>
              <div className="text-right leading-tight">
                <div className="num text-[11px] font-bold text-brand-ink">
                  {fmtShort(b.ci)}
                </div>
                <div className="num text-[10px] text-brand-mute">
                  in {nightsBetween(today, b.ci)}d
                </div>
              </div>
            </a>
          );
        })}
        {upcoming.length === 0 ? (
          <div className="py-3 text-center text-[12px] text-brand-mute">
            Nothing in the next 10 days.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { vmoney };
