"use client";

import { ImagePlus, Library, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  createWebsiteBrandAssetUploadUrl,
  registerWebsiteBrandAssetAction,
  removeWebsiteBrandAssetAction,
} from "@/app/[locale]/dashboard/website/actions";
import type { BrandAssetSlot } from "@/app/[locale]/dashboard/website/schemas";
import { MediaLibrary } from "@/components/website/MediaLibrary";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 4 * 1024 * 1024;

export const inputCls =
  "w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink outline-none transition focus:border-brand-primary";

/** A titled card wrapper matching the dashboard form-section pattern. */
export function StudioCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card sm:p-6">
      <h3 className="text-sm font-semibold text-brand-ink">{title}</h3>
      {hint ? <p className="mt-1 text-[13px] text-brand-mute">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Label + control row. */
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

/** Segmented (pill) control. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-pill border border-brand-line bg-brand-light/60 p-0.5 text-[12px] font-semibold">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-pill py-1.5 transition ${
            value === o.value
              ? "bg-white text-brand-secondary shadow-sm"
              : "text-brand-mute hover:text-brand-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Slider with a live numeric readout. */
export function RangeRow({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-brand-ink">
          {label}
        </span>
        <span className="text-[12px] font-medium tabular-nums text-brand-mute">
          {format ? format(value) : value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-brand-primary"
      />
    </div>
  );
}

/**
 * Per-role colour control: swatch + native picker + hex field, an inherit/reset
 * affordance, and a quick-apply row of saved brand swatches. `value` "" = inherit
 * the preset (the resolved preset colour is shown as the swatch).
 */
export function ColorField({
  label,
  value,
  inheritedHex,
  palette,
  onChange,
}: {
  label: string;
  value: string; // "" = inherit
  inheritedHex: string; // resolved preset colour shown when inheriting
  palette: string[];
  onChange: (hex: string) => void;
}) {
  const t = useTranslations("website");
  const resolved = value || inheritedHex || "#000000";
  return (
    <div className="rounded-[12px] border border-brand-line p-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-brand-ink">
          {label}
        </span>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            {t("brandColourInherit")}
          </button>
        ) : (
          <span className="text-[11px] font-medium text-brand-mute">
            {t("inheritPreset")}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label
          className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-[8px] ring-1 ring-black/10"
          style={{ background: resolved }}
        >
          <input
            type="color"
            value={resolved}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          value={value}
          placeholder={inheritedHex}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(
              /^#?[0-9a-fA-F]{0,6}$/.test(v)
                ? (v && !v.startsWith("#") ? `#${v}` : v).toUpperCase()
                : value,
            );
          }}
          maxLength={7}
          className="w-[100px] rounded-[8px] border border-brand-line px-2 py-1.5 text-[12px] font-medium uppercase tabular-nums text-brand-ink outline-none focus:border-brand-primary"
        />
        {palette.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {palette.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => onChange(c)}
                className="h-5 w-5 rounded-full ring-1 ring-black/10 transition hover:scale-110"
                style={{ background: c }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Upload / replace / remove a single brand asset slot (logo variants, favicon,
 * apple icon) — direct browser→Storage upload, then registers the path. Mirrors
 * the listing-photo pattern (no Server Action body cap).
 */
export function AssetUploader({
  websiteId,
  slot,
  url,
  onChange,
  preview = "square",
}: {
  websiteId: string;
  slot: BrandAssetSlot;
  url: string | null;
  onChange: (url: string | null) => void;
  preview?: "square" | "wide";
}) {
  const t = useTranslations("website");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState(false);

  async function apply(path: string) {
    const res = await registerWebsiteBrandAssetAction(websiteId, slot, path);
    if (!res.ok) {
      toast.error(t("logoUploadError"));
      return;
    }
    onChange(websiteAssetUrl(path));
    toast.success(t("brandAssetSaved"));
  }

  async function onPick(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("logoTypeError"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("logoSizeError"));
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const ticket = await createWebsiteBrandAssetUploadUrl(
        websiteId,
        slot,
        ext,
      );
      if (!ticket.ok) {
        toast.error(t("logoUploadError"));
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/png",
        });
      if (error) {
        toast.error(t("logoUploadError"));
        return;
      }
      await apply(ticket.data.path);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      const res = await removeWebsiteBrandAssetAction(websiteId, slot);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      onChange(null);
      toast.success(t("brandAssetRemoved"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex items-center justify-center overflow-hidden rounded-card border border-dashed border-brand-line bg-brand-light/40 ${
          preview === "wide" ? "h-16 w-28" : "h-16 w-16"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <ImagePlus className="h-5 w-5 text-brand-mute/50" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {url ? t("logoReplace") : t("logoUpload")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setLib(true)}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          <Library className="h-4 w-4" />
          {t("mediaChooseFromLibrary")}
        </button>
        {url ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      <MediaLibrary
        open={lib}
        onOpenChange={setLib}
        websiteId={websiteId}
        onSelect={(p) => apply(p)}
      />
    </div>
  );
}
