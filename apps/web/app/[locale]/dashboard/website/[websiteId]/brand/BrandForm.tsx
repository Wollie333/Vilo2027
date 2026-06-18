"use client";

import { ImagePlus, Library, Loader2, Trash2, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import {
  createWebsiteFaviconUploadUrl,
  createWebsiteLogoUploadUrl,
  registerWebsiteFaviconAction,
  registerWebsiteLogoAction,
  removeWebsiteFaviconAction,
  removeWebsiteLogoAction,
  saveBrandAction,
} from "@/app/[locale]/dashboard/website/actions";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { MediaLibrary } from "@/components/website/MediaLibrary";
import type { SiteLogoStyle, SiteNavItem } from "@/lib/site/types";
import type { SiteThemeConfig } from "@/lib/site/themes";
import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 4 * 1024 * 1024;

const SOCIAL_KEYS = [
  "instagram",
  "facebook",
  "x",
  "youtube",
  "linkedin",
  "website",
] as const;
type SocialKey = (typeof SOCIAL_KEYS)[number];

const inputCls =
  "mt-1.5 w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink outline-none transition focus:border-brand-primary";

export function BrandForm({
  websiteId,
  theme,
  nav,
  initialName,
  initialTagline,
  initialLogoUrl,
  initialFaviconUrl,
  initialLogoStyle,
  initialContactEmail,
  initialContactPhone,
  initialSocials,
}: {
  websiteId: string;
  theme: SiteThemeConfig;
  nav: SiteNavItem[];
  initialName: string;
  initialTagline: string;
  initialLogoUrl: string | null;
  initialFaviconUrl: string | null;
  initialLogoStyle: SiteLogoStyle;
  initialContactEmail: string;
  initialContactPhone: string;
  initialSocials: Record<SocialKey, string>;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [faviconUrl, setFaviconUrl] = useState(initialFaviconUrl);
  const [logoStyle, setLogoStyle] = useState<SiteLogoStyle>(initialLogoStyle);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [contactPhone, setContactPhone] = useState(initialContactPhone);
  const [socials, setSocials] =
    useState<Record<SocialKey, string>>(initialSocials);
  const [busy, setBusy] = useState(false);
  const [logoLib, setLogoLib] = useState(false);
  const [faviconLib, setFaviconLib] = useState(false);
  const [saving, startSave] = useTransition();

  async function uploadTo(
    file: File,
    kind: "logo" | "favicon",
  ): Promise<string | null> {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("logoTypeError"));
      return null;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("logoSizeError"));
      return null;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const ticket =
      kind === "logo"
        ? await createWebsiteLogoUploadUrl(websiteId, ext)
        : await createWebsiteFaviconUploadUrl(websiteId, ext);
    if (!ticket.ok) {
      toast.error(t("logoUploadError"));
      return null;
    }
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("website-assets")
      .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
        contentType: file.type || "image/png",
      });
    if (error) {
      toast.error(t("logoUploadError"));
      return null;
    }
    return ticket.data.path;
  }

  async function applyAsset(path: string, kind: "logo" | "favicon") {
    setBusy(true);
    try {
      const res =
        kind === "logo"
          ? await registerWebsiteLogoAction(websiteId, path)
          : await registerWebsiteFaviconAction(websiteId, path);
      if (!res.ok) {
        toast.error(t("logoUploadError"));
        return;
      }
      const url = websiteAssetUrl(path);
      if (kind === "logo") setLogoUrl(url);
      else setFaviconUrl(url);
      toast.success(kind === "logo" ? t("logoSaved") : t("faviconSaved"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onPick(file: File, kind: "logo" | "favicon") {
    setBusy(true);
    try {
      const path = await uploadTo(file, kind);
      if (path) await applyAsset(path, kind);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(kind: "logo" | "favicon") {
    setBusy(true);
    const res =
      kind === "logo"
        ? await removeWebsiteLogoAction(websiteId)
        : await removeWebsiteFaviconAction(websiteId);
    setBusy(false);
    if (!res.ok) {
      toast.error(t("saveError"));
      return;
    }
    if (kind === "logo") setLogoUrl(null);
    else setFaviconUrl(null);
    toast.success(kind === "logo" ? t("logoRemoved") : t("faviconRemoved"));
    router.refresh();
  }

  function onSave() {
    startSave(async () => {
      const res = await saveBrandAction({
        websiteId,
        name,
        tagline,
        logoStyle,
        contactEmail,
        contactPhone,
        socials,
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("brandSaved"));
      router.refresh();
    });
  }

  const styleOptions: Array<{
    value: SiteLogoStyle;
    label: string;
    desc: string;
  }> = [
    {
      value: "wordmark",
      label: t("styleWordmark"),
      desc: t("styleWordmarkDesc"),
    },
    { value: "mark", label: t("styleMark"), desc: t("styleMarkDesc") },
    { value: "icon", label: t("styleIcon"), desc: t("styleIconDesc") },
  ];

  const socialLabels: Record<SocialKey, string> = {
    instagram: t("socialInstagram"),
    facebook: t("socialFacebook"),
    x: t("socialX"),
    youtube: t("socialYoutube"),
    linkedin: t("socialLinkedin"),
    website: t("socialWebsite"),
  };

  const previewBrand = {
    name: name || initialName,
    tagline,
    logoUrl,
    logoStyle,
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null,
    socials,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => logoRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {logoUrl ? t("logoReplace") : t("logoUpload")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setLogoLib(true)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
              >
                <Library className="h-4 w-4" />
                {t("mediaChooseFromLibrary")}
              </button>
              {logoUrl ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove("logo")}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Logo style */}
          <div className="mt-5">
            <span className="block text-[13px] font-semibold text-brand-ink">
              {t("brandLogoStyleLabel")}
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {styleOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setLogoStyle(o.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-[11px] border px-2 py-3 text-center transition ${
                    logoStyle === o.value
                      ? "border-brand-primary bg-brand-light/60"
                      : "border-brand-line bg-white hover:bg-brand-light/40"
                  }`}
                >
                  <Type
                    className={`h-5 w-5 ${logoStyle === o.value ? "text-brand-primary" : "text-brand-mute"}`}
                  />
                  <span className="text-[11.5px] font-semibold text-brand-ink">
                    {o.label}
                  </span>
                  <span className="text-[10.5px] leading-tight text-brand-mute">
                    {o.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <input
            ref={logoRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f, "logo");
              e.target.value = "";
            }}
          />
        </section>

        {/* Favicon */}
        <section className="rounded-card border border-brand-line bg-white p-6 shadow-card">
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("faviconLabel")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">{t("faviconHint")}</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-brand-line bg-brand-light/40">
              {faviconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={faviconUrl}
                  alt={t("faviconLabel")}
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImagePlus className="h-5 w-5 text-brand-mute/50" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => faviconRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {faviconUrl ? t("faviconReplace") : t("faviconUpload")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setFaviconLib(true)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
              >
                <Library className="h-4 w-4" />
                {t("mediaChooseFromLibrary")}
              </button>
              {faviconUrl ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove("favicon")}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <input
            ref={faviconRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f, "favicon");
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
              className={inputCls}
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
              className={inputCls}
            />
            <p className="mt-1 text-[12px] text-brand-mute">
              {t("taglineHint")}
            </p>
          </div>
        </section>

        {/* Contact & social */}
        <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
          <div>
            <h3 className="text-sm font-semibold text-brand-ink">
              {t("brandContactTitle")}
            </h3>
            <p className="mt-1 text-[13px] text-brand-mute">
              {t("brandContactSub")}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[13px] font-semibold text-brand-ink">
                {t("contactEmailLabel")}
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                maxLength={160}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-brand-ink">
                {t("contactPhoneLabel")}
              </label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                maxLength={60}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <span className="block text-[13px] font-semibold text-brand-ink">
              {t("socialsLabel")}
            </span>
            <div className="mt-2 grid gap-2.5">
              {SOCIAL_KEYS.map((key) => (
                <input
                  key={key}
                  value={socials[key]}
                  onChange={(e) =>
                    setSocials((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  maxLength={300}
                  placeholder={socialLabels[key]}
                  className="w-full rounded-[10px] border border-brand-line bg-white px-3.5 py-2 text-sm text-brand-ink outline-none transition focus:border-brand-primary"
                />
              ))}
            </div>
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

      {/* Live preview */}
      <div className="lg:sticky lg:top-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {t("brandPreviewTitle")}
        </div>
        <div className="overflow-hidden rounded-card border border-brand-line shadow-card">
          <SiteThemeRoot theme={theme}>
            <SiteChrome brand={previewBrand} nav={nav} bookHref="#">
              <div className="px-6 py-10 text-center">
                <p style={{ color: "var(--site-mute)" }} className="text-sm">
                  {t("brandPreviewBody")}
                </p>
              </div>
            </SiteChrome>
          </SiteThemeRoot>
        </div>
      </div>

      <MediaLibrary
        open={logoLib}
        onOpenChange={setLogoLib}
        websiteId={websiteId}
        onSelect={(p) => applyAsset(p, "logo")}
      />
      <MediaLibrary
        open={faviconLib}
        onOpenChange={setFaviconLib}
        websiteId={websiteId}
        onSelect={(p) => applyAsset(p, "favicon")}
      />
    </div>
  );
}
