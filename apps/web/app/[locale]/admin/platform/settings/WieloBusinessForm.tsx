"use client";

import { Building2, ImagePlus, Loader2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { WieloBusinessProfile } from "@/lib/billing/wielo-invoice";

import { saveWieloBusinessAction, uploadWieloLogoAction } from "./actions";

// Public URL for a host-logos storage path (the bucket is public-read).
function logoUrlFor(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path) return null;
  return `${base}/storage/v1/object/public/host-logos/${path}`;
}

type Field = keyof WieloBusinessProfile;

const FIELDS: {
  key: Field;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: "legal_name",
    label: "Registered company name",
    hint: "The legal entity that issues Wielo invoices.",
    placeholder: "Wielo Platform (Pty) Ltd",
  },
  {
    key: "vat_number",
    label: "VAT number",
    hint: "When set, invoices split out VAT and read “Tax Invoice”. Leave blank if not VAT-registered — no VAT is then charged or shown.",
    placeholder: "4123456789",
  },
  {
    key: "company_reg_number",
    label: "Company registration number",
    hint: "CIPC registration number.",
    placeholder: "2026/123456/07",
  },
  {
    key: "address_line1",
    label: "Address line 1",
    hint: "Street / building.",
    placeholder: "1 Long Street",
  },
  {
    key: "address_line2",
    label: "Address line 2",
    hint: "Suburb / unit (optional).",
    placeholder: "City Centre",
  },
  { key: "city", label: "City", hint: "", placeholder: "Cape Town" },
  {
    key: "postal_code",
    label: "Postal code",
    hint: "",
    placeholder: "8001",
  },
  {
    key: "country",
    label: "Country code",
    hint: "Two-letter ISO code. Defaults to ZA.",
    placeholder: "ZA",
  },
  {
    key: "email",
    label: "Billing email",
    hint: "Shown on the invoice for billing queries.",
    placeholder: "billing@wielo.co.za",
  },
];

export function WieloBusinessForm({
  initial,
}: {
  initial: WieloBusinessProfile;
}) {
  const router = useRouter();
  const [values, setValues] = useState<WieloBusinessProfile>(initial);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = (Object.keys(values) as Field[]).some(
    (k) => (values[k] ?? "").trim() !== (initial[k] ?? "").trim(),
  );

  function set(key: Field, v: string) {
    // Cast: every text field is a string, and vat_mode only ever receives a
    // valid WieloVatMode from its <select> below — so the computed-key write is
    // safe even though vat_mode is narrower than string.
    setValues((prev) => ({ ...prev, [key]: v }) as WieloBusinessProfile);
  }

  const logoPreview = values.logo_path ? logoUrlFor(values.logo_path) : null;

  async function onPickLogo(file: File) {
    if (file.size > 2_000_000) {
      toast.error("Logo must be under 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Could not read the file."));
        r.readAsDataURL(file);
      });
      const res = await uploadWieloLogoAction({ dataUrl });
      set("logo_path", res.path);
      toast.success("Logo uploaded — click Save to apply.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      try {
        await saveWieloBusinessAction({
          legal_name: values.legal_name.trim(),
          vat_number: values.vat_number.trim(),
          company_reg_number: values.company_reg_number.trim(),
          address_line1: values.address_line1.trim(),
          address_line2: values.address_line2.trim(),
          city: values.city.trim(),
          postal_code: values.postal_code.trim(),
          country: values.country.trim().toUpperCase(),
          email: values.email.trim(),
          logo_path: values.logo_path.trim(),
          vat_mode: values.vat_mode,
          vat_rate: String(Number(values.vat_rate) || 0),
        });
        toast.success("Wielo business details saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="max-w-lg rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-brand-primary" />
        <h2 className="font-display text-base font-bold text-brand-ink">
          Wielo business details
        </h2>
      </div>
      <p className="mt-1 text-sm text-brand-mute">
        The issuer on every invoice Wielo sends for subscriptions and products —
        the platform equivalent of a host&apos;s business details. Frozen onto
        each invoice at the moment it&apos;s issued.
      </p>

      {/* Logo — shown top-left on every Wielo → user financial document. */}
      <div className="mt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
          Logo
        </span>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-brand-line bg-brand-light">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Wielo logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <ImagePlus className="h-5 w-5 text-brand-mute" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickLogo(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-brand-line px-3 text-sm font-semibold text-brand-ink transition hover:bg-brand-light disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {uploading ? "Uploading…" : logoPreview ? "Replace" : "Upload logo"}
          </button>
          {logoPreview ? (
            <button
              type="button"
              onClick={() => set("logo_path", "")}
              disabled={uploading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-brand-mute transition hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
              title="Remove logo"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <span className="mt-1 block text-[11px] text-brand-mute">
          PNG, JPG, WebP or SVG, under 2 MB. Save to apply.
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
              {f.label}
            </span>
            <input
              type="text"
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={inputCls}
            />
            {f.hint ? (
              <span className="mt-1 block text-[11px] text-brand-mute">
                {f.hint}
              </span>
            ) : null}
          </label>
        ))}

        {/* VAT pricing — only bites when a VAT number is set above. */}
        <div className="rounded-[10px] border border-brand-line bg-brand-light/40 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
            VAT pricing
          </span>
          {!values.vat_number.trim() ? (
            <p className="mt-1 text-[11px] text-brand-mute">
              Not VAT-registered (no VAT number above), so no VAT is charged or
              shown on invoices. Add a VAT number to enable these.
            </p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium text-brand-ink">
                Prices are
              </span>
              <select
                value={values.vat_mode}
                onChange={(e) => set("vat_mode", e.target.value)}
                disabled={!values.vat_number.trim()}
                className={`${inputCls} disabled:opacity-50`}
              >
                <option value="inclusive">VAT inclusive</option>
                <option value="exclusive">VAT exclusive (added on top)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-brand-ink">
                VAT rate %
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={values.vat_rate}
                onChange={(e) => set("vat_rate", e.target.value)}
                disabled={!values.vat_number.trim()}
                placeholder="15"
                className={`${inputCls} disabled:opacity-50`}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-brand-mute">
            {values.vat_mode === "exclusive"
              ? `Exclusive: a R100 product bills R${(100 * (1 + (Number(values.vat_rate) || 0) / 100)).toFixed(2)} (VAT added on top).`
              : `Inclusive: a R100 product bills R100, with VAT shown as ${(100 - 100 / (1 + (Number(values.vat_rate) || 0) / 100)).toFixed(2)} of it.`}
          </p>
        </div>
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
