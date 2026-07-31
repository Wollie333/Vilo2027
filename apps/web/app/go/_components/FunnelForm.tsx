"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  TurnstileWidget,
  ensureTurnstileToken,
} from "@/components/site/TurnstileWidget";

// Minimal, swap-friendly lead-capture form for the public /go/<slug> funnels.
// Intentionally plain — the real design drops in later. POSTs to
// /api/funnel-submit and redirects to the thank-you page on success.

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().optional(),
  establishment_address: z.string().trim().optional(),
  marketing_consent: z.boolean().optional(),
});
type Values = z.infer<typeof schema>;

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export function FunnelForm({
  slug,
  showAddress = false,
  submitLabel = "Get the free guide",
  consentLabel = "Yes, send me tips and offers from Wielo. Unsubscribe anytime.",
}: {
  slug: string;
  showAddress?: boolean;
  submitLabel?: string;
  consentLabel?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const honeypotRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<string | null>(null);
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [adSource, setAdSource] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Capture UTM + ad source from the URL once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const captured: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) captured[k] = v;
    }
    setUtm(captured);
    setAdSource(params.get("ad") || params.get("ad_source") || "");
  }, []);

  async function onSubmit(values: Values) {
    setServerError(null);
    setSubmitting(true);
    try {
      const ts = await ensureTurnstileToken(tokenRef.current);
      const res = await fetch("/api/funnel-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: values.name,
          email: values.email,
          phone: values.phone || "",
          establishment_address: values.establishment_address || "",
          marketing_consent: Boolean(values.marketing_consent),
          utm,
          ad_source: adSource,
          ts: ts || undefined,
          hp: honeypotRef.current?.value || "",
        }),
      });
      const data = (await res.json()) as
        | { ok: true; redirectTo: string }
        | { ok: false; error: string };
      if (data.ok) {
        window.location.href = data.redirectTo;
        return;
      }
      setServerError(data.error);
      setSubmitting(false);
    } catch {
      setServerError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-accent";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3.5">
      {/* Honeypot — hidden from users; bots fill it. */}
      <div
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Company
          <input
            ref={honeypotRef}
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-ink">
          Full name
        </label>
        <input
          className={inputClass}
          autoComplete="name"
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-ink">
          Email
        </label>
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email ? (
          <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-brand-ink">
          Phone
        </label>
        <input
          className={inputClass}
          type="tel"
          autoComplete="tel"
          {...register("phone")}
        />
      </div>

      {showAddress ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-ink">
            Establishment address{" "}
            <span className="text-brand-mute">(optional)</span>
          </label>
          <input
            className={inputClass}
            {...register("establishment_address")}
          />
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-sm text-brand-mute">
        <input
          type="checkbox"
          className="mt-0.5"
          {...register("marketing_consent")}
        />
        <span>{consentLabel}</span>
      </label>

      <TurnstileWidget onVerify={(t) => (tokenRef.current = t)} />

      {serverError ? (
        <p className="text-sm text-red-600" role="alert">
          {serverError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-[10px] bg-brand-primary px-4 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : submitLabel}
      </button>

      <p className="text-center text-xs text-brand-mute">
        No spam. POPIA-compliant. Unsubscribe anytime.
      </p>
    </form>
  );
}
