"use client";

import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  CreditCard,
  Loader2,
  MessageCircle,
  Megaphone,
  Newspaper,
  Paintbrush,
  Palette,
  Rocket,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { Link, useRouter as useLocaleRouter } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import {
  deleteWebsiteAction,
  publishWebsiteAction,
  resetWebsiteForTestingAction,
  saveWebsiteSettingsAction,
  unpublishWebsiteAction,
} from "@/app/[locale]/dashboard/website/actions";
import { AssetUploader } from "@/app/[locale]/dashboard/website/[websiteId]/brand/_components";
import { modal } from "@/components/ui/modal-host";

type PopupTrigger = "delay" | "scroll" | "exit";
type PopupFrequency = "once" | "daily" | "always";

type SettingsState = {
  brandName: string;
  brandTagline: string;
  enquiryEmailEnabled: boolean;
  enquiryEmailTo: string;
  payPaystackEnabled: boolean;
  payEftEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  whatsappMessage: string;
  announcementEnabled: boolean;
  announcementText: string;
  announcementLinkLabel: string;
  announcementLinkHref: string;
  popupEnabled: boolean;
  popupHeading: string;
  popupBody: string;
  popupTrigger: PopupTrigger;
  popupDelaySeconds: number;
  popupScrollPercent: number;
  popupFrequency: PopupFrequency;
  popupCtaLabel: string;
  popupCtaHref: string;
  popupFormId: string;
  ga4MeasurementId: string;
  metaPixelId: string;
  gtmId: string;
  tiktokId: string;
  googleAdsId: string;
  cookieConsentEnabled: boolean;
  cookieConsentMessage: string;
  privacyPolicyHref: string;
  metaCapiEnabled: boolean;
  /** True when a CAPI token is already on file (the token itself never leaves the server). */
  capiTokenSet: boolean;
  blogHeading: string;
  blogIntro: string;
  socialRail: { enabled: boolean };
};

// ── Layout primitives (mockup .sblock / .setrow / .sw / .field) ──
function Sblock({
  icon: Icon,
  title,
  desc,
  danger,
  children,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sblock">
      <div className="sblock-h">
        <span
          className="si"
          style={
            danger ? { background: "#FEF2F2", color: "#B91C1C" } : undefined
          }
        >
          <Icon style={{ width: 19, height: 19 }} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{desc}</p>
        </div>
      </div>
      <div
        className={danger ? "danger" : "card"}
        style={{ overflow: "hidden" }}
      >
        {children}
      </div>
    </div>
  );
}

