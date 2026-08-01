"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  TurnstileWidget,
  ensureTurnstileToken,
} from "@/components/site/TurnstileWidget";

// Lead-magnet capture card for the public /go/<slug> funnels. Renders the white
// capture card in the hero. On a successful submit it redirects straight to the
// funnel's thank-you page (which delivers the resource + fires the Lead pixel /
// dataLayer conversion event) — no inline receipt.
// Design direction: docs/features/FUNNEL_MANAGER_DESIGN_BRIEF + founder mockups.

const schema = z.object({
  name: z.string().trim().min(2, "We'd like to know who to address it to."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email — that's where the kit goes."),
  phone: z.string().trim().optional(),
  rooms: z.string().optional(),
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

const ROOM_OPTIONS = [
  "1–3 rooms",
  "4–9 rooms",
  "10–24 rooms",
  "25+ rooms",
  "Not open yet",
];

export function FunnelForm({
  slug,
  variant = "host",
  magnetTitle = "Send me the Starter Kit",
  magnetSub = "14-page PDF + calculator + templates. Free, instantly.",
  submitLabel = "Send me the free kit",
  consentLabel = "Email me occasional host tips & offers. Unsubscribe anytime.",
}: {
  slug: string;
  /** "host" shows the room-count field; "affiliate" hides it. Phone shows on both. */
  variant?: "host" | "affiliate";
  magnetTitle?: string;
  magnetSub?: string;
  submitLabel?: string;
  consentLabel?: string;
}) {
  const isHost = variant === "host";
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
          rooms: values.rooms || "",
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
        // New lead captured — go straight to the thank-you page (it delivers the
        // resource and fires the Lead pixel / dataLayer conversion). Keep the
        // button in its loading state until the navigation unloads the page.
        window.location.assign(data.redirectTo);
        return;
      }
      setServerError(data.error);
      setSubmitting(false);
    } catch {
      setServerError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const field =
    "w-full h-[46px] px-3.5 rounded-[10px] border border-brand-line bg-white text-[14.5px] text-brand-ink outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-[#9BB6A9]";
  const label = "block text-[12.5px] font-semibold text-brand-secondary mb-1.5";

  return (
    <div className="rounded-card bg-white p-6 shadow-[0_10px_34px_-14px_rgba(6,78,59,0.35)]">
      <div className="mb-5 border-b border-brand-line pb-[18px]">
        <h2 className="font-display text-[20px] font-extrabold tracking-tight">
          {magnetTitle}
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-brand-mute">
          {magnetSub}
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-3.5"
      >
        {/* Honeypot */}
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
          <label className={label} htmlFor="f-name">
            Your name
          </label>
          <input
            id="f-name"
            className={field}
            placeholder="Lindiwe Mahlangu"
            autoComplete="name"
            {...register("name")}
          />
          {errors.name ? (
            <p className="mt-1.5 text-[12px] font-medium text-red-600">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className={label} htmlFor="f-email">
            Email
          </label>
          <input
            id="f-email"
            type="email"
            className={field}
            placeholder={isHost ? "you@guesthouse.co.za" : "you@email.com"}
            autoComplete="email"
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-1.5 text-[12px] font-medium text-red-600">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className={label} htmlFor="f-phone">
            Phone number{" "}
            <span className="font-normal text-brand-mute">(optional)</span>
          </label>
          <input
            id="f-phone"
            type="tel"
            className={field}
            placeholder="082 123 4567"
            autoComplete="tel"
            {...register("phone")}
          />
        </div>

        {isHost ? (
          <div>
            <label className={label} htmlFor="f-rooms">
              How many rooms do you host?
            </label>
            <select id="f-rooms" className={field} {...register("rooms")}>
              <option value="">Select…</option>
              {ROOM_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <label className="mt-0.5 flex items-start gap-2 text-[12px] leading-relaxed text-brand-mute">
          <input
            type="checkbox"
            className="mt-0.5"
            {...register("marketing_consent")}
          />
          <span>{consentLabel}</span>
        </label>

        <TurnstileWidget onVerify={(t) => (tokenRef.current = t)} />

        {serverError ? (
          <p className="text-[13px] font-medium text-red-600" role="alert">
            {serverError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] bg-brand-primary text-[15.5px] font-bold text-white transition hover:bg-brand-secondary disabled:bg-[#7FD9BC]"
        >
          {submitting ? (
            <>
              <Loader2 className="h-[17px] w-[17px] animate-spin" />
              Sending your kit…
            </>
          ) : (
            <>
              {submitLabel}
              <ArrowRight className="h-[17px] w-[17px]" />
            </>
          )}
        </button>
        <p className="text-center text-[11.5px] leading-relaxed text-brand-mute">
          No spam, no commission, no card. Unsubscribe in one click.
        </p>
      </form>
    </div>
  );
}
