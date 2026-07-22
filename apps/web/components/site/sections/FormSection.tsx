"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

import {
  ensureTurnstileToken,
  TurnstileWidget,
  turnstileEnabled,
} from "@/components/site/TurnstileWidget";
import { formStyleVars } from "@/lib/website/formStyle";
import { siteThankYouHref } from "@/lib/site/thankYouHref";
import { ThemedDateRange } from "@/components/site/ThemedDateRange";
import { SiteLoadingOverlay } from "@/components/site/SiteLoadingOverlay";
import type { FormRenderData, SiteFormDef } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted } from "./_shared";

type Props = Extract<WebsiteSection, { type: "form" }>["props"];

// Field look reads the per-form `--vform-*` overrides first, falling back to the
// active theme's `--site-*` (so an unstyled form looks exactly as before). The
// `--vform-*` vars are set on the <form> from the form's `style` (Styles tab).
const fieldStyle: CSSProperties = {
  background: "var(--vform-field-bg, var(--site-bg))",
  borderColor: "var(--vform-field-border, var(--site-line))",
  color: "var(--site-ink)",
  borderRadius: "var(--vform-radius, var(--site-radius))",
  // Tints native control chrome (select arrow, date-picker indicator, number
  // spinners) with the accent so every field reads as part of the design.
  accentColor: "var(--vform-accent, var(--site-accent))",
};
const inputCls = "w-full border px-4 py-3 text-sm outline-none";

// Tick/dot of a checkbox or radio in the accent (these inputs don't take the
// bordered field style — just the native accent).
const checkStyle: CSSProperties = {
  accentColor: "var(--vform-accent, var(--site-accent))",
};

/**
 * A consent link is host-supplied — only allow safe schemes (http(s)/mailto and
 * site-relative paths). Anything else (javascript:, data:, …) is dropped so the
 * link renders as plain text. Mirrors the lib/sanitiseHtml scheme allow-list.
 */
function safeConsentHref(url: string | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (u.startsWith("/") || u.startsWith("#")) return u;
  return null;
}

/**
 * Public render of a host-built form (Phase 4). The form definition is resolved
 * live (auto-populate `data`), and the section picks its own by `props.form_id`.
 * On submit it posts the website + form id and the raw values to
 * /api/website-form-submit, which validates server-side, persists the submission
 * and (for email-bearing forms) opens a "Website Enquiry" in the host inbox —
 * nothing here is trusted. In the builder preview (`interactive=false`) the form
 * renders but does not submit.
 */
