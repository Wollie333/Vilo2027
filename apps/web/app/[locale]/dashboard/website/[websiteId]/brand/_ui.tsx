"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

// ── Design-language primitives for the Brand Studio control rail ──
// Matches the Brand Studio mockup using the app's brand-* tokens (which already
// resolve to the mockup's emerald palette).

const SLIDER_THUMB =
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_1px_5px_rgba(6,78,59,.35)] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-primary [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer";

export const bsInput =
  "h-11 w-full rounded-[11px] border-[1.5px] border-brand-line bg-white px-3.5 text-sm text-brand-ink outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-brand-mute/60";

export const bsSelect =
  "h-11 w-full cursor-pointer rounded-[11px] border-[1.5px] border-brand-line bg-white px-3 text-sm text-brand-ink outline-none transition focus:border-brand-primary";

/** Collapsible section with icon + title + subtitle, like the mockup accordions. */
export function Acc({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-brand-line/70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-brand-light/40"
      >
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-brand-light text-brand-primary">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[13.5px] font-bold leading-tight text-brand-ink">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[11.5px] text-brand-mute">
              {subtitle}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-[18px] w-[18px] shrink-0 text-brand-mute/60 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? <div className="px-5 pb-5">{children}</div> : null}
    </section>
  );
}

/** One control block (stacked with spacing). */
export function Ctl({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mt-[17px] first:mt-1 ${className}`}>{children}</div>;
}

/** Uppercase control label with an optional right-aligned hint. */
export function CtlLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2.5 flex items-center text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute">
      <span>{children}</span>
      {hint ? (
        <span className="ml-auto text-[11px] font-medium normal-case tracking-normal text-brand-mute/70">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Segmented control — pill cards, optionally with a diagram above the label. */
export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; diagram?: ReactNode }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex min-w-[62px] flex-1 flex-col items-center gap-1.5 rounded-[12px] border-[1.5px] px-1.5 py-2 transition ${
              on
                ? "border-brand-primary bg-brand-light"
                : "border-brand-line bg-white hover:border-brand-primary/40"
            }`}
          >
            {o.diagram ? (
              <span className="flex h-6 w-full items-center justify-center">
                {o.diagram}
              </span>
            ) : null}
            <span
              className={`whitespace-nowrap text-[11.5px] font-semibold ${
                on ? "text-brand-secondary" : "text-brand-mute"
              }`}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Slider with a mono numeric readout (mockup .rng-row). */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  suffix = "",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-[5px] flex-1 cursor-pointer appearance-none rounded-full bg-brand-line ${SLIDER_THUMB}`}
      />
      <span className="min-w-[54px] text-right font-mono text-[12.5px] font-semibold text-brand-secondary">
        {format ? format(value) : value}
        {suffix}
      </span>
    </div>
  );
}

const ACCENT_SWATCHES = [
  "#1F6F54",
  "#10B981",
  "#0E8FB0",
  "#1F6FEB",
  "#C2522E",
  "#7C5CFC",
  "#0A0A0A",
  "#CBA653",
];

/**
 * Swatch row for a single colour value ("" = inherit). `inheritedHex` is shown
 * in the readout pill when nothing is pinned; a custom picker + hex pill follow.
 */
export function SwatchRow({
  value,
  inheritedHex,
  onChange,
  swatches = ACCENT_SWATCHES,
}: {
  value: string;
  inheritedHex: string;
  onChange: (hex: string) => void;
  swatches?: string[];
}) {
  const shown = (value || inheritedHex || "#10B981").toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {swatches.map((c) => {
        const on = value.toUpperCase() === c.toUpperCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={`h-8 w-8 rounded-full border-2 border-white transition hover:scale-110 ${
              on ? "ring-2 ring-brand-ink" : "ring-[1.5px] ring-brand-line"
            }`}
            style={{ background: c }}
          />
        );
      })}
      <label
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white ring-[1.5px] ring-brand-line"
        style={{
          background:
            "conic-gradient(from 0deg,#ff5f6d,#ffc371,#47e891,#2a9df4,#7c5cfc,#ff5f6d)",
        }}
      >
        <Plus className="h-4 w-4 drop-shadow" />
        <input
          type="color"
          value={shown}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute h-0 w-0 opacity-0"
        />
      </label>
      <span className="ml-auto inline-flex h-8 items-center gap-2 rounded-full border-[1.5px] border-brand-line px-3 font-mono text-[11.5px] text-brand-ink">
        <span
          className="h-3 w-3 rounded-full ring-1 ring-black/10"
          style={{ background: shown }}
        />
        {value ? shown : "Auto"}
      </span>
    </div>
  );
}
