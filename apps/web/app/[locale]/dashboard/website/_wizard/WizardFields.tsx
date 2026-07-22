"use client";

import { ChevronDown } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// Shared form atoms for the website wizard, matching the setup-flow design
// (design_handoff_setup_flow → setup/ui.jsx). All colour/radius/shadow comes
// from the brand Tailwind tokens; the focus ring is applied by the `.wz-root`
// scoped rule in wizard.css, so these need no per-field focus classes.

const CONTROL =
  "w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink transition placeholder:text-brand-mute";

/** Labelled field wrapper — label (+ optional grey suffix), control, hint/error. */
export function WField({
  label,
  hint,
  error,
  optional,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-sm font-medium text-brand-ink"
        >
          {label}
          {optional ? (
            <span className="ml-1 font-normal text-brand-mute">(optional)</span>
          ) : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <div className="mt-1.5 text-xs text-brand-mute">{hint}</div>
      ) : null}
      {error ? (
        <div className="mt-1.5 text-xs text-red-600">{error}</div>
      ) : null}
    </div>
  );
}

export function WInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${CONTROL} ${className ?? ""}`} />;
}

export function WTextArea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`${CONTROL} resize-none leading-relaxed ${className ?? ""}`}
    />
  );
}

export function WSelect({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={`${CONTROL} appearance-none pr-9 ${className ?? ""}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
    </div>
  );
}

/** Pill switch — the design's h-6/w-11 toggle. `onChange` receives the next state. */
export function WToggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={label}
      title={label}
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
