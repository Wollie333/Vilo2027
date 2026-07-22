"use client";

import { X } from "lucide-react";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

import {
  ensureTurnstileToken,
  TurnstileWidget,
} from "@/components/site/TurnstileWidget";
import type { SiteConversion, SiteFormDef } from "@/lib/site/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const fieldStyle: CSSProperties = {
  background: "var(--site-bg)",
  borderColor: "var(--site-line)",
  color: "var(--site-ink)",
  borderRadius: "var(--site-radius)",
};
const inputCls = "w-full border px-3.5 py-2.5 text-sm outline-none";

/**
 * Site-wide pop-up modal (Phase 6A slice 3). Appears on a trigger rule
 * (delay / scroll depth / exit-intent), capped by frequency via `localStorage`
 * (keyed by the pop-up's content so editing it re-shows). It shows an optional
 * embedded `website_forms` form (e.g. a newsletter — submitted through the same
 * /api/website-form-submit pipeline) or a simple CTA link.
 *
 * In builder preview (`!interactive`) it opens immediately, never persists
 * dismissal, and the form is inert — so the host can see and style it.
 */
export function SitePopup({
  popup,
  form,
  websiteId,
  interactive = false,
}: {
  popup?: SiteConversion["popup"];
  form?: SiteFormDef | null;
  websiteId?: string;
  interactive?: boolean;
}) {
  const enabled = popup?.enabled === true;
  const heading = popup?.heading?.trim() ?? "";
  const body = popup?.body?.trim() ?? "";
  const frequency = popup?.frequency ?? "once";
  const storageKey = `wielo-popup:${`${heading}|${body}`.slice(0, 80)}`;

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // Builder preview: show at once, no trigger wait, no persistence.
    if (!interactive) {
      setOpen(true);
      return;
    }

    // Frequency cap — has this visitor seen it recently enough to skip?
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (seen) {
        if (frequency === "once") return;
        if (frequency === "daily" && Date.now() - Number(seen) < DAY_MS) return;
      }
    } catch {
      // localStorage unavailable — fall through and show.
    }

    const trigger = popup?.trigger ?? "delay";
    const show = () => setOpen(true);

    if (trigger === "delay") {
      const ms = Math.max(0, popup?.delaySeconds ?? 5) * 1000;
      const id = window.setTimeout(show, ms);
      return () => window.clearTimeout(id);
    }
    if (trigger === "scroll") {
      const pct = Math.min(100, Math.max(5, popup?.scrollPercent ?? 50));
      const onScroll = () => {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - doc.clientHeight;
        const depth = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 100;
        if (depth >= pct) {
          show();
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    // exit-intent — pointer leaves through the top of the viewport.
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        show();
        document.removeEventListener("mouseout", onLeave);
      }
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [enabled, interactive, frequency, storageKey, popup]);

  function remember() {
    if (!interactive) return;
    try {
      window.localStorage.setItem(
        storageKey,
        frequency === "once" ? "1" : String(Date.now()),
      );
    } catch {
      // ignore
    }
  }

  function close() {
    setOpen(false);
    remember();
  }

  if (!enabled || !open) return null;

  const ctaLabel = popup?.ctaLabel?.trim();
  const ctaHref = popup?.ctaHref?.trim();
  const hasForm = Boolean(form && form.fields.length > 0);
  const showCta =
    !hasForm && ctaLabel && ctaHref && /^(https?:\/\/|\/)/i.test(ctaHref);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/50"
      />
      <div
        style={{
          background: "var(--site-surface)",
          borderColor: "var(--site-line)",
          borderRadius: "var(--site-radius)",
        }}
        className="relative w-full max-w-md border p-7 shadow-lift"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          style={{ color: "var(--site-mute)" }}
          className="absolute right-3 top-3 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-5 w-5" />
        </button>

        {heading ? (
          <h2
            style={{
              fontFamily: "var(--site-font-heading)",
              color: "var(--site-ink)",
            }}
            className="pr-6 text-xl font-bold"
          >
            {heading}
          </h2>
        ) : null}
        {body ? (
          <p
            style={{ color: "var(--site-mute)" }}
            className="mt-2 text-sm leading-relaxed"
          >
            {body}
          </p>
        ) : null}

        <div className="mt-5">
          {hasForm && form ? (
            <PopupForm
              form={form}
              websiteId={websiteId}
              interactive={interactive}
              onDone={remember}
            />
          ) : showCta ? (
            <a
              href={ctaHref}
              onClick={remember}
              style={{
                background: "var(--site-btn-primary-bg)",
                color: "var(--site-btn-primary-color)",
                border: "var(--site-btn-primary-border)",
                borderRadius: "var(--site-btn-primary-radius)",
              }}
              className="inline-flex w-full items-center justify-center px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Compact embedded form — reuses the shared submit pipeline. */
function PopupForm({
  form,
  websiteId,
  interactive,
  onDone,
}: {
  form: SiteFormDef;
  websiteId?: string;
  interactive: boolean;
  onDone: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [hp, setHp] = useState("");
  const [tsToken, setTsToken] = useState<string | null>(null);
  const [tsNonce, setTsNonce] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const live = interactive && Boolean(websiteId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!live || status === "sending") return;
    setStatus("sending");
    setError("");
    // Wait for a still-pending challenge rather than failing the submit. We are
    // already showing "Sending…", so the wait reads as progress.
    const ts = await ensureTurnstileToken(tsToken);
    try {
      const res = await fetch("/api/website-form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          form_id: form.id,
          values,
          hp,
          ts,
        }),
      });
      const result = (await res.json()) as { ok: boolean; error?: string };
      if (result.ok) {
        setStatus("sent");
        onDone();
      } else {
        setStatus("error");
        setError(result.error || "Something went wrong. Please try again.");
        setTsNonce((n) => n + 1);
      }
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <p style={{ color: "var(--site-ink)" }} className="text-sm font-semibold">
        {form.settings.successMessage}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Honeypot */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        className="hidden"
        aria-hidden
      />

      {form.fields.map((field) => {
        const v = values[field.id] ?? "";
        const setValue = (val: string) =>
          setValues((prev) => ({ ...prev, [field.id]: val }));
        if (field.type === "textarea") {
          return (
            <textarea
              key={field.id}
              required={field.required}
              value={v}
              placeholder={field.placeholder || field.label}
              rows={3}
              style={fieldStyle}
              onChange={(e) => setValue(e.target.value)}
              className={`${inputCls} resize-y`}
            />
          );
        }
        if (field.type === "select") {
          return (
            <select
              key={field.id}
              required={field.required}
              value={v}
              style={fieldStyle}
              onChange={(e) => setValue(e.target.value)}
              className={inputCls}
            >
              <option value="">{field.label}</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );
        }
        if (field.type === "checkbox") {
          return (
            <label
              key={field.id}
              style={{ color: "var(--site-ink)" }}
              className="flex items-center gap-2.5 text-sm"
            >
              <input
                type="checkbox"
                required={field.required}
                checked={v.length > 0}
                onChange={(e) => setValue(e.target.checked ? "Yes" : "")}
                className="h-4 w-4"
              />
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
            </label>
          );
        }
        const inputType =
          field.type === "email"
            ? "email"
            : field.type === "phone"
              ? "tel"
              : field.type === "date"
                ? "date"
                : "text";
        return (
          <input
            key={field.id}
            type={inputType}
            required={field.required}
            value={v}
            placeholder={field.placeholder || field.label}
            style={fieldStyle}
            onChange={(e) => setValue(e.target.value)}
            className={inputCls}
          />
        );
      })}

      {live ? (
        <TurnstileWidget onVerify={setTsToken} resetSignal={tsNonce} />
      ) : null}

      {status === "error" ? (
        <p className="text-sm font-medium text-red-600">{error}</p>
      ) : null}

      <button
        type="submit"
        // Deliberately NOT disabled on a missing Turnstile token: on a slow
        // connection the token lands after the visitor is ready, and a dead
        // button with no explanation is how you lose them. The submit handler
        // waits for it instead.
        disabled={!live || status === "sending"}
        style={{
          background: "var(--site-btn-primary-bg)",
          color: "var(--site-btn-primary-color)",
          border: "var(--site-btn-primary-border)",
          borderRadius: "var(--site-btn-primary-radius)",
        }}
        className="inline-flex w-full items-center justify-center px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : form.settings.submitLabel}
      </button>
      {!interactive ? (
        <p style={{ color: "var(--site-mute)" }} className="text-xs">
          This form is interactive on your published site.
        </p>
      ) : null}
    </form>
  );
}
