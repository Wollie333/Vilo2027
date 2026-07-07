"use client";

import { BarChart3, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveTrackingIdsAction } from "./actions";

type Fields = {
  ga4: string;
  gtm: string;
  tiktok: string;
  googleAds: string;
};

const FIELDS: {
  key: keyof Fields;
  label: string;
  placeholder: string;
  hint: string;
}[] = [
  {
    key: "ga4",
    label: "Google Analytics 4 (Measurement ID)",
    placeholder: "G-XXXXXXXXXX",
    hint: "Google Analytics → Admin → Data streams.",
  },
  {
    key: "gtm",
    label: "Google Tag Manager (Container ID)",
    placeholder: "GTM-XXXXXXX",
    hint: "Loads your GTM container site-wide.",
  },
  {
    key: "tiktok",
    label: "TikTok Pixel ID",
    placeholder: "CXXXXXXXXXXXXXXXXXXX",
    hint: "TikTok Ads Manager → Assets → Events.",
  },
  {
    key: "googleAds",
    label: "Google Ads (Conversion ID)",
    placeholder: "AW-XXXXXXXXX",
    hint: "Google Ads → Goals → Conversions.",
  },
];

export function TrackingIdsForm({ initial }: { initial: Fields }) {
  const router = useRouter();
  const [vals, setVals] = useState<Fields>(initial);
  const [pending, start] = useTransition();

  const dirty = (Object.keys(vals) as (keyof Fields)[]).some(
    (k) => vals[k].trim() !== initial[k].trim(),
  );

  function set(k: keyof Fields, v: string) {
    setVals((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      try {
        await saveTrackingIdsAction({
          ga4_measurement_id: vals.ga4.trim(),
          gtm_container_id: vals.gtm.trim(),
          tiktok_pixel_id: vals.tiktok.trim(),
          google_ads_id: vals.googleAds.trim(),
        });
        toast.success("Tracking IDs saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="max-w-lg rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-brand-primary" />
        <h2 className="font-display text-base font-bold text-brand-ink">
          Analytics &amp; other pixels
        </h2>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        Paste any of these and they load across the whole Wielo app + directory
        — no redeploy. Leave a field blank to disable it. (Your hosts&apos; own
        pixels on their websites are configured separately and never mix with
        these.)
      </p>

      <div className="mt-4 space-y-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              {f.label}
            </span>
            <input
              type="text"
              value={vals[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={inputCls}
            />
            <span className="mt-1 block text-[11px] text-brand-mute">
              {f.hint}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 block w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10";
