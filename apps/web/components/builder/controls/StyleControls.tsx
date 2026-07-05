"use client";

// ── Unified styling-control library (SSOT) ────────────────────────────────────
//
// One place for every design-styling control used across the website CMS builders
// (page / navigation / header / footer / element inspectors). Every builder styles
// its controls from THESE components so look + behaviour stay uniform, and so a fix
// (e.g. the colour popover z-index) lands everywhere at once. See Business
// Principle #8 (WYSIWYG styling) and the review page at `/[locale]/style-lab`.
//
// Self-contained: classes are `.uc-*` and colours come from `var(--token, fallback)`
// so the controls inherit the builder chrome tokens inside `.wb` and still look
// right standalone.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  composeColor,
  displayColor,
  parseColor,
  type ParsedColor,
} from "./colorUtils";
import "./controls.css";

// The active theme's palette circles (Business Principle #6). Provided by the host
// builder; the standalone review page passes a sample set.
const SwatchesContext = createContext<string[]>([]);
export function StyleControlsProvider({
  swatches,
  children,
}: {
  swatches: string[];
  children: ReactNode;
}) {
  return (
    <SwatchesContext.Provider value={swatches}>
      {children}
    </SwatchesContext.Provider>
  );
}

// ── Layout primitives ─────────────────────────────────────────────────────────

/** A titled group of controls (an inspector section). */
export function ControlGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="uc-group">
      {title ? <div className="uc-group-title">{title}</div> : null}
      <div className="uc-group-body">{children}</div>
    </section>
  );
}

/** Label (+ optional hint) above a control. `inline` puts the control on the right. */
export function ControlRow({
  label,
  hint,
  inline,
  htmlFor,
  children,
}: {
  label?: string;
  hint?: string;
  inline?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={inline ? "uc-row uc-row-inline" : "uc-row"}>
      {label ? (
        <label className="uc-label" htmlFor={htmlFor}>
          {label}
          {hint ? <span className="uc-hint">{hint}</span> : null}
        </label>
      ) : null}
      <div className="uc-field">{children}</div>
    </div>
  );
}

// ── Colour control ────────────────────────────────────────────────────────────

const CHECKER =
  "linear-gradient(45deg,#c7cdd4 25%,transparent 25%,transparent 75%,#c7cdd4 75%,#c7cdd4)," +
  "linear-gradient(45deg,#c7cdd4 25%,#fff 25%,#fff 75%,#c7cdd4 75%,#c7cdd4)";
const CHECKER_POS = "0 0,5px 5px";

/**
 * Canva-style colour control: a circular swatch trigger opens a popover with the
 * theme circles, a TRANSPARENT circle (a theme colour for every theme) and a
 * custom picker, plus an OPACITY slider and a hex/value field. The popover is
 * PORTALED to <body> at a high z-index so it never sits behind cards or the canvas.
 */
