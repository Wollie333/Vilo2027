"use client";

// Shared setup-wizard form atoms — the polished field/select/stepper/toggle/
// pick-card primitives used across every step card. Styling matches the Vilo
// "Setup Flow" design (focus-ring inputs, brand pick-cards).

import { Check, ChevronDown, Minus, Pencil, Plus } from "lucide-react";
import { cloneElement, forwardRef, isValidElement } from "react";

export function Field({
  label,
  hint,
  error,
  optional,
  required,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label ? (
        <label className="mb-1.5 block text-sm font-medium text-brand-ink">
          {label}
          {required ? (
            <span className="ml-0.5 text-status-cancelled" aria-hidden>
              *
            </span>
          ) : null}
          {optional ? (
            <span className="ml-1 font-normal text-brand-mute">(optional)</span>
          ) : null}
        </label>
      ) : null}
      {/* On error, mark the control invalid so it gets the app-wide red border
          (styled via the [aria-invalid] rule in globals.css). */}
      {error && isValidElement(children)
        ? cloneElement(children as React.ReactElement, { "aria-invalid": true })
        : children}
      {hint && !error ? (
        <div className="mt-1.5 text-xs text-brand-mute">{hint}</div>
      ) : null}
      {error ? (
        <div className="mt-1.5 text-xs text-red-600">{error}</div>
      ) : null}
    </div>
  );
}

// forwardRef so react-hook-form's register() ref reaches the real input —
// without it React drops the ref and RHF can't read the field's value, which
// surfaces as a spurious "Invalid input" even on a filled field.
export const TextInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className = "", ...rest }, ref) {
  return (
    <input
      ref={ref}
      {...rest}
      className={`focus-ring w-full rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink transition placeholder:text-brand-mute disabled:bg-brand-light/60 disabled:text-brand-mute ${className}`}
    />
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={`focus-ring w-full resize-none rounded border border-brand-line bg-white px-3.5 py-2.5 text-sm leading-relaxed text-brand-ink transition placeholder:text-brand-mute ${className}`}
    />
  );
});

export const SelectInput = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function SelectInput({ children, className = "", ...rest }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...rest}
        className={`focus-ring w-full appearance-none rounded border border-brand-line bg-white px-3.5 py-2.5 pr-9 text-sm text-brand-ink transition ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
    </div>
  );
});

/** Currency input with a leading R prefix. */
export function CurrencyInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-brand-mute">
        R
      </span>
      <TextInput
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ""))}
        placeholder={placeholder}
        className={`pl-8 ${className}`}
      />
    </div>
  );
}

/** Minus / value / plus counter. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 30,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded border border-brand-line text-brand-ink transition hover:bg-brand-accent disabled:opacity-40";
  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="num min-w-[2.5rem] text-center font-display text-lg font-semibold text-brand-ink">
        {value}
        {suffix ? (
          <span className="ml-1 text-xs font-normal text-brand-mute">
            {suffix}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Toggle switch. */
export function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${
        on ? "bg-brand-primary" : "bg-brand-line"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** Large selectable choice card with icon, title and description. */
export function PickCard({
  selected,
  onClick,
  icon,
  title,
  desc,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pick-card flex items-start gap-3 rounded-card border p-3.5 text-left ${
        selected
          ? "border-brand-primary bg-brand-accent/40 shadow-card"
          : "border-brand-line bg-white hover:border-brand-primary/50"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {icon ? (
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${
            selected
              ? "bg-brand-primary text-white"
              : "bg-brand-accent text-brand-secondary"
          }`}
        >
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="font-display text-sm font-semibold text-brand-ink">
          {title}
        </div>
        {desc ? (
          <div className="mt-0.5 text-[11px] leading-snug text-brand-mute">
            {desc}
          </div>
        ) : null}
      </div>
    </button>
  );
}

/** Radio-style pick card (label + description + check circle). */
export function RadioCard({
  selected,
  onClick,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pick-card rounded-card border p-3.5 text-left ${
        selected
          ? "border-brand-primary bg-brand-accent/40 shadow-card"
          : "border-brand-line bg-white hover:border-brand-primary/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-sm font-semibold text-brand-ink">
          {title}
        </div>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
            selected
              ? "border-brand-primary bg-brand-primary text-white"
              : "border-brand-line"
          }`}
        >
          {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
      </div>
      {desc ? (
        <div className="mt-1 text-[11px] leading-snug text-brand-mute">
          {desc}
        </div>
      ) : null}
    </button>
  );
}

/**
 * Read-only summary of a saved section with an Edit pill (gently pulses to draw
 * the eye). Used in the setup steps so a saved sub-section collapses to a clean
 * card instead of an always-open form.
 */
export function SavedCard({
  icon,
  title,
  rows,
  onEdit,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  rows?: { label: string; value: React.ReactNode }[];
  onEdit: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-brand-line bg-brand-light/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand-accent text-brand-secondary">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-brand-ink">
              <Check
                className="h-3.5 w-3.5 text-brand-primary"
                strokeWidth={3}
              />
              {title}
            </div>
            {rows && rows.length > 0 ? (
              <dl className="mt-1.5 space-y-0.5 text-[12.5px]">
                {rows.map((r) => (
                  <div key={r.label} className="flex gap-2">
                    <dt className="shrink-0 text-brand-mute">{r.label}</dt>
                    <dd className="min-w-0 flex-1 truncate font-medium text-brand-ink">
                      {r.value || <span className="text-brand-mute">—</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {children ? <div className="mt-1.5">{children}</div> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="pulse-soft inline-flex shrink-0 items-center gap-1 rounded-pill border border-brand-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-brand-primary transition hover:bg-brand-accent"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      </div>
    </div>
  );
}

/** Small selectable chip (icon + label + check), used for amenities/languages. */
export function Chip({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-card border px-3 py-2.5 text-left text-sm transition ${
        selected
          ? "border-brand-primary bg-brand-accent/40 text-brand-ink"
          : "border-brand-line bg-white text-brand-mute hover:border-brand-primary/40 hover:text-brand-ink"
      }`}
    >
      {icon ? (
        <span className={selected ? "text-brand-primary" : "text-brand-mute"}>
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate font-medium">{label}</span>
      {selected ? (
        <Check className="h-3.5 w-3.5 text-brand-primary" strokeWidth={3} />
      ) : null}
    </button>
  );
}
