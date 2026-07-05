"use client";

// Thin compatibility shim: the app-wide colour picker now delegates to the
// unified `ColorControl` (the styling-controls SSOT) so every colour field gets
// the SAME behaviour at once — theme circles + a TRANSPARENT circle + custom
// picker, an OPACITY slider, and a popover PORTALED above all cards/canvas
// (z-index fixed). Keep this export so the ~17 existing call sites don't churn.
import { ColorControl } from "@/components/builder/controls/StyleControls";

export function ThemeColorPicker({
  value,
  fallback,
  swatches,
  onChange,
  onReset,
}: {
  value: string | undefined;
  fallback: string;
  swatches: string[];
  onChange: (v: string) => void;
  onReset?: () => void;
  /** Legacy prop — the popover now auto-positions (portaled), so this is ignored. */
  align?: "left" | "right";
}) {
  return (
    <ColorControl
      value={value}
      fallback={fallback}
      swatches={swatches}
      onChange={onChange}
      onReset={onReset}
    />
  );
}
