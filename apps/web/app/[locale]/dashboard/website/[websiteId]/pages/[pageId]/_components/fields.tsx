"use client";

import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { createWebsiteAssetUploadUrl } from "@/app/[locale]/dashboard/website/actions";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

// Dashboard-themed form primitives for the section editor (brand-* tokens — this
// is app chrome, not the site theme). Small + controlled; the builder owns state.

const inputCls =
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

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.max(min ?? n, Math.min(max ?? n, n)));
        }}
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
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
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
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-semibold text-brand-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-primary" : "bg-brand-line"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

/** Auto-populate notice — these sections pull live data, not free-form text. */
export function LiveNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/50 px-3 py-2 text-[12.5px] text-brand-mute">
      {children}
    </p>
  );
}

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Image picker that uploads browser→Storage (no Vercel body cap) and returns the
 * stored PATH (persisted into section props on Save). Mirrors the brand-logo flow.
 */
export function ImageField({
  label,
  websiteId,
  path,
  onChange,
  hint,
}: {
  label: string;
  websiteId: string;
  path?: string;
  onChange: (path: string | undefined) => void;
  hint?: string;
}) {
  const t = useTranslations("website");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const url = websiteAssetUrl(path);

  async function onPick(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("imageTypeError"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("imageSizeError"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const ticket = await createWebsiteAssetUploadUrl(websiteId, ext);
      if (!ticket.ok) {
        toast.error(t("imageUploadError"));
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (error) {
        toast.error(t("imageUploadError"));
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
            {url ? t("imageReplace") : t("imageUpload")}
          </button>
          {url ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => onChange(undefined)}
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
    </Field>
  );
}

/** A reusable add/remove list editor for the array-prop sections. */
export function ItemListEditor<T>({
  label,
  items,
  onChange,
  blank,
  renderItem,
  addLabel,
  max = 12,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  renderItem: (item: T, patch: (next: Partial<T>) => void) => ReactNode;
  addLabel: string;
  max?: number;
}) {
  function patchAt(i: number, next: Partial<T>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...next } : it)));
  }
  return (
    <div>
      <span className="block text-[13px] font-semibold text-brand-ink">
        {label}
      </span>
      <div className="mt-2 space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="relative rounded-[10px] border border-brand-line bg-brand-light/30 p-3 pr-9"
          >
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="absolute right-2 top-2 rounded p-1 text-brand-mute hover:bg-white hover:text-red-600"
              aria-label="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <div className="space-y-2">
              {renderItem(item, (n) => patchAt(i, n))}
            </div>
          </div>
        ))}
      </div>
      {items.length < max ? (
        <button
          type="button"
          onClick={() => onChange([...items, blank()])}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-brand-line px-3 py-1.5 text-[13px] font-medium text-brand-mute transition hover:border-brand-mute hover:text-brand-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}
