"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Canva-style colour control for the builders. The trigger is a small circle
 * swatch; clicking it opens a compact popover (it doesn't cover the canvas) with
 * the host's THEME colours as clickable circles (sourced from Brand Studio) plus a
 * custom colour picker + hex below. All colour chips are circles.
 *
 * Reusable across the form / page / blog builders. Styled with the builder's
 * `--line/--ink/--mute` tokens.
 */
export function ThemeColorPicker({
  value,
  fallback,
  swatches,
  onChange,
  onReset,
  align = "right",
}: {
  /** Current value (undefined = unset → shows the theme fallback). */
  value: string | undefined;
  /** Theme default shown when unset. */
  fallback: string;
  /** Theme colours (from Brand Studio) shown as preset circles. */
  swatches: string[];
  onChange: (v: string) => void;
  /** When provided + a value is set, a clear button resets to the theme default. */
  onReset?: () => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const current = (value ?? fallback) || "#000000";
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  // A value not among the theme circles = a custom colour (highlights the custom chip).
  const customActive = !!value && !swatches.some((s) => eq(s, value));

  const sectionLabel = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: ".05em",
    color: "var(--mute)",
    margin: "0 0 7px",
  };
  const chip = (bg: string, selected: boolean): React.CSSProperties => ({
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: selected ? "2px solid var(--ink)" : "1px solid var(--line)",
    background: bg,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Choose colour"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "1px solid var(--line)",
          background: current,
          cursor: "pointer",
          padding: 0,
          boxShadow: "inset 0 0 0 2px #fff",
        }}
      />
      {open ? (
        <div
          style={{
            position: "absolute",
            zIndex: 60,
            // Opens ABOVE the swatch (a small modal right above the trigger).
            bottom: "calc(100% + 8px)",
            [align]: 0,
            width: 208,
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "0 18px 44px -22px rgba(0,0,0,.4)",
            padding: 12,
          }}
        >
          <p style={sectionLabel}>Theme colours</p>
          {/* Theme circles, ending with a rainbow CUSTOM circle (opens the native
              picker) — the single row the founder specified. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 10,
            }}
          >
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                style={chip(c, !!value && eq(value, c))}
              />
            ))}
            <label
              title="Custom colour"
              style={{
                ...chip(customActive ? current : "#fff", customActive),
                position: "relative",
                overflow: "hidden",
                // rainbow ring so it reads as "any colour" when not yet chosen
                background: customActive
                  ? current
                  : "conic-gradient(from 0deg,#f43f5e,#f59e0b,#22c55e,#3b82f6,#a855f7,#f43f5e)",
              }}
            >
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(current) ? current : "#10b981"}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Custom colour"
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  cursor: "pointer",
                }}
              />
            </label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              value={value ?? ""}
              placeholder={fallback}
              maxLength={7}
              onChange={(e) => onChange(e.target.value.trim())}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                padding: "5px 8px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                color: "var(--ink)",
              }}
            />
            {onReset && value ? (
              <button
                type="button"
                title="Reset to theme default"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
                style={{
                  fontSize: 16,
                  lineHeight: 1,
                  color: "var(--mute)",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
