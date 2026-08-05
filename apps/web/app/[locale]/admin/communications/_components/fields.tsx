"use client";

import type { ReactNode } from "react";

// Dashboard-themed form primitives for the Communications composer. Mirrors the
// Specials wizard field set (app/[locale]/dashboard/specials/_components/fields)
// so the two editors read the same — kept local so the feature stays
// self-contained (no cross-feature import).

export const inputCls =
  "w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none transition focus:border-brand-primary";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-brand-ink">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[12px] text-brand-mute">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  type?: "text" | "url" | "datetime-local";
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`mt-1.5 ${inputCls}`}
      />
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={`mt-1.5 resize-y ${inputCls}`}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`mt-1.5 ${inputCls}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

// N-option inline segmented control (severity, dismiss mode, delivery).
export function SegRow<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div>
      <span className="block text-[13px] font-semibold text-brand-ink">
        {label}
      </span>
      <div className="mt-1.5 inline-flex flex-wrap gap-1 rounded-[10px] border border-brand-line bg-brand-light p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition ${
                active
                  ? "bg-white text-brand-ink shadow-sm"
                  : "text-brand-mute hover:text-brand-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint ? (
        <span className="mt-1 block text-[12px] text-brand-mute">{hint}</span>
      ) : null}
    </div>
  );
}

export function ToggleField({
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
    <div className="flex items-center justify-between gap-3">
      <div>
        <span className="text-[13px] font-semibold text-brand-ink">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-[12px] text-brand-mute">
            {hint}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-primary" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