export function FormSection({
  props,
  data,
  websiteId,
  interactive = false,
}: {
  props: Props;
  data?: FormRenderData;
  websiteId?: string;
  interactive?: boolean;
}) {
  const form: SiteFormDef | undefined =
    data?.forms.find((f) => f.id === props.form_id) ?? undefined;

  const [values, setValues] = useState<Record<string, string>>({});
  const [hp, setHp] = useState(""); // honeypot
  const [tsToken, setTsToken] = useState<string | null>(null); // Turnstile
  const [tsNonce, setTsNonce] = useState(0); // bump to reset the challenge
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const usable = Boolean(form) && (form?.fields.length ?? 0) > 0;
  const live = interactive && Boolean(websiteId) && usable;
  const variant = props.variant ?? "stacked";
  // Per-form spam protection (defaults on). When off, skip the Turnstile
  // challenge for this form — the server skips its verification to match.
  const spamOn = form?.settings.spamProtection !== false;
  const needsTurnstile = spamOn && turnstileEnabled();

  function setValue(id: string, v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!live || !form || status === "sending") return;
    setStatus("sending");
    setError("");
    // Wait for a still-pending challenge rather than failing the enquiry.
    const ts = needsTurnstile ? await ensureTurnstileToken(tsToken) : tsToken;
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
      const result = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { bookingQuery?: string };
      };
      if (result.ok) {
        const s = form.settings;
        // Booking form → hand off to the themed on-site checkout (the shared Wielo
        // booking flow). The server returns the checkout query; we resolve the
        // site-relative `/book` base on the client so it works on both the tenant
        // domain (root) and the app-domain `…/site` testing affordance.
        if (result.data?.bookingQuery) {
          const path = window.location.pathname;
          const i = path.indexOf("/site/");
          const base = i >= 0 ? path.slice(0, i + 5) : "";
          const site = new URLSearchParams(window.location.search).get("site");
          let q = result.data.bookingQuery;
          if (site) q += `&site=${encodeURIComponent(site)}`;
          window.location.assign(`${base}/book?${q}`);
          return;
        }
        // Custom URL → straight there.
        if (s.afterSubmit === "url" && s.redirectUrl.trim()) {
          window.location.assign(s.redirectUrl.trim());
          return;
        }
        // Themed thank-you page for this form's GOAL → carry the form id (+ a
        // first name when we can guess one) so the page shows the right copy.
        if (s.afterSubmit === "page") {
          const nameField = form.fields.find(
            (f) => f.type === "text" && (values[f.id] ?? "").trim(),
          );
          const firstName = nameField
            ? (values[nameField.id] ?? "").trim().split(/\s+/)[0]
            : "";
          window.location.assign(
            siteThankYouHref({
              goal: s.goal,
              formId: form.id,
              name: firstName || undefined,
            }),
          );
          return;
        }
        setStatus("sent");
      } else {
        setStatus("error");
        setError(result.error || "Something went wrong. Please try again.");
        setTsNonce((n) => n + 1); // refresh the single-use token for a retry
      }
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Please try again.");
    }
  }

  // No form selected/resolved, or the chosen form has no fields yet — render
  // nothing on the public site, a hint in the builder preview.
  if (!form || !usable) {
    if (!interactive) return null;
    return (
      <SectionShell surface width="narrow">
        <div
          style={{
            borderColor: "var(--site-line)",
            borderRadius: "var(--site-radius)",
          }}
          className="border border-dashed p-8 text-center"
        >
          <Muted>Choose a form to display in this section.</Muted>
        </div>
      </SectionShell>
    );
  }

  if (status === "sent") {
    return (
      <SectionShell surface width="narrow">
        <div
          style={{
            borderColor: "var(--site-line)",
            background: "var(--site-surface)",
            borderRadius: "var(--site-radius)",
          }}
          className="border p-8 text-center"
        >
          <p
            style={{ color: "var(--site-ink)" }}
            className="text-lg font-semibold"
          >
            {form.settings.successMessage}
          </p>
        </div>
      </SectionShell>
    );
  }

  function toggleCheck(id: string, opt: string) {
    const cur = (values[id] ?? "").split(", ").filter(Boolean);
    const next = cur.includes(opt)
      ? cur.filter((x) => x !== opt)
      : [...cur, opt];
    setValue(id, next.join(", "));
  }

  const labelSpan = (field: SiteFormDef["fields"][number]) => (
    <span style={{ color: "var(--site-ink)" }} className="text-sm font-medium">
      {field.label}
      {field.required ? " *" : ""}
    </span>
  );

  function renderControl(field: SiteFormDef["fields"][number], v: string) {
    const common = {
      required: field.required,
      value: v,
      style: fieldStyle,
      className: inputCls,
      placeholder: field.placeholder,
    };
    switch (field.type) {
      case "textarea":
        return (
          <label className="block space-y-1.5">
            {labelSpan(field)}
            <textarea
              {...common}
              rows={5}
              onChange={(e) => setValue(field.id, e.target.value)}
              className={`${inputCls} resize-y`}
            />
          </label>
        );
      case "select":
      case "rooms":
        return (
          <label className="block space-y-1.5">
            {labelSpan(field)}
            <select
              required={field.required}
              value={v}
              style={fieldStyle}
              onChange={(e) => setValue(field.id, e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        );
      case "radio":
        return (
          <fieldset className="space-y-1.5">
            {labelSpan(field)}
            <div className="space-y-2 pt-1">
              {(field.options ?? []).map((opt) => (
                <label
                  key={opt}
                  style={{ color: "var(--site-ink)" }}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <input
                    type="radio"
                    name={field.id}
                    value={opt}
                    required={field.required}
                    checked={v === opt}
                    onChange={() => setValue(field.id, opt)}
                    style={checkStyle}
                    className="h-4 w-4"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      case "checkboxes":
        return (
          <fieldset className="space-y-1.5">
            {labelSpan(field)}
            <div className="space-y-2 pt-1">
              {(field.options ?? []).map((opt) => (
                <label
                  key={opt}
                  style={{ color: "var(--site-ink)" }}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={(values[field.id] ?? "").split(", ").includes(opt)}
                    onChange={() => toggleCheck(field.id, opt)}
                    style={checkStyle}
                    className="h-4 w-4"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      case "checkbox":
      case "consent": {
        const href = safeConsentHref(field.linkUrl);
        return (
          <label
            style={{ color: "var(--site-ink)" }}
            className="flex items-start gap-2.5 text-sm"
          >
            <input
              type="checkbox"
              required={field.required}
              checked={v.length > 0}
              onChange={(e) =>
                setValue(field.id, e.target.checked ? "Yes" : "")
              }
              style={checkStyle}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              {field.optLabel || field.label}
              {href ? (
                <>
                  {" "}
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "var(--vform-accent, var(--site-accent))" }}
                    className="font-medium underline"
                  >
                    {field.linkLabel?.trim() || "Terms & Conditions"}
                  </a>
                </>
              ) : null}
              {field.required ? " *" : ""}
            </span>
          </label>
        );
      }
      case "dates": {
        const [din = "", dout = ""] = v.split(" → ");
        // Bespoke themed calendar (not native date inputs), styled from the form's
        // --vform-*/--site-* tokens so it matches the theme.
        return (
          <div className="block space-y-1.5">
            {labelSpan(field)}
            <ThemedDateRange
              from={din}
              to={dout.trim()}
              onChange={(f, t) => setValue(field.id, `${f} → ${t}`)}
              accent="var(--vform-accent, var(--site-accent))"
              ink="var(--site-ink)"
              mute="var(--site-mute)"
              line="var(--vform-field-border, var(--site-line))"
              surface="var(--site-surface)"
              radius="var(--vform-radius, var(--site-radius))"
            />
          </div>
        );
      }
      default: {
        const inputType =
          field.type === "email"
            ? "email"
            : field.type === "phone"
              ? "tel"
              : field.type === "date"
                ? "date"
                : field.type === "number" || field.type === "guests"
                  ? "number"
                  : "text";
        return (
          <label className="block space-y-1.5">
            {labelSpan(field)}
            <input
              {...common}
              type={inputType}
              min={field.type === "guests" ? 1 : undefined}
              onChange={(e) => setValue(field.id, e.target.value)}
            />
          </label>
        );
      }
    }
  }

  const styleVars = formStyleVars(form.settings.style);
  const btnAlign = form.settings.style?.buttonAlign;
  const btnJustify =
    btnAlign === "center"
      ? "center"
      : btnAlign === "right"
        ? "flex-end"
        : btnAlign === "full"
          ? "stretch"
          : "flex-start";

  const formEl = (
    <form onSubmit={onSubmit} className="space-y-4" style={styleVars}>
      {/* Honeypot — hidden from real users; bots fill it and get dropped. */}
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

      <div className="flex flex-wrap gap-x-4 gap-y-4">
        {form.fields.map((field) => {
          if (field.type === "divider") {
            return (
              <hr
                key={field.id}
                style={{ borderColor: "var(--site-line)", width: "100%" }}
              />
            );
          }
          if (field.type === "heading") {
            return (
              <h3
                key={field.id}
                style={{ color: "var(--site-ink)", width: "100%" }}
                className="text-lg font-semibold"
              >
                {field.label}
              </h3>
            );
          }
          if (field.type === "paragraph") {
            return (
              <p
                key={field.id}
                style={{ color: "var(--site-mute)", width: "100%" }}
                className="text-sm leading-relaxed"
              >
                {field.label}
              </p>
            );
          }
          const v = values[field.id] ?? "";
          return (
            <div
              key={field.id}
              className="min-w-0 space-y-1.5"
              style={{
                width: field.width === "half" ? "calc(50% - 8px)" : "100%",
                flexGrow: 1,
              }}
            >
              {renderControl(field, v)}
              {field.help ? (
                <span
                  style={{ color: "var(--site-mute)" }}
                  className="block text-xs"
                >
                  {field.help}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {live && spamOn ? (
        <TurnstileWidget onVerify={setTsToken} resetSignal={tsNonce} />
      ) : null}

      {status === "error" ? (
        <p className="text-sm font-medium text-red-600">{error}</p>
      ) : null}

      <div style={{ display: "flex", justifyContent: btnJustify }}>
        <button
          type="submit"
          // Not disabled on a missing token: the submit handler waits for a
          // still-retrying challenge instead. This form sits on a HOST's own
          // site — a dead button there is their lost enquiry, not just ours.
          disabled={!live || status === "sending"}
          style={{
            background: "var(--vform-btn-bg, var(--site-btn-primary-bg))",
            color: "var(--vform-btn-fg, var(--site-btn-primary-color))",
            border: "var(--site-btn-primary-border)",
            borderRadius: "var(--vform-radius, var(--site-btn-primary-radius))",
          }}
          className={`inline-flex items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 ${
            btnAlign === "full" ? "w-full" : "w-full sm:w-auto"
          }`}
        >
          {status === "sending" ? "Sending…" : form.settings.submitLabel}
        </button>
      </div>
      {!interactive ? (
        <p style={{ color: "var(--site-mute)" }} className="text-xs">
          This form is interactive on your published site.
        </p>
      ) : null}
    </form>
  );

  // SPLIT — heading/intro on the left, form on the right.
  if (variant === "split") {
    return (
      <SectionShell surface>
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div className="space-y-3">
            {props.heading ? (
              <SectionHeading centered={false}>{props.heading}</SectionHeading>
            ) : null}
            {props.body ? (
              <Muted className="text-base">{props.body}</Muted>
            ) : null}
          </div>
          <div>{formEl}</div>
        </div>
      </SectionShell>
    );
  }

  // STACKED (default) — centred heading/intro above the form.
  return (
    <SectionShell surface width="narrow">
      <SiteLoadingOverlay
        show={status === "sending"}
        message={
          form?.settings.goal === "booking"
            ? "Opening your booking…"
            : "Sending…"
        }
        sub={
          form?.settings.goal === "booking"
            ? "Taking you to checkout."
            : "One moment."
        }
      />
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {props.body ? (
        <Muted className="mb-8 text-center text-base">{props.body}</Muted>
      ) : null}
      <div className="mx-auto max-w-lg">{formEl}</div>
    </SectionShell>
  );
}
