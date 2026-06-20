"use client";

import { ChevronDown, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

/**
 * Small reset button that appears next to controls when the value differs from
 * the theme default. Click to restore the default value.
 */
export function ResetButton({
  isOverridden,
  onReset,
  tooltip = "Restore default",
}: {
  isOverridden: boolean;
  onReset: () => void;
  tooltip?: string;
}) {
  if (!isOverridden) return null;
  return (
    <button
      type="button"
      onClick={onReset}
      title={tooltip}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-mute transition hover:bg-brand-light hover:text-brand-primary"
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
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
 * Simplified colour picker: single swatch showing the current value (or the
 * inherited default if auto). Click to open a popover with preset swatches,
 * a colour picker, and hex input. An "Auto" button resets to inherit.
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
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState("");

  const shown = (value || inheritedHex || "#10B981").toUpperCase();
  const isOverridden = Boolean(value);

  const handleSelect = useCallback(
    (hex: string) => {
      onChange(hex.toUpperCase());
      setOpen(false);
    },
    [onChange],
  );

  const handleHexSubmit = useCallback(() => {
    const cleaned = hexInput.trim().toUpperCase();
    if (/^#?[0-9A-F]{6}$/.test(cleaned)) {
      const hex = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
      onChange(hex);
      setHexInput("");
      setOpen(false);
    }
  }, [hexInput, onChange]);

  const handleAuto = useCallback(() => {
    onChange("");
    setOpen(false);
  }, [onChange]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white transition hover:scale-105 ${
              isOverridden
                ? "ring-2 ring-brand-ink"
                : "ring-[1.5px] ring-brand-line"
            }`}
            style={{ background: shown }}
            aria-label={`Current: ${shown}`}
          />
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-3" align="start">
          {/* Preset swatches (4x2 grid) */}
          <div className="grid grid-cols-4 gap-2">
            {swatches.map((c) => {
              const on = value.toUpperCase() === c.toUpperCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelect(c)}
                  aria-label={c}
                  className={`h-8 w-8 rounded-full border-2 border-white transition hover:scale-110 ${
                    on
                      ? "ring-2 ring-brand-ink"
                      : "ring-[1.5px] ring-brand-line"
                  }`}
                  style={{ background: c }}
                />
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-3 border-t border-brand-line" />

          {/* Color picker + hex input row */}
          <div className="flex items-center gap-2">
            <label
              className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-white ring-[1.5px] ring-brand-line"
              style={{
                background:
                  "conic-gradient(from 0deg,#ff5f6d,#ffc371,#47e891,#2a9df4,#7c5cfc,#ff5f6d)",
              }}
            >
              <Plus className="h-4 w-4 drop-shadow" />
              <input
                type="color"
                value={shown}
                onChange={(e) => handleSelect(e.target.value)}
                className="absolute h-0 w-0 opacity-0"
              />
            </label>
            <input
              type="text"
              placeholder="#FFFFFF"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleHexSubmit()}
              className="h-8 flex-1 rounded-md border border-brand-line px-2 font-mono text-xs uppercase outline-none focus:border-brand-primary"
            />
          </div>

          {/* Auto button */}
          <button
            type="button"
            onClick={handleAuto}
            className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              isOverridden
                ? "bg-brand-light text-brand-primary hover:bg-brand-primary/20"
                : "cursor-default bg-brand-primary/10 text-brand-primary"
            }`}
          >
            <RotateCcw className="h-3 w-3" />
            {isOverridden ? "Reset to theme default" : "Using theme default"}
          </button>
        </PopoverContent>
      </Popover>

      {/* Value pill showing current color */}
      <span className="inline-flex h-8 items-center gap-2 rounded-full border-[1.5px] border-brand-line px-3 font-mono text-[11.5px] text-brand-ink">
        <span
          className="h-3 w-3 rounded-full ring-1 ring-black/10"
          style={{ background: shown }}
        />
        {isOverridden ? shown : "Auto"}
      </span>

      {/* Reset button (visible when overridden) */}
      <ResetButton isOverridden={isOverridden} onReset={() => onChange("")} />
    </div>
  );
}

// ── Composite Controls ─────────────────────────────────────
// Higher-level components that combine label + reset + control for cleaner sections.

/**
 * Slider with integrated label and reset button. Shows value inline with the label.
 */
export function SliderControl({
  label,
  hint,
  value,
  defaultValue,
  min,
  max,
  step = 1,
  suffix = "",
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const isOverridden = value !== defaultValue;
  const displayValue = format ? format(value) : String(value);

  return (
    <Ctl>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute">
          {label}
          {hint ? (
            <span className="ml-2 font-medium normal-case tracking-normal text-brand-mute/70">
              {hint}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11.5px] font-semibold text-brand-secondary">
            {displayValue}
            {suffix}
          </span>
          <ResetButton
            isOverridden={isOverridden}
            onReset={() => onChange(defaultValue)}
          />
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-[5px] w-full cursor-pointer appearance-none rounded-full bg-brand-line ${SLIDER_THUMB}`}
      />
    </Ctl>
  );
}

/**
 * Segmented control with integrated label and reset button.
 */
export function SegControl<T extends string>({
  label,
  value,
  defaultValue,
  options,
  onChange,
}: {
  label: string;
  value: T;
  defaultValue: T;
  options: Array<{ value: T; label: string; diagram?: ReactNode }>;
  onChange: (v: T) => void;
}) {
  const isOverridden = value !== defaultValue;

  return (
    <Ctl>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute">
          {label}
        </span>
        <ResetButton
          isOverridden={isOverridden}
          onReset={() => onChange(defaultValue)}
        />
      </div>
      <Seg value={value} options={options} onChange={onChange} />
    </Ctl>
  );
}

/**
 * Color picker with integrated label. Reset is built into SwatchRow.
 */
export function ColorControl({
  label,
  value,
  inheritedHex,
  onChange,
  swatches,
}: {
  label: string;
  value: string;
  inheritedHex: string;
  onChange: (hex: string) => void;
  swatches?: string[];
}) {
  return (
    <Ctl>
      <CtlLabel>{label}</CtlLabel>
      <SwatchRow
        value={value}
        inheritedHex={inheritedHex}
        onChange={onChange}
        swatches={swatches}
      />
    </Ctl>
  );
}

/**
 * Collapsible sub-group within a section. Used to organize dense sections like Typography.
 */
export function SubGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-5 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-brand-light/50"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-brand-mute transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute">
          {title}
        </span>
      </button>
      {open ? <div className="mt-2 space-y-0">{children}</div> : null}
    </div>
  );
}

/**
 * Styled preview container with theme CSS variables applied.
 * Used to show live previews of buttons, images, cards, typography.
 */
export function PreviewBox({
  vars,
  children,
  className = "",
}: {
  vars: React.CSSProperties;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      style={vars}
      className={`mb-4 flex items-center justify-center rounded-xl border border-brand-line/50 bg-brand-light/30 p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/** Horizontal divider for separating control groups within a section. */
export function Divider() {
  return <div className="my-4 border-t border-brand-line/50" />;
}
