"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, Loader2, Lock, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { forwardRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { saveTrackingAction } from "./actions";
import { trackingSchema } from "./schema";

// The websiteId is threaded from the page, not user-editable.
const formSchema = trackingSchema.omit({ websiteId: true });
type FormValues = z.infer<typeof formSchema>;

export function TrackingForm({
  websiteId,
  siteLabel,
  capiTokenSet,
  initial,
}: {
  websiteId: string;
  siteLabel: string;
  capiTokenSet: boolean;
  initial: Omit<FormValues, "metaCapiToken">;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...initial, metaCapiToken: "" },
  });

  function onSubmit(values: FormValues) {
    if (pending) return;
    start(async () => {
      const res = await saveTrackingAction({ ...values, websiteId });
      if (res.ok) {
        toast.success("Tracking saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const consentOn = watch("cookieConsentEnabled");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Meta ─────────────────────────────────────────────── */}
      <Card
        icon={<Activity className="h-4 w-4 text-brand-primary" />}
        title="Meta (Facebook & Instagram)"
      >
        <Field
          label="Meta Pixel ID"
          hint="Events Manager → Data sources. Numbers only, e.g. 1234567890123456."
          error={errors.metaPixel?.message}
        >
          <input
            {...register("metaPixel")}
            inputMode="numeric"
            placeholder="1234567890123456"
            className={inputCls}
          />
        </Field>

        <div className="rounded-[10px] border border-brand-line bg-brand-light/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <Lock className="h-3.5 w-3.5 text-brand-mute" />
            Conversions API (server-side)
          </div>
          <p className="mt-1 text-[12px] text-brand-mute">
            Sends bookings server-side to Meta, deduped against the pixel via a
            shared event id — better match rates + survives ad-blockers. Uses
            the Meta Pixel ID above.
          </p>
          <Field
            label="Access token"
            hint="Events Manager → Settings → Conversions API → Generate access token. Stored encrypted, never shown again."
            error={errors.metaCapiToken?.message}
            className="mt-3"
          >
            <input
              {...register("metaCapiToken")}
              type="password"
              autoComplete="off"
              placeholder={
                capiTokenSet
                  ? "•••••••••• (a token is on file — leave blank to keep it)"
                  : "Paste the Conversions API token"
              }
              className={inputCls}
            />
          </Field>
          <Checkbox {...register("metaCapiEnabled")}>
            Conversions API enabled
          </Checkbox>
        </div>
      </Card>

      {/* ── Google ───────────────────────────────────────────── */}
      <Card title="Google">
        <Field
          label="GA4 Measurement ID"
          hint="Google Analytics → Admin → Data streams. Looks like G-XXXXXXX."
          error={errors.ga4?.message}
        >
          <input
            {...register("ga4")}
            placeholder="G-XXXXXXX"
            className={inputCls}
          />
        </Field>
        <Field
          label="Google Tag Manager ID"
          hint="Optional container. Looks like GTM-XXXXXX."
          error={errors.gtm?.message}
        >
          <input
            {...register("gtm")}
            placeholder="GTM-XXXXXX"
            className={inputCls}
          />
        </Field>
        <Field
          label="Google Ads ID"
          hint="For conversion tracking. Looks like AW-123456789."
          error={errors.googleAds?.message}
        >
          <input
            {...register("googleAds")}
            placeholder="AW-123456789"
            className={inputCls}
          />
        </Field>
      </Card>

      {/* ── TikTok ───────────────────────────────────────────── */}
      <Card title="TikTok">
        <Field
          label="TikTok Pixel ID"
          hint="TikTok Events Manager → Pixel. Letters + numbers."
          error={errors.tiktok?.message}
        >
          <input
            {...register("tiktok")}
            placeholder="CXXXXXXXXXXXXXXXXX"
            className={inputCls}
          />
        </Field>
      </Card>

      {/* ── Consent ──────────────────────────────────────────── */}
      <Card title="Cookie consent">
        <p className="text-[12px] text-brand-mute">
          POPIA-friendly: when enabled, no pixels fire until the visitor accepts
          on your public site. Recommended on.
        </p>
        <Checkbox {...register("cookieConsentEnabled")}>
          Show a cookie-consent banner and hold tags until accepted
        </Checkbox>
        {consentOn ? (
          <>
            <Field
              label="Banner message"
              error={errors.cookieConsentMessage?.message}
            >
              <input
                {...register("cookieConsentMessage")}
                placeholder="We use cookies to improve your experience."
                className={inputCls}
              />
            </Field>
            <Field
              label="Privacy policy link"
              hint="A full https:// URL or a site-internal path like /privacy."
              error={errors.privacyHref?.message}
            >
              <input
                {...register("privacyHref")}
                placeholder="/privacy"
                className={inputCls}
              />
            </Field>
          </>
        ) : null}
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Saving…" : "Save tracking"}
        </button>
        <span className="text-[12px] text-brand-mute">
          Applies to{" "}
          <span className="font-medium text-brand-ink">{siteLabel}</span>
        </span>
      </div>
    </form>
  );
}

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";

function Card({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-base font-bold text-brand-ink">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] text-status-cancelled">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-brand-mute">{hint}</span>
      ) : null}
    </label>
  );
}

const Checkbox = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { children: React.ReactNode }
>(function Checkbox({ children, ...props }, ref) {
  return (
    <label className="mt-3 flex items-center gap-2.5">
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30"
        {...props}
      />
      <span className="text-sm font-medium text-brand-ink">{children}</span>
    </label>
  );
});
