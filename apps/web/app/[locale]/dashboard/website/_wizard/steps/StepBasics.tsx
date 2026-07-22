"use client";

import { ImageOff, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

import { createWizardLogoUploadUrl } from "../../actions";
import { WField, WInput } from "../WizardFields";
import type { WizardState } from "../wizardState";

export function StepBasics({
  state,
  update,
  onNext,
  embedded = false,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onNext?: () => void;
  /** Single-page-scroll shell: hide the step's own title + nav; the SectionCard
   *  provides the header and the sticky rail drives navigation. */
  embedded?: boolean;
}) {
  const t = useTranslations("website");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "wielo.site";
  const logoUrl = websiteAssetUrl(state.logoPath ?? undefined);
  const canNext =
    state.siteName.trim().length > 0 && state.subdomain.length >= 3;

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoErr, setLogoErr] = useState<string | null>(null);

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoErr("Please choose an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setLogoErr("Please use an image under 4 MB.");
      return;
    }
    setLogoErr(null);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const res = await createWizardLogoUploadUrl(ext);
      if (!res.ok) {
        setLogoErr(
          res.error === "locked"
            ? "The website builder isn't enabled on your plan yet."
            : "Couldn't start the upload. Please try again.",
        );
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(res.data.path, res.data.token, file, {
          contentType: file.type,
        });
      if (error) {
        setLogoErr("Upload failed. Please try again.");
        return;
      }
      update({ logoPath: res.data.path });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      {!embedded ? (
        <div>
          <h3 className="font-display text-lg font-bold text-brand-ink">
            {t("wizardBasicsTitle")}
          </h3>
          <p className="mt-0.5 text-[13px] text-brand-mute">
            {t("wizardBasicsBody")}
          </p>
        </div>
      ) : null}

      {/* Logo — prefilled from the business if it has one; upload or change here */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-brand-ink">
          Logo
        </label>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-brand-line bg-brand-light">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageOff className="h-5 w-5 text-brand-mute" />
            )}
            {logoUrl && !uploading ? (
              <button
                type="button"
                onClick={() => update({ logoPath: null })}
                aria-label="Remove logo"
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            ) : null}
          </div>

          <div className="min-w-0">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={onLogoChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line px-3 py-2 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading
                ? "Uploading…"
                : logoUrl
                  ? "Change logo"
                  : "Upload logo"}
            </button>
            <p className="mt-1 text-[12px] text-brand-mute">
              {logoUrl
                ? "Pulled from your business — change it here or later in Brand Studio."
                : "PNG, JPG, SVG or WebP, up to 4 MB. You can change it later."}
            </p>
            {logoErr ? (
              <p className="mt-1 text-[12px] text-red-600">{logoErr}</p>
            ) : null}
          </div>
        </div>
      </div>

      <WField label={t("wizardSiteName")}>
        <WInput
          value={state.siteName}
          onChange={(e) => update({ siteName: e.target.value })}
          maxLength={120}
          placeholder={t("wizardSiteNamePh")}
        />
      </WField>

      <WField label={t("subdomainLabel")} hint={t("subdomainHint")}>
        <div className="flex max-w-md items-stretch overflow-hidden rounded-[10px] border border-brand-line transition focus-within:border-brand-primary focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
          <input
            value={state.subdomain}
            onChange={(e) =>
              update({
                subdomain: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, ""),
              })
            }
            spellCheck={false}
            autoCapitalize="none"
            className="min-w-0 flex-1 bg-white px-3.5 py-2.5 font-mono text-sm text-brand-ink outline-none"
            placeholder="your-place"
          />
          <span className="flex items-center bg-brand-light px-3 font-mono text-[13px] text-brand-mute">
            .{root}
          </span>
        </div>
      </WField>

      <div className="grid gap-4 sm:grid-cols-2">
        <WField label={t("wizardContactEmail")} optional>
          <WInput
            type="email"
            value={state.contactEmail}
            onChange={(e) => update({ contactEmail: e.target.value })}
            maxLength={160}
            placeholder="hello@example.com"
          />
        </WField>
        <WField label={t("wizardContactPhone")} optional>
          <WInput
            value={state.contactPhone}
            onChange={(e) => update({ contactPhone: e.target.value })}
            maxLength={40}
            placeholder="+27 ..."
          />
        </WField>
      </div>

      {!embedded ? (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("wizardNext")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