function Setrow({
  title,
  desc,
  col,
  children,
}: {
  title?: string;
  desc?: ReactNode;
  col?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={col ? "setrow col" : "setrow"}>
      {title ? (
        <div className="lbl">
          <b>{title}</b>
          {desc ? <span>{desc}</span> : null}
        </div>
      ) : null}
      <div
        className={col ? "" : "ctl"}
        style={col ? { marginTop: 8 } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function Sw({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={on ? "sw on" : "sw"}
      aria-pressed={on}
      onClick={() => onChange(!on)}
    />
  );
}

export function SettingsForm({
  websiteId,
  status,
  defaultEmail,
  defaultPhone,
  brandHref,
  themeHref,
  seoHref,
  domainHref,
  faviconUrl,
  forms,
  initial,
}: {
  websiteId: string;
  status: "draft" | "published" | "unpublished";
  defaultEmail: string;
  defaultPhone: string;
  brandHref: string;
  themeHref: string;
  seoHref: string;
  domainHref: string;
  faviconUrl: string | null;
  forms: Array<{ id: string; name: string }>;
  initial: SettingsState;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const localeRouter = useLocaleRouter();
  const [state, setState] = useState<SettingsState>(initial);
  // Favicon persists independently on upload (like Brand Studio); keep its URL in
  // local state just to reflect the current image — it isn't part of the Save.
  const [favicon, setFavicon] = useState<string | null>(faviconUrl);
  // CAPI token — write-only; blank keeps the current token (never loaded here).
  const [capiToken, setCapiToken] = useState("");
  const [saving, startSave] = useTransition();
  const [lifecycle, startLifecycle] = useTransition();

  const set = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) => setState((s) => ({ ...s, [key]: value }));

  const isLive = status === "published";

  function onSave() {
    const emailTo =
      state.enquiryEmailEnabled && !state.enquiryEmailTo.trim()
        ? defaultEmail.trim()
        : state.enquiryEmailTo.trim();
    const whatsappNumber =
      state.whatsappEnabled && !state.whatsappNumber.trim()
        ? defaultPhone.trim()
        : state.whatsappNumber.trim();
    startSave(async () => {
      const res = await saveWebsiteSettingsAction({
        websiteId,
        brandName: state.brandName.trim(),
        brandTagline: state.brandTagline.trim(),
        enquiryEmailEnabled: state.enquiryEmailEnabled,
        enquiryEmailTo: emailTo,
        payPaystackEnabled: state.payPaystackEnabled,
        payEftEnabled: state.payEftEnabled,
        whatsappEnabled: state.whatsappEnabled,
        whatsappNumber,
        whatsappMessage: state.whatsappMessage.trim(),
        announcementEnabled: state.announcementEnabled,
        announcementText: state.announcementText.trim(),
        announcementLinkLabel: state.announcementLinkLabel.trim(),
        announcementLinkHref: state.announcementLinkHref.trim(),
        popupEnabled: state.popupEnabled,
        popupHeading: state.popupHeading.trim(),
        popupBody: state.popupBody.trim(),
        popupTrigger: state.popupTrigger,
        popupDelaySeconds: state.popupDelaySeconds,
        popupScrollPercent: state.popupScrollPercent,
        popupFrequency: state.popupFrequency,
        popupCtaLabel: state.popupCtaLabel.trim(),
        popupCtaHref: state.popupCtaHref.trim(),
        popupFormId: state.popupFormId,
        ga4MeasurementId: state.ga4MeasurementId.trim(),
        metaPixelId: state.metaPixelId.trim(),
        gtmId: state.gtmId.trim(),
        tiktokId: state.tiktokId.trim(),
        googleAdsId: state.googleAdsId.trim(),
        cookieConsentEnabled: state.cookieConsentEnabled,
        cookieConsentMessage: state.cookieConsentMessage.trim(),
        privacyPolicyHref: state.privacyPolicyHref.trim(),
        metaCapiToken: capiToken.trim(),
        metaCapiEnabled: state.metaCapiEnabled,
        blogHeading: state.blogHeading.trim(),
        blogIntro: state.blogIntro.trim(),
        socialRail: { enabled: state.socialRail.enabled },
      });
      if (!res.ok) {
        toast.error(
          res.error === "invalid" ? t("settingsInvalid") : t("saveError"),
        );
        return;
      }
      toast.success(t("settingsSaved"));
      setCapiToken("");
      router.refresh();
    });
  }

  function onDelete() {
    startLifecycle(async () => {
      const ok = await modal.destructive({
        title: t("settingsDeleteTitle"),
        description: t("settingsDeleteBody"),
        confirmLabel: t("settingsDeleteConfirm"),
      });
      if (!ok) return;
      const res = await deleteWebsiteAction(websiteId);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("settingsDeleted"));
      localeRouter.push("/dashboard/website");
    });
  }

  // TEST/RESET — hard-delete the site so the business is back to no-site and the
  // setup wizard can be run again from scratch (frees business_id + subdomain).
  function onReset() {
    startLifecycle(async () => {
      const ok = await modal.destructive({
        title: "Delete site & start over?",
        description:
          "This permanently deletes this website and everything in it (pages, forms, media, settings), freeing the business so you can run the setup wizard again from scratch. This cannot be undone. Intended for testing.",
        confirmLabel: "Delete & start over",
      });
      if (!ok) return;
      const res = await resetWebsiteForTestingAction(websiteId);
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success("Site deleted — you can run the wizard again.");
      localeRouter.push("/dashboard/website");
    });
  }

  function onPublishToggle() {
    startLifecycle(async () => {
      if (isLive) {
        const ok = await modal.destructive({
          title: t("takeOfflineTitle"),
          description: t("takeOfflineBody"),
          confirmLabel: t("takeOfflineConfirm"),
        });
        if (!ok) return;
        const res = await unpublishWebsiteAction(websiteId);
        if (!res.ok) {
          toast.error(t("saveError"));
          return;
        }
        toast.success(t("siteOffline"));
      } else {
        const res = await publishWebsiteAction(websiteId);
        if (!res.ok) {
          toast.error(t("publishError"));
          return;
        }
        toast.success(t("sitePublished"));
      }
      router.refresh();
    });
  }

  return (
    <div className="wielo-cms wrap-set mx-auto">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1
            className="font-display text-[20px] font-extrabold"
            style={{ color: "var(--ink)" }}
          >
            {t("settingsHeading")}
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--mute)" }}>
            {t("settingsSub")}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
          style={
            isLive
              ? { background: "#ECFDF5", color: "#047857" }
              : status === "unpublished"
                ? { background: "#FEF2F2", color: "#B91C1C" }
                : { background: "#FEF9C3", color: "#A16207" }
          }
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
          {isLive
            ? t("statusLive")
            : status === "unpublished"
              ? t("statusUnpublished")
              : t("statusDraft")}
        </span>
        <button
          type="button"
          className="btn btn-primary btn-sm ml-auto"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2
              className="animate-spin"
              style={{ width: 15, height: 15 }}
            />
          ) : (
            <Check style={{ width: 15, height: 15 }} />
          )}
          {t("settingsSaveCta")}
        </button>
      </div>

      {/* BRANDING — managed in Brand Studio */}
      <Sblock
        icon={Palette}
        title={t("settingsBrandingTitle")}
        desc={t("settingsBrandingDesc")}
      >
        <Setrow title={t("settingsSiteNameRow")} col>
          <input
            className="field"
            value={state.brandName}
            onChange={(e) => set("brandName", e.target.value)}
            maxLength={120}
            placeholder={t("settingsSiteNamePh")}
          />
        </Setrow>
        <Setrow title={t("settingsTaglineRow")} col>
          <input
            className="field"
            value={state.brandTagline}
            onChange={(e) => set("brandTagline", e.target.value)}
            maxLength={200}
            placeholder={t("settingsTaglinePh")}
          />
        </Setrow>
        <Setrow title={t("settingsFaviconRow")} desc={t("settingsFaviconDesc")}>
          <AssetUploader
            websiteId={websiteId}
            slot="favicon"
            url={favicon}
            onChange={setFavicon}
          />
        </Setrow>
        <Setrow title={t("settingsThemeRow")} desc={t("settingsThemeRowDesc")}>
          <Link href={brandHref} className="btn btn-ghost btn-sm">
            <Paintbrush
              style={{ width: 14, height: 14, color: "var(--mute)" }}
            />
            {t("settingsOpenBrand")}
          </Link>
        </Setrow>
        <Setrow
          title={t("settingsThemesRow")}
          desc={t("settingsThemesRowDesc")}
        >
          <Link href={themeHref} className="btn btn-ghost btn-sm">
            <Palette style={{ width: 14, height: 14, color: "var(--mute)" }} />
            {t("settingsOpenThemes")}
          </Link>
        </Setrow>
      </Sblock>

      {/* BLOG — the /blog index page heading + intro (generic themes) */}
      <Sblock
        icon={Newspaper}
        title={t("settingsBlogTitle")}
        desc={t("settingsBlogDesc")}
      >
        <Setrow title={t("settingsBlogHeadingRow")} col>
          <input
            className="field"
            value={state.blogHeading}
            onChange={(e) => set("blogHeading", e.target.value)}
            maxLength={80}
            placeholder={t("settingsBlogHeadingPh")}
          />
        </Setrow>
        <Setrow
          title={t("settingsBlogIntroRow")}
          desc={t("settingsBlogIntroDesc")}
          col
        >
          <input
            className="field"
            value={state.blogIntro}
            onChange={(e) => set("blogIntro", e.target.value)}
            maxLength={200}
            placeholder={t("settingsBlogIntroPh")}
          />
        </Setrow>
      </Sblock>

      {/* ENQUIRIES */}
      <Sblock
        icon={Sparkles}
        title={t("settingsEnquiriesTitle")}
        desc={t("settingsEnquiriesDesc")}
      >
        <Setrow title={t("settingsEmailToggle")} desc={t("settingsEmailHint")}>
          <Sw
            on={state.enquiryEmailEnabled}
            onChange={(v) => set("enquiryEmailEnabled", v)}
          />
        </Setrow>
        {state.enquiryEmailEnabled ? (
          <Setrow title={t("settingsEmailTo")} col>
            <input
              className="field"
              type="email"
              value={state.enquiryEmailTo}
              placeholder={defaultEmail || "you@example.com"}
              maxLength={160}
              onChange={(e) => set("enquiryEmailTo", e.target.value)}
            />
          </Setrow>
        ) : null}
      </Sblock>

      {/* BOOKING PAYMENTS */}
      <Sblock
        icon={CreditCard}
        title={t("settingsPaymentsTitle")}
        desc={t("settingsPaymentsDesc")}
      >
        <Setrow
          title={t("settingsPayPaystack")}
          desc={t("settingsPayPaystackHint")}
        >
          <Sw
            on={state.payPaystackEnabled}
            onChange={(v) => set("payPaystackEnabled", v)}
          />
        </Setrow>
        <Setrow title={t("settingsPayEft")} desc={t("settingsPayEftHint")}>
          <Sw
            on={state.payEftEnabled}
            onChange={(v) => set("payEftEnabled", v)}
          />
        </Setrow>
      </Sblock>

      {/* WHATSAPP */}
      <Sblock
        icon={MessageCircle}
        title={t("settingsWhatsappTitle")}
        desc={t("settingsWhatsappDesc")}
      >
        <Setrow title={t("settingsWhatsappToggle")}>
          <Sw
            on={state.whatsappEnabled}
            onChange={(v) => set("whatsappEnabled", v)}
          />
        </Setrow>
        {state.whatsappEnabled ? (
          <>
            <Setrow title={t("settingsWhatsappNumber")} col>
              <input
                className="field"
                value={state.whatsappNumber}
                placeholder={defaultPhone || "+27 82 123 4567"}
                maxLength={32}
                onChange={(e) => set("whatsappNumber", e.target.value)}
              />
            </Setrow>
            <Setrow title={t("settingsWhatsappMessage")} col>
              <textarea
                className="field"
                value={state.whatsappMessage}
                placeholder={t("settingsWhatsappMessagePlaceholder")}
                maxLength={300}
                onChange={(e) => set("whatsappMessage", e.target.value)}
              />
            </Setrow>
          </>
        ) : null}
      </Sblock>

      {/* ANNOUNCEMENT */}
      <Sblock
        icon={Megaphone}
        title={t("settingsAnnouncementTitle")}
        desc={t("settingsAnnouncementDesc")}
      >
        <Setrow title={t("settingsAnnouncementToggle")}>
          <Sw
            on={state.announcementEnabled}
            onChange={(v) => set("announcementEnabled", v)}
          />
        </Setrow>
        {state.announcementEnabled ? (
          <>
            <Setrow title={t("settingsAnnouncementText")} col>
              <input
                className="field"
                value={state.announcementText}
                placeholder={t("settingsAnnouncementTextPlaceholder")}
                maxLength={200}
                onChange={(e) => set("announcementText", e.target.value)}
              />
            </Setrow>
            <Setrow title={t("settingsAnnouncementLinkLabel")} col>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="field"
                  value={state.announcementLinkLabel}
                  placeholder={t("settingsAnnouncementLinkLabelPlaceholder")}
                  maxLength={60}
                  onChange={(e) => set("announcementLinkLabel", e.target.value)}
                />
                <input
                  className="field"
                  value={state.announcementLinkHref}
                  placeholder="/contact"
                  maxLength={300}
                  onChange={(e) => set("announcementLinkHref", e.target.value)}
                />
              </div>
            </Setrow>
          </>
        ) : null}
      </Sblock>

      {/* SOCIAL MEDIA RAIL */}
      <Sblock
        icon={Share2}
        title="Social media rail"
        desc="A floating bar of your social links, shown on every public page."
      >
        <Setrow
          title="Show the social media rail"
          desc="Show a floating bar of your social links on every page. Uses the social links from your brand settings."
        >
          <Sw
            on={state.socialRail.enabled}
            onChange={(v) => set("socialRail", { enabled: v })}
          />
        </Setrow>
      </Sblock>

      {/* POP-UP */}
      <Sblock
        icon={Bell}
        title={t("settingsPopupTitle")}
        desc={t("settingsPopupDesc")}
      >
        <Setrow title={t("settingsPopupToggle")}>
          <Sw
            on={state.popupEnabled}
            onChange={(v) => set("popupEnabled", v)}
          />
        </Setrow>
        {state.popupEnabled ? (
          <>
            <Setrow title={t("settingsPopupHeading")} col>
              <input
                className="field"
                value={state.popupHeading}
                placeholder={t("settingsPopupHeadingPlaceholder")}
                maxLength={120}
                onChange={(e) => set("popupHeading", e.target.value)}
              />
            </Setrow>
            <Setrow title={t("settingsPopupBody")} col>
              <textarea
                className="field"
                value={state.popupBody}
                placeholder={t("settingsPopupBodyPlaceholder")}
                maxLength={400}
                onChange={(e) => set("popupBody", e.target.value)}
              />
            </Setrow>
            <Setrow title={t("settingsPopupTrigger")} col>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="field"
                  value={state.popupTrigger}
                  onChange={(e) =>
                    set("popupTrigger", e.target.value as PopupTrigger)
                  }
                >
                  <option value="delay">
                    {t("settingsPopupTriggerDelay")}
                  </option>
                  <option value="scroll">
                    {t("settingsPopupTriggerScroll")}
                  </option>
                  <option value="exit">{t("settingsPopupTriggerExit")}</option>
                </select>
                {state.popupTrigger === "delay" ? (
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={120}
                    value={state.popupDelaySeconds}
                    onChange={(e) =>
                      set("popupDelaySeconds", Number(e.target.value))
                    }
                  />
                ) : state.popupTrigger === "scroll" ? (
                  <input
                    className="field"
                    type="number"
                    min={5}
                    max={100}
                    value={state.popupScrollPercent}
                    onChange={(e) =>
                      set("popupScrollPercent", Number(e.target.value))
                    }
                  />
                ) : null}
              </div>
            </Setrow>
            <Setrow title={t("settingsPopupFrequency")} col>
              <select
                className="field"
                value={state.popupFrequency}
                onChange={(e) =>
                  set("popupFrequency", e.target.value as PopupFrequency)
                }
              >
                <option value="once">{t("settingsPopupFreqOnce")}</option>
                <option value="daily">{t("settingsPopupFreqDaily")}</option>
                <option value="always">{t("settingsPopupFreqAlways")}</option>
              </select>
            </Setrow>
            <Setrow title={t("settingsPopupForm")} col>
              <select
                className="field"
                value={state.popupFormId}
                onChange={(e) => set("popupFormId", e.target.value)}
              >
                <option value="">{t("settingsPopupFormNone")}</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Setrow>
            {!state.popupFormId ? (
              <Setrow title={t("settingsPopupCtaLabel")} col>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="field"
                    value={state.popupCtaLabel}
                    placeholder={t("settingsPopupCtaLabelPlaceholder")}
                    maxLength={60}
                    onChange={(e) => set("popupCtaLabel", e.target.value)}
                  />
                  <input
                    className="field"
                    value={state.popupCtaHref}
                    placeholder="/contact"
                    maxLength={300}
                    onChange={(e) => set("popupCtaHref", e.target.value)}
                  />
                </div>
              </Setrow>
            ) : null}
          </>
        ) : null}
      </Sblock>

      {/* ANALYTICS & TRACKING */}
      <Sblock
        icon={BarChart3}
        title={t("settingsAnalyticsTitle")}
        desc={t("settingsAnalyticsDesc")}
      >
        <Setrow title={t("settingsGa4Row")} desc={t("settingsGa4Desc")} col>
          <input
            className="field mono"
            value={state.ga4MeasurementId}
            placeholder="G-XXXXXXXXXX"
            maxLength={20}
            onChange={(e) => set("ga4MeasurementId", e.target.value)}
          />
        </Setrow>
        <Setrow title={t("settingsPixelRow")} desc={t("settingsPixelDesc")} col>
          <input
            className="field mono"
            value={state.metaPixelId}
            placeholder="123456789012345"
            maxLength={20}
            onChange={(e) => set("metaPixelId", e.target.value)}
          />
        </Setrow>
        <Setrow
          title="Google Tag Manager"
          desc="Your GTM container ID — applies to every page."
          col
        >
          <input
            className="field mono"
            value={state.gtmId}
            placeholder="GTM-XXXXXXX"
            maxLength={20}
            onChange={(e) => set("gtmId", e.target.value)}
          />
        </Setrow>
        <Setrow
          title="TikTok Pixel"
          desc="Your TikTok pixel ID — applies to every page."
          col
        >
          <input
            className="field mono"
            value={state.tiktokId}
            placeholder="CXXXXXXXXXXXXXXXXXXX"
            maxLength={40}
            onChange={(e) => set("tiktokId", e.target.value)}
          />
        </Setrow>
        <Setrow
          title="Google Ads conversion"
          desc="Your Google Ads conversion ID — applies to every page."
          col
        >
          <input
            className="field mono"
            value={state.googleAdsId}
            placeholder="AW-XXXXXXXXX"
            maxLength={20}
            onChange={(e) => set("googleAdsId", e.target.value)}
          />
        </Setrow>
        <Setrow
          title={t("settingsConsentToggle")}
          desc={t("settingsConsentDesc")}
        >
          <Sw
            on={state.cookieConsentEnabled}
            onChange={(v) => set("cookieConsentEnabled", v)}
          />
        </Setrow>
        {state.cookieConsentEnabled ? (
          <>
            <Setrow title={t("settingsConsentMessage")} col>
              <input
                className="field"
                value={state.cookieConsentMessage}
                placeholder={t("settingsConsentMessagePlaceholder")}
                maxLength={300}
                onChange={(e) => set("cookieConsentMessage", e.target.value)}
              />
            </Setrow>
            <Setrow title={t("settingsPrivacyHref")} col>
              <input
                className="field"
                value={state.privacyPolicyHref}
                placeholder="/privacy"
                maxLength={300}
                onChange={(e) => set("privacyPolicyHref", e.target.value)}
              />
            </Setrow>
          </>
        ) : null}
        <Setrow
          title="Meta Conversions API"
          desc="Send server-side Purchase events (deduped with your Meta Pixel above) — better match rates, survives ad-blockers. Uses your Meta Pixel ID."
        >
          <Sw
            on={state.metaCapiEnabled}
            onChange={(v) => set("metaCapiEnabled", v)}
          />
        </Setrow>
        {state.metaCapiEnabled ? (
          <Setrow
            title="CAPI access token"
            desc="Meta Events Manager → Settings → Conversions API → Generate access token. Stored encrypted, never shown again."
            col
          >
            <input
              type="password"
              className="field mono"
              value={capiToken}
              autoComplete="off"
              placeholder={
                state.capiTokenSet
                  ? "•••••••••• (a token is on file — leave blank to keep it)"
                  : "Paste your CAPI access token"
              }
              maxLength={400}
              onChange={(e) => setCapiToken(e.target.value)}
            />
          </Setrow>
        ) : null}
      </Sblock>

      {/* ACCESS */}
      <Sblock
        icon={ArrowUpRight}
        title={t("settingsAccessTitle")}
        desc={t("settingsAccessDesc")}
      >
        <Setrow
          title={t("settingsIndexingRow")}
          desc={t("settingsIndexingDesc")}
        >
          <Link href={seoHref} className="btn btn-ghost btn-sm">
            {t("settingsOpenSeo")}
            <ArrowUpRight
              style={{ width: 14, height: 14, color: "var(--mute)" }}
            />
          </Link>
        </Setrow>
        <Setrow title={t("settingsDomainRow")} desc={t("settingsDomainDesc")}>
          <Link href={domainHref} className="btn btn-ghost btn-sm">
            {t("settingsOpenDomain")}
            <ArrowUpRight
              style={{ width: 14, height: 14, color: "var(--mute)" }}
            />
          </Link>
        </Setrow>
      </Sblock>

      {/* DANGER ZONE */}
      <Sblock
        icon={ShieldAlert}
        title={t("settingsDangerTitle")}
        desc={t("settingsDangerDesc")}
        danger
      >
        <Setrow
          title={isLive ? t("settingsUnpublishRow") : t("settingsPublishRow")}
          desc={isLive ? t("settingsUnpublishDesc") : t("settingsPublishDesc")}
        >
          <button
            type="button"
            className={
              isLive ? "btn btn-sm btn-danger" : "btn btn-sm btn-primary"
            }
            onClick={onPublishToggle}
            disabled={lifecycle}
          >
            {lifecycle ? (
              <Loader2
                className="animate-spin"
                style={{ width: 14, height: 14 }}
              />
            ) : isLive ? null : (
              <Rocket style={{ width: 14, height: 14 }} />
            )}
            {isLive ? t("takeOfflineCta") : t("publishCta")}
          </button>
        </Setrow>
        <Setrow title={t("settingsDeleteRow")} desc={t("settingsDeleteDesc")}>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={onDelete}
            disabled={lifecycle}
          >
            {lifecycle ? (
              <Loader2
                className="animate-spin"
                style={{ width: 14, height: 14 }}
              />
            ) : (
              <Trash2 style={{ width: 14, height: 14 }} />
            )}
            {t("settingsDeleteCta")}
          </button>
        </Setrow>
        <Setrow
          title="Delete & start over (testing)"
          desc="Permanently delete this site and reset the business so you can run the setup wizard again from scratch. Frees the subdomain. Cannot be undone."
        >
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={onReset}
            disabled={lifecycle}
          >
            {lifecycle ? (
              <Loader2
                className="animate-spin"
                style={{ width: 14, height: 14 }}
              />
            ) : (
              <Trash2 style={{ width: 14, height: 14 }} />
            )}
            Delete &amp; start over
          </button>
        </Setrow>
      </Sblock>
    </div>
  );
}
