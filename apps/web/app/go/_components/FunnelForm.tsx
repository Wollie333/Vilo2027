"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Check,
  GitBranchPlus,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  TurnstileWidget,
  ensureTurnstileToken,
} from "@/components/site/TurnstileWidget";

// Lead-magnet capture card for the public /go/<slug> funnels. Renders the white
// card that sits in the hero: either the form, or (on success) an inline receipt
// confirming the lead was added to the pipeline, with a CTA to the resource page.
// Design direction: docs/features/FUNNEL_MANAGER_DESIGN_BRIEF + founder mockups.

const schema = z.object({
  name: z.string().trim().min(2, "We'd like to know who to address it to."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email — that's where the kit goes."),
  establishment_address: z.string().trim().optional(),
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

type Success = {
  redirectTo: string;
  ref: string;
  name: string;
  establishment: string | null;
};

export function FunnelForm({
  slug,
  magnetTitle = "Send me the Starter Kit",
  magnetSub = "14-page PDF + calculator + templates. Free, instantly.",
  submitLabel = "Send me the free kit",
  sourceLabel = "lead-magnet / starter-kit",
}: {
  slug: string;
  magnetTitle?: string;
  magnetSub?: string;
  submitLabel?: string;
  sourceLabel?: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const honeypotRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<string | null>(null);
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [adSource, setAdSource] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

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
          establishment_address: values.establishment_address || "",
          rooms: values.rooms || "",
          marketing_consent: Boolean(values.marketing_consent),
          utm,
          ad_source: adSource,
          ts: ts || undefined,
          hp: honeypotRef.current?.value || "",
        }),
      });
      const data = (await res.json()) as
        | {
            ok: true;
            redirectTo: string;
            lead: { ref: string; name: string; establishment: string | null };
          }
        | { ok: false; error: string };
      if (data.ok) {
        setSuccess({ redirectTo: data.redirectTo, ...data.lead });
        return;
      }
      setServerError(data.error);
      setSubmitting(false);
    } catch {
      setServerError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  function captureAnother() {
    setSuccess(null);
    setSubmitting(false);
    setServerError(null);
    reset();
  }

  const field =
    "w-full h-[46px] px-3.5 rounded-[10px] border border-brand-line bg-white text-[14.5px] text-brand-ink outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-[#9BB6A9]";
  const label = "block text-[12.5px] font-semibold text-brand-secondary mb-1.5";

  if (success) {
    return (
      <div className="rounded-card bg-white p-6 shadow-[0_10px_34px_-14px_rgba(6,78,59,0.35)]">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-brand-secondary">
            <Check className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-[20px] font-extrabold tracking-tight">
            Your kit is on its way.
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-mute">
            Check your inbox — the download link and calculator are in the first
            email.
          </p>
        </div>

        <div className="mt-5 rounded-[12px] border border-brand-line bg-brand-light p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-brand-secondary">
            <GitBranchPlus className="h-3.5 w-3.5" />
            Added to your pipeline
          </div>
          <Receipt k="Lead" v={success.name} />
          <Receipt k="Establishment" v={success.establishment || "—"} />
          <Receipt k="Stage" v="New" pill />
          <Receipt k="Source" v={sourceLabel} mono />
          <Receipt k="Lead ID" v={success.ref} mono />
        </div>

        <a
          href={success.redirectTo}
          className="mt-3.5 flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand-primary text-[15.5px] font-bold text-white transition hover:bg-brand-secondary"
        >
          <Play className="h-4 w-4" />
          Watch the video &amp; download
        </a>
        <button
          type="button"
          onClick={captureAnother}
          className="mt-2.5 flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] border border-brand-line bg-white text-[14px] font-semibold text-brand-secondary transition hover:bg-brand-light"
        >
          <RotateCcw className="h-4 w-4" />
          Send another
        </button>
      </div>
    );
  }

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
            placeholder="you@guesthouse.co.za"
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
          <label className={label} htmlFor="f-place">
            Establishment{" "}
            <span className="font-normal text-brand-mute">(optional)</span>
          </label>
          <input
            id="f-place"
            className={field}
            placeholder="Karoo Sunset Guest Farm"
            {...register("establishment_address")}
          />
        </div>

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

        <label className="mt-0.5 flex items-start gap-2 text-[12px] leading-relaxed text-brand-mute">
          <input
            type="checkbox"
            className="mt-0.5"
            {...register("marketing_consent")}
          />
          <span>
            Email me occasional host tips &amp; offers. Unsubscribe anytime.
          </span>
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

function Receipt({
  k,
  v,
  mono = false,
  pill = false,
}: {
  k: string;
  v: string;
  mono?: boolean;
  pill?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-[5px] text-[12.5px]">
      <span className="font-medium text-brand-mute">{k}</span>
      {pill ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-2.5 py-0.5 text-[11.5px] font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
          {v}
        </span>
      ) : (
        <span
          className={`text-right font-semibold ${mono ? "font-mono text-[11.5px]" : ""}`}
        >
          {v}
        </span>
      )}
    </div>
  );
}