export function ColorControl({
  value,
  fallback,
  swatches,
  onChange,
  onReset,
  allowOpacity = true,
  allowTransparent = true,
}: {
  value: string | undefined;
  fallback: string;
  /** Theme circles; falls back to the provider's swatches. */
  swatches?: string[];
  onChange: (v: string) => void;
  onReset?: () => void;
  allowOpacity?: boolean;
  allowTransparent?: boolean;
}) {
  const ctxSwatches = useContext(SwatchesContext);
  const themeCircles = swatches ?? ctxSwatches;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const parsed: ParsedColor = parseColor(value, fallback);
  const swatchBg = displayColor(parsed, fallback);
  const hexForPicker = parsed.hex ?? "#10b981";
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  // Position the portaled popover above the trigger (flips below if no room).
  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const W = 224;
    const estH = 250;
    const above = r.top > estH + 12;
    setPos({
      left: Math.max(8, Math.min(window.innerWidth - W - 8, r.left)),
      top: above ? r.top - estH - 8 : r.bottom + 8,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      const tgt = e.target as Node;
      if (popRef.current?.contains(tgt) || triggerRef.current?.contains(tgt))
        return;
      setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  const setHex = (hex: string) =>
    onChange(composeColor(hex, allowOpacity ? parsed.alpha : 100));
  const setAlpha = (a: number) => {
    if (parsed.transparent) onChange(composeColor(hexForPicker, a));
    else if (parsed.hex) onChange(composeColor(parsed.hex, a));
  };

  return (
    <div className="uc-color">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Choose colour"
        className="uc-color-trigger"
        onClick={() => setOpen((o) => !o)}
        style={
          parsed.transparent
            ? { background: CHECKER, backgroundPosition: CHECKER_POS }
            : { background: swatchBg }
        }
      />
      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="uc-pop"
              style={{ left: pos.left, top: pos.top }}
            >
              <p className="uc-pop-label">Theme colours</p>
              <div className="uc-swatches">
                {themeCircles.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className={
                      !parsed.transparent && parsed.hex && eq(parsed.hex, c)
                        ? "uc-chip on"
                        : "uc-chip"
                    }
                    style={{ background: c }}
                    onClick={() => setHex(c)}
                  />
                ))}
                {allowTransparent ? (
                  <button
                    type="button"
                    title="Transparent"
                    className={parsed.transparent ? "uc-chip on" : "uc-chip"}
                    style={{
                      background: CHECKER,
                      backgroundSize: "10px 10px",
                      backgroundPosition: CHECKER_POS,
                    }}
                    onClick={() => onChange("transparent")}
                  />
                ) : null}
                <label
                  title="Custom colour"
                  className={parsed.raw || parsed.hex ? "uc-chip" : "uc-chip"}
                  style={{
                    background:
                      "conic-gradient(from 0deg,#f43f5e,#f59e0b,#22c55e,#3b82f6,#a855f7,#f43f5e)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <input
                    type="color"
                    value={hexForPicker}
                    onChange={(e) => setHex(e.target.value)}
                    aria-label="Custom colour"
                    className="uc-native-color"
                  />
                </label>
              </div>

              {allowOpacity && !parsed.raw ? (
                <div className="uc-opacity">
                  <span className="uc-pop-label uc-inline">Opacity</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={parsed.alpha}
                    onChange={(e) => setAlpha(Number(e.target.value))}
                    className="uc-range"
                  />
                  <span className="uc-opacity-val">{parsed.alpha}%</span>
                </div>
              ) : null}

              <div className="uc-pop-foot">
                <input
                  type="text"
                  value={value ?? ""}
                  placeholder={fallback}
                  maxLength={28}
                  onChange={(e) => onChange(e.target.value.trim())}
                  className="uc-hexinput"
                />
                {onReset && value ? (
                  <button
                    type="button"
                    title="Reset to theme default"
                    className="uc-clear"
                    onClick={() => {
                      onReset();
                      setOpen(false);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────

export function SliderControl({
  label,
  min,
  max,
  step = 1,
  value,
  suffix,
  onChange,
}: {
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const inner = (
    <div className="uc-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="uc-range"
      />
      <span className="uc-slider-val">
        {value}
        {suffix ?? ""}
      </span>
    </div>
  );
  return label ? <ControlRow label={label}>{inner}</ControlRow> : inner;
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export function ToggleControl({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="uc-row uc-row-inline">
      <label className="uc-label">
        {label}
        {hint ? <span className="uc-hint">{hint}</span> : null}
      </label>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={checked ? "uc-toggle on" : "uc-toggle"}
        onClick={() => onChange(!checked)}
      >
        <span className="uc-toggle-dot" />
      </button>
    </div>
  );
}

// ── Segmented ─────────────────────────────────────────────────────────────────

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Array<{
    value: T;
    label?: string;
    icon?: ReactNode;
    title?: string;
  }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const inner = (
    <div className="uc-seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          title={o.title ?? o.label}
          className={value === o.value ? "uc-seg-btn on" : "uc-seg-btn"}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label ? <span>{o.label}</span> : null}
        </button>
      ))}
    </div>
  );
  return label ? <ControlRow label={label}>{inner}</ControlRow> : inner;
}

// ── Select ────────────────────────────────────────────────────────────────────

export function SelectControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  const inner = (
    <select
      id={id}
      className="uc-select"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  return label ? (
    <ControlRow label={label} htmlFor={id}>
      {inner}
    </ControlRow>
  ) : (
    inner
  );
}

// ── Number ────────────────────────────────────────────────────────────────────

export function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  placeholder,
  onChange,
}: {
  label?: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  onChange: (v: number | undefined) => void;
}) {
  const id = useId();
  const inner = (
    <div className="uc-number">
      <input
        id={id}
        type="number"
        className="uc-number-input"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
      {suffix ? <span className="uc-number-suffix">{suffix}</span> : null}
    </div>
  );
  return label ? (
    <ControlRow label={label} htmlFor={id} inline>
      {inner}
    </ControlRow>
  ) : (
    inner
  );
}

// ── Media (image) ─────────────────────────────────────────────────────────────

/**
 * Image control — upload a file (via `onUpload`) or paste a URL. Shows a live
 * preview + clear. The value is the image URL; changing it must flow to the same
 * state the canvas renders from (Business Principle #8) so it appears at once.
 */
export function MediaControl({
  label,
  value,
  onChange,
  onUpload,
  hint,
}: {
  label?: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  /** Uploads a picked file and resolves to its URL. Omit to allow URL-only. */
  onUpload?: (file: File) => Promise<string | null>;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    setBusy(true);
    try {
      const url = await onUpload(file);
      if (url) onChange(url);
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <div className="uc-media">
      <div
        className={value ? "uc-media-preview has" : "uc-media-preview"}
        style={value ? { backgroundImage: `url(${value})` } : undefined}
      >
        {!value ? <span className="uc-media-empty">No image</span> : null}
        {value ? (
          <button
            type="button"
            className="uc-media-clear"
            title="Remove image"
            onClick={() => onChange(undefined)}
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="uc-media-actions">
        {onUpload ? (
          <>
            <button
              type="button"
              className="uc-btn"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Uploading…" : value ? "Replace" : "Upload"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </>
        ) : null}
        <input
          type="text"
          className="uc-media-url"
          placeholder="…or paste an image URL"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() || undefined)}
        />
      </div>
    </div>
  );
  return label ? (
    <ControlRow label={label} hint={hint}>
      {body}
    </ControlRow>
  ) : (
    body
  );
}

// ── Spacing (padding / margin) ────────────────────────────────────────────────

type Spacing = { py?: number; px?: number; mt?: number; mb?: number };

/** Four compact number fields for a block's vertical/horizontal padding + margin. */
export function SpacingControl({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: Spacing;
  onChange: (patch: Spacing) => void;
}) {
  const cell = (k: keyof Spacing, cap: string) => (
    <label className="uc-spacing-cell">
      <input
        type="number"
        value={value[k] ?? ""}
        placeholder="–"
        onChange={(e) =>
          onChange({
            [k]: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
      />
      <span>{cap}</span>
    </label>
  );
  return (
    <ControlRow label={label}>
      <div className="uc-spacing">
        {cell("py", "Padding Y")}
        {cell("px", "Padding X")}
        {cell("mt", "Margin top")}
        {cell("mb", "Margin btm")}
      </div>
    </ControlRow>
  );
}
