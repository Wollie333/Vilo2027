"use client";

import { ImagePlus, Library, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { createWebsiteAssetUploadUrl } from "@/app/[locale]/dashboard/website/actions";
import { MediaLibrary } from "@/components/website/MediaLibrary";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

// Dashboard-themed form primitives for the Specials wizard (brand-* tokens — app
// chrome, not a site theme). These mirror the website builder's field set; a
// future shared `components/dashboard/fields` could unify them, but they are kept
// local here so the feature stays self-contained (no deep cross-feature import).

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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
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

// Nullable number field — empty input maps to null (used for optional overrides).
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  prefix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  prefix?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="mt-1.5 flex items-stretch">
        {prefix ? (
          <span className="inline-flex items-center rounded-l-[10px] border border-r-0 border-brand-line bg-brand-light px-2.5 text-[13px] font-medium text-brand-mute">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          value={value ?? ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return onChange(null);
            const n = Number(raw);
            if (Number.isNaN(n)) return;
            onChange(n);
          }}
          className={`${inputCls} ${prefix ? "rounded-l-none" : ""}`}
        />
      </div>
    </Field>
  );
}

export function DateField({
  label,
  value,
  onChange,
  min,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  min?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="date"
        value={value ?? ""}
        min={min}
        onChange={(e) => onChange(e.target.value || null)}
        className={`mt-1.5 ${inputCls}`}
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

// A two-option segmented control (date_mode / price_mode).
export function SegmentField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="block text-[13px] font-semibold text-brand-ink">
        {label}
      </span>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange(o.value)}
              className={`rounded-[10px] border px-3 py-2.5 text-left transition ${
                active
                  ? "border-brand-primary bg-brand-accent/40"
                  : "border-brand-line bg-white hover:border-brand-mute"
              }`}
            >
              <span className="block text-[13px] font-semibold text-brand-ink">
                {o.label}
              </span>
              {o.hint ? (
                <span className="mt-0.5 block text-[11.5px] text-brand-mute">
                  {o.hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Free-form tag input (custom_tags). Enter / comma commits a tag.
export function TagInput({
  label,
  value,
  onChange,
  hint,
  max = 12,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  hint?: string;
  max?: number;
}) {
  const t = useTranslations("specials");
  const [draft, setDraft] = useState("");
  function commit() {
    const t = draft.trim().slice(0, 30);
    if (t && !value.includes(t) && value.length < max) onChange([...value, t]);
    setDraft("");
  }
  return (
    <Field label={label} hint={hint}>
      <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-[10px] border border-brand-line bg-white p-2">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-pill bg-brand-light px-2 py-0.5 text-[12px] font-medium text-brand-ink"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="text-brand-mute hover:text-red-600"
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={value.length < max ? t("tagPlaceholder") : ""}
          className="min-w-[80px] flex-1 bg-transparent px-1 text-sm text-brand-ink outline-none"
        />
      </div>
    </Field>
  );
}

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Hero image picker. Uploads browser→Storage into the business's website-assets
 * folder (needs a websiteId — the deal's business must have a website). Returns
 * the stored path (persisted on the special). When the business has no website
 * yet, the caller renders a hint instead of this control.
 */
export function HeroImageField({
  label,
  websiteId,
  path,
  onChange,
  hint,
}: {
  label: string;
  websiteId: string;
  path: string | null;
  onChange: (path: string | null) => void;
  hint?: string;
}) {
  const t = useTranslations("specials");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const url = websiteAssetUrl(path);

  async function onPick(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("heroImgError"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("heroImgTooBig"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const ticket = await createWebsiteAssetUploadUrl(websiteId, ext);
      if (!ticket.ok) {
        toast.error(t("heroUploadStartError"));
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (error) {
        toast.error(t("heroUploadError"));
        return;
      }
      onChange(ticket.data.path);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-brand-line bg-brand-light/40">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5 text-brand-mute/50" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            {url ? t("imgReplace") : t("imgUpload")}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => setLibraryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-1.5 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
          >
            <Library className="h-3.5 w-3.5" />
            {t("imgLibrary")}
          </button>
          {url ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 rounded-[10px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
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
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        websiteId={websiteId}
        onSelect={(p) => onChange(p)}
      />
    </Field>
  );
}
