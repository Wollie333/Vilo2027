"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A theme-styled check-in/check-out date-range picker — a custom calendar popover
 * (NOT a native <input type="date">), so it matches the site theme via the colour
 * props the caller derives from `--site-*` tokens. Used by the room booking dock
 * and the booking form's date field so date selection looks bespoke.
 *
 * Hydration-safe: the popover (the only part that reads `new Date()`) renders only
 * after the user opens it on the client, so nothing time-dependent is server-rendered.
 */
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
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

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
const toISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function fromISO(s: string): Date | null {
  const p = s.split("-").map(Number);
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return null;
  return new Date(p[0], p[1] - 1, p[2]);
}
/** "10 Sep" from an ISO date; "" when empty/invalid. */
function pretty(s: string): string {
  const d = fromISO(s);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}` : "";
}

export function ThemedDateRange({
  from,
  to,
  onChange,
  accent,
  ink,
  mute,
  line,
  surface,
  radius = "10px",
  labelIn = "Check-in",
  labelOut = "Check-out",
  bare = false,
  align = "left",
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  accent: string;
  ink: string;
  mute: string;
  line: string;
  surface: string;
  radius?: string;
  labelIn?: string;
  labelOut?: string;
  /** Borderless / transparent trigger that blends into a host cell (e.g. the
   *  availability bar), instead of the default bordered "boxed" button. */
  bare?: boolean;
  /** Which edge the popover anchors to (use "right" near the right edge). */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const b = fromISO(from) ?? new Date();
    return { y: b.getFullYear(), m: b.getMonth() };
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // The popover renders in a PORTAL (document.body) with fixed positioning so it
  // can never be clipped by an ancestor's `overflow:hidden` (e.g. the booking
  // Card) or trapped below a later section's stacking context — the calendar
  // always sits on top and the dates stay selectable.
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const reposition = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 8;
    const vw = window.innerWidth;
    const width = Math.min(300, vw - gap * 2);
    const top = r.bottom + gap;
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(gap, Math.min(left, vw - width - gap));
    setPos({ top, left, width });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    reposition();
    // Follow the trigger while open (capture = catch nested scrollers too).
    const onMove = () => reposition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    // `pointerdown` fires for both mouse and touch, so the calendar dismisses on a
    // tap-outside on mobile. The popover lives in a portal, so exclude it too.
    function onDoc(e: Event) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("pointerdown", onDoc);
    };
  }, [open, reposition]);

  function pick(iso: string) {
    // No start yet, a complete range, or a click before the start → begin anew.
    if (!from || (from && to) || iso < from) onChange(iso, "");
    else {
      onChange(from, iso);
      setOpen(false);
    }
  }
  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  const first = new Date(view.y, view.m, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const todayISO = toISO(new Date());
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(toISO(new Date(view.y, view.m, d)));

  const navBtn = {
    width: 28,
    height: 28,
    border: `1px solid ${line}`,
    borderRadius: 8,
    background: "#fff",
    color: ink,
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  } as const;

  const fieldBox = (label: string, val: string) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".02em",
          textTransform: "uppercase",
          color: mute,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: val ? ink : mute }}>
        {val ? pretty(val) : "Add date"}
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          const opening = !open;
          setOpen(opening);
          // Open on the check-in month so picking the check-out date is right
          // there — the guest never has to hunt for the correct month.
          if (opening && from) {
            const d = fromISO(from);
            if (d) setView({ y: d.getFullYear(), m: d.getMonth() });
          }
        }}
        style={{
          display: "flex",
          gap: 12,
          width: "100%",
          textAlign: "left",
          border: bare ? "none" : `1px solid ${line}`,
          borderRadius: bare ? 0 : radius,
          background: bare ? "transparent" : "#fff",
          padding: bare ? 0 : "10px 12px",
          cursor: "pointer",
        }}
      >
        {fieldBox(labelIn, from)}
        <div style={{ width: 1, background: line, alignSelf: "stretch" }} />
        {fieldBox(labelOut, to)}
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              style={{
                position: "fixed",
                zIndex: 2147483000,
                top: pos.top,
                left: pos.left,
                width: pos.width,
                background: surface,
                border: `1px solid ${line}`,
                borderRadius: radius,
                boxShadow: "0 24px 50px -24px rgba(0,0,0,.35)",
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  style={navBtn}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div style={{ fontSize: 14, fontWeight: 600, color: ink }}>
                  {MONTHS[view.m]} {view.y}
                </div>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  style={navBtn}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7,1fr)",
                  gap: 2,
                  marginBottom: 4,
                }}
              >
                {DOW.map((d) => (
                  <div
                    key={d}
                    style={{
                      textAlign: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      color: mute,
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7,1fr)",
                  gap: 2,
                }}
              >
                {cells.map((iso, i) => {
                  if (!iso) return <div key={`b${i}`} />;
                  const past = iso < todayISO;
                  const sel = iso === from || iso === to;
                  const inRange = Boolean(from && to && iso > from && iso < to);
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={past}
                      onClick={() => pick(iso)}
                      style={{
                        aspectRatio: "1",
                        border: "none",
                        cursor: past ? "default" : "pointer",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: sel ? 700 : 400,
                        background: sel
                          ? accent
                          : inRange
                            ? `color-mix(in srgb, ${accent} 16%, transparent)`
                            : "transparent",
                        color: sel ? "#fff" : past ? mute : ink,
                        opacity: past ? 0.4 : 1,
                      }}
                    >
                      {Number(iso.slice(8))}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
