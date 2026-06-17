"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  createWebsiteLogoUploadUrl,
  registerWebsiteLogoAction,
  removeWebsiteLogoAction,
  saveBrandAction,
} from "@/app/[locale]/dashboard/website/actions";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 4 * 1024 * 1024;

export function BrandForm({
  websiteId,
  initialName,
  initialTagline,
  initialLogoUrl,
}: {
  websiteId: string;
  initialName: string;
  initialTagline: string;
  initialLogoUrl: string | null;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();

  async function onPickLogo(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("logoTypeError"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("logoSizeError"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const ticket = await createWebsiteLogoUploadUrl(websiteId, ext);
      if (!ticket.ok) {
        toast.error(t("logoUploadError"));
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type || "image/png",
        });
      if (upErr) {
        toast.error(t("logoUploadError"));
        return;
      }
      const res = await registerWebsiteLogoAction(websiteId, ticket.data.path);
      if (!res.ok) {
        toast.error(t("logoUploadError"));
        return;
      }
      const { data: pub } = supabase.storage
        .from("website-assets")
        .getPublicUrl(ticket.data.path);
      setLogoUrl(pub.publicUrl);
      toast.success(t("logoSaved"));
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveLogo() {
    setUploading(true);
    const res = await removeWebsiteLogoAction(websiteId);
    setUploading(false);
    if (!res.ok) {
      toast.error(t("saveError"));
      return;
    }
    setLogoUrl(null);
    toast.success(t("logoRemoved"));
    router.refresh();
  }

  function onSave() {
    startSave(async () => {
      const res = await saveBrandAction({ websiteId, name, tagline });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("brandSaved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h3 className="text-sm font-semibold text-brand-ink">
          {t("logoLabel")}
        </h3>
        <p className="mt-1 text-[13px] text-brand-mute">{t("logoHint")}</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-card border border-dashed border-brand-line bg-brand-light/40">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={t("logoLabel")}
                className="h-full w-full object-contain"
              />
            ) : (
              <ImagePlus className="h-6 w-6 text-brand-mute/50" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {logoUrl ? t("logoReplace") : t("logoUpload")}
            </button>
            {logoUrl ? (
              <button
                type="button"
                disabled={uploading}
                onClick={onRemoveLogo}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t("logoRemove")}
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
            if (f) onPickLogo(f);
            e.target.value = "";
          }}
        />
      </section>

      {/* Name + tagline */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div>
          <label
            htmlFor="brand-name"
            className="block text-sm font-semibold text-brand-ink"
          >
            {t("siteNameLabel")}
          </label>
          <input
            id="brand-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder={t("siteNamePlaceholder")}
            className="mt-1.5 w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink outline-none transition focus:border-brand-primary"
          />
        </div>
        <div>
          <label
            htmlFor="brand-tagline"
            className="block text-sm font-semibold text-brand-ink"
          >
            {t("taglineLabel")}
          </label>
          <input
            id="brand-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={200}
            placeholder={t("taglinePlaceholder")}
            className="mt-1.5 w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink outline-none transition focus:border-brand-primary"
          />
          <p className="mt-1 text-[12px] text-brand-mute">{t("taglineHint")}</p>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("saveChanges")}
        </button>
      </div>
    </div>
  );
}
