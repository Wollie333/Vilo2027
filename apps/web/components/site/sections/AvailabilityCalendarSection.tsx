"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { BookingFunnelData } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<
  WebsiteSection,
  { type: "availability_calendar" }
>["props"];

const fieldStyle: CSSProperties = {
  background: "var(--site-bg)",
  borderColor: "var(--site-line)",
  color: "var(--site-ink)",
  borderRadius: "var(--site-radius)",
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) =>
  `${y}-${pad(m + 1)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Mon=0..Sun=6 weekday of the 1st of the month. */
const firstWeekday = (y: number, m: number) =>
  (new Date(y, m, 1).getDay() + 6) % 7;

/**
 * Availability calendar (Phase 6B). Reads the property's LIVE blocked dates from
 * /api/website-availability and greys out unavailable days; clicking an open day
 * deep-links into the real checkout with the date pre-filled. In the builder
 * preview (`interactive=false`) it renders the grid but does not fetch.
 */
export function AvailabilityCalendarSection({
  props,
  data,
  interactive = false,
}: {
  props: Props;
  data?: BookingFunnelData;
  interactive?: boolean;
}) {
  const properties = useMemo(() => data?.properties ?? [], [data]);
  const fixed = props.property_id
    ? properties.find((p) => p.id === props.property_id)
    : undefined;
  const choices = fixed ? [fixed] : properties;

  const [propertyId, setPropertyId] = useState<string>(
    fixed?.id ?? properties[0]?.id ?? "",
  );
  const selected = useMemo(
    () => properties.find((p) => p.id === propertyId),
    [properties, propertyId],
  );

  const months = Math.min(2, Math.max(1, props.months ?? 1));
  const today = useMemo(() => new Date(), []);
  const [anchor, setAnchor] = useState({
    y: today.getFullYear(),
    m: today.getMonth(),
  });
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const websiteId = data?.websiteId;
  const live = interactive && Boolean(websiteId) && properties.length > 0;

  // The visible window (first day of first month → last day of last month).
  const window = useMemo(() => {
    const start = isoOf(anchor.y, anchor.m, 1);
    const endDate = new Date(anchor.y, anchor.m + (months - 1), 1);
    const ey = endDate.getFullYear();
    const em = endDate.getMonth();
    return { start, end: isoOf(ey, em, lastDay(ey, em)) };
  }, [anchor, months]);

  useEffect(() => {
    if (!live || !selected) return;
    let active = true;
    setLoading(true);
    fetch("/api/website-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        website_id: websiteId,
        property_id: selected.id,
        start: window.start,
        end: window.end,
      }),
    })
      .then((r) => r.json())
      .then((json: { ok: boolean; unavailable?: string[] }) => {
        if (!active) return;
        setUnavailable(new Set(json.ok ? (json.unavailable ?? []) : []));
      })
      .catch(() => active && setUnavailable(new Set()))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [live, websiteId, selected, window.start, window.end]);

  const todayIso = isoOf(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const atFloor =
    anchor.y === today.getFullYear() && anchor.m === today.getMonth();

  if (properties.length === 0) {
    if (!interactive) return null;
    return (
      <SectionShell surface width="narrow">
        <div
          style={{
            borderColor: "var(--site-line)",
            borderRadius: "var(--site-radius)",
          }}
          className="border border-dashed p-8 text-center"
        >
          <Muted>Add a property to show its live availability here.</Muted>
        </div>
      </SectionShell>
    );
  }

  function shift(delta: number) {
    setAnchor((a) => {
      const d = new Date(a.y, a.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const visibleMonths = Array.from({ length: months }, (_, i) => {
    const d = new Date(anchor.y, anchor.m + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <SectionShell surface width={months > 1 ? "wide" : "narrow"}>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {props.body ? (
        <Muted className="mb-6 text-center text-base">{props.body}</Muted>
      ) : null}

      {choices.length > 1 ? (
        <div className="mx-auto mb-5 max-w-xs">
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            style={fieldStyle}
            className="w-full border px-3 py-2.5 text-sm outline-none"
          >
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <Card className="mx-auto max-w-3xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <CalNav label="‹" onClick={() => shift(-1)} disabled={atFloor} />
          <span
            style={{ color: "var(--site-ink)" }}
            className="text-sm font-semibold"
          >
            {loading ? "Loading…" : " "}
          </span>
          <CalNav label="›" onClick={() => shift(1)} disabled={false} />
        </div>

        <div className={`grid gap-6 ${months > 1 ? "md:grid-cols-2" : ""}`}>
          {visibleMonths.map((vm) => (
            <MonthGrid
              key={`${vm.y}-${vm.m}`}
              y={vm.y}
              m={vm.m}
              unavailable={unavailable}
              todayIso={todayIso}
              bookBase={selected?.bookBase}
              live={live}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-5 text-xs">
          <Legend swatch="var(--site-surface)" label="Available" border />
          <Legend swatch="var(--site-line)" label="Unavailable" />
        </div>
      </Card>

      {!interactive ? (
        <p
          style={{ color: "var(--site-mute)" }}
          className="mt-3 text-center text-xs"
        >
          Live availability shows on your published site.
        </p>
      ) : null}
    </SectionShell>
  );
}

function MonthGrid({
  y,
  m,
  unavailable,
  todayIso,
  bookBase,
  live,
}: {
  y: number;
  m: number;
  unavailable: Set<string>;
  todayIso: string;
  bookBase?: string;
  live: boolean;
}) {
  const days = lastDay(y, m);
  const lead = firstWeekday(y, m);
  const cells: Array<number | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  return (
    <div>
      <p
        style={{ color: "var(--site-ink)" }}
        className="mb-2 text-center text-sm font-semibold"
      >
        {MONTHS[m]} {y}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            style={{ color: "var(--site-mute)" }}
            className="py-1 text-center text-[10px] font-semibold uppercase"
          >
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <span key={`e${i}`} />;
          const iso = isoOf(y, m, day);
          const past = iso < todayIso;
          const blocked = unavailable.has(iso);
          const open = !past && !blocked;
          const href =
            open && live && bookBase ? `${bookBase}&from=${iso}` : undefined;
          return (
            <DayCell key={iso} day={day} open={open} past={past} href={href} />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  day,
  open,
  past,
  href,
}: {
  day: number;
  open: boolean;
  past: boolean;
  href?: string;
}) {
  const base =
    "flex aspect-square items-center justify-center rounded-[var(--site-radius)] text-[13px]";
  if (href) {
    return (
      <a
        href={href}
        data-wielo-book
        title="Available"
        style={{
          background: "var(--site-surface)",
          border: "1px solid var(--site-line)",
          color: "var(--site-ink)",
        }}
        className={`${base} font-medium transition-opacity hover:opacity-80`}
      >
        {day}
      </a>
    );
  }
  return (
    <span
      title={past ? undefined : open ? "Available" : "Unavailable"}
      style={{
        background: open ? "var(--site-surface)" : "transparent",
        border: open ? "1px solid var(--site-line)" : "none",
        color: open ? "var(--site-ink)" : "var(--site-mute)",
        textDecoration: !open && !past ? "line-through" : undefined,
        opacity: past ? 0.4 : 1,
      }}
      className={base}
    >
      {day}
    </span>
  );
}

function CalNav({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label === "‹" ? "Previous month" : "Next month"}
      style={{ borderColor: "var(--site-line)", color: "var(--site-ink)" }}
      className="flex h-8 w-8 items-center justify-center rounded-[var(--site-radius)] border text-lg leading-none transition-opacity hover:opacity-70 disabled:opacity-30"
    >
      {label}
    </button>
  );
}

function Legend({
  swatch,
  label,
  border = false,
}: {
  swatch: string;
  label: string;
  border?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          background: swatch,
          border: border ? "1px solid var(--site-line)" : undefined,
        }}
        className="h-3 w-3 rounded-[3px]"
      />
      <Muted className="text-xs">{label}</Muted>
    </span>
  );
}
