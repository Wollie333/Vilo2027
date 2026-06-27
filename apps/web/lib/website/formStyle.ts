import type { CSSProperties } from "react";

import type { FormFieldRadius, FormStyle } from "@/lib/website/forms.schema";

// One styling contract shared by the public form render (FormSection) AND the
// builder canvas (FormEditor): a per-form `style` maps to scoped `--vform-*` CSS
// vars set on the form element. Each var is only emitted when overridden, so the
// public render falls back to the theme's `--site-*` (via the `var(.., fallback)`
// in FormSection) and the builder canvas falls back to its mockup defaults (the
// fallbacks baked into form-editor.css).

const RADIUS_PX: Record<FormFieldRadius, string> = {
  sharp: "3px",
  rounded: "10px",
  pill: "9999px",
};

/** Pick black/white text for a solid background colour (WCAG-ish luminance). */
export function readableTextOn(hex: string): string {
  const m = hex.replace("#", "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? "#0b1f17" : "#ffffff";
}

/** Build the `--vform-*` overrides for a form's `style` (only the set keys). */
export function formStyleVars(style: FormStyle | undefined): CSSProperties {
  const vars: Record<string, string> = {};
  if (!style) return vars as CSSProperties;
  if (style.accent) vars["--vform-accent"] = style.accent;
  if (style.fieldRadius) vars["--vform-radius"] = RADIUS_PX[style.fieldRadius];
  if (style.fieldBg) vars["--vform-field-bg"] = style.fieldBg;
  if (style.fieldBorder) vars["--vform-field-border"] = style.fieldBorder;
  if (style.buttonBg) {
    vars["--vform-btn-bg"] = style.buttonBg;
    vars["--vform-btn-fg"] = readableTextOn(style.buttonBg);
  }
  return vars as CSSProperties;
}
