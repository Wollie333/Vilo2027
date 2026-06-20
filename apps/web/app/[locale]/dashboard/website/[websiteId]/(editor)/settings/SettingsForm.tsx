"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { saveWebsiteSettingsAction } from "@/app/[locale]/dashboard/website/actions";

import {
  NumberField,
  SelectField,
  TextArea,
  TextField,
  ToggleField,
} from "../pages/[pageId]/_components/fields";

type PopupTrigger = "delay" | "scroll" | "exit";
type PopupFrequency = "once" | "daily" | "always";

type SettingsState = {
  enquiryEmailEnabled: boolean;
  enquiryEmailTo: string;
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
};

export function SettingsForm({
  websiteId,
  defaultEmail,
  defaultPhone,
  forms,
  initial,
}: {
  websiteId: string;
  defaultEmail: string;
  defaultPhone: string;
  forms: Array<{ id: string; name: string }>;
  initial: SettingsState;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [state, setState] = useState<SettingsState>(initial);
  const [saving, startSave] = useTransition();

  const set = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) => setState((s) => ({ ...s, [key]: value }));

  function onSave() {
    // Pre-fill the address with the brand contact email the first time the host
    // turns the toggle on with nothing entered yet.
    const emailTo =
      state.enquiryEmailEnabled && !state.enquiryEmailTo.trim()
        ? defaultEmail.trim()
        : state.enquiryEmailTo.trim();
    // Likewise, seed the WhatsApp number from the brand contact phone.
    const whatsappNumber =
      state.whatsappEnabled && !state.whatsappNumber.trim()
        ? defaultPhone.trim()
        : state.whatsappNumber.trim();
    startSave(async () => {
      const res = await saveWebsiteSettingsAction({
        websiteId,
        enquiryEmailEnabled: state.enquiryEmailEnabled,
        enquiryEmailTo: emailTo,
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
      });
      if (!res.ok) {
        toast.error(
          res.error === "invalid" ? t("settingsEmailInvalid") : t("saveError"),
        );
        return;
      }
      toast.success(t("settingsSaved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("settingsEnquiriesTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">
            {t("settingsEnquiriesDesc")}
          </p>
        </div>

        <ToggleField
          label={t("settingsEmailToggle")}
          checked={state.enquiryEmailEnabled}
          onChange={(v) => set("enquiryEmailEnabled", v)}
        />

        {state.enquiryEmailEnabled ? (
          <TextField
            label={t("settingsEmailTo")}
            value={state.enquiryEmailTo}
            onChange={(v) => set("enquiryEmailTo", v)}
            placeholder={defaultEmail || "you@example.com"}
            maxLength={160}
            hint={t("settingsEmailHint")}
          />
        ) : null}
      </section>

      {/* WhatsApp click-to-chat (Phase 6A slice 2) */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("settingsWhatsappTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">
            {t("settingsWhatsappDesc")}
          </p>
        </div>

        <ToggleField
          label={t("settingsWhatsappToggle")}
          checked={state.whatsappEnabled}
          onChange={(v) => set("whatsappEnabled", v)}
        />

        {state.whatsappEnabled ? (
          <>
            <TextField
              label={t("settingsWhatsappNumber")}
              value={state.whatsappNumber}
              onChange={(v) => set("whatsappNumber", v)}
              placeholder={defaultPhone || "+27 82 123 4567"}
              maxLength={32}
              hint={t("settingsWhatsappNumberHint")}
            />
            <TextArea
              label={t("settingsWhatsappMessage")}
              value={state.whatsappMessage}
              onChange={(v) => set("whatsappMessage", v)}
              placeholder={t("settingsWhatsappMessagePlaceholder")}
              maxLength={300}
              rows={2}
              hint={t("settingsWhatsappMessageHint")}
            />
          </>
        ) : null}
      </section>

      {/* Announcement bar (Phase 6A slice 2) */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("settingsAnnouncementTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">
            {t("settingsAnnouncementDesc")}
          </p>
        </div>

        <ToggleField
          label={t("settingsAnnouncementToggle")}
          checked={state.announcementEnabled}
          onChange={(v) => set("announcementEnabled", v)}
        />

        {state.announcementEnabled ? (
          <>
            <TextField
              label={t("settingsAnnouncementText")}
              value={state.announcementText}
              onChange={(v) => set("announcementText", v)}
              placeholder={t("settingsAnnouncementTextPlaceholder")}
              maxLength={200}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t("settingsAnnouncementLinkLabel")}
                value={state.announcementLinkLabel}
                onChange={(v) => set("announcementLinkLabel", v)}
                placeholder={t("settingsAnnouncementLinkLabelPlaceholder")}
                maxLength={60}
              />
              <TextField
                label={t("settingsAnnouncementLinkHref")}
                value={state.announcementLinkHref}
                onChange={(v) => set("announcementLinkHref", v)}
                placeholder="/contact"
                maxLength={300}
                hint={t("settingsAnnouncementLinkHrefHint")}
              />
            </div>
          </>
        ) : null}
      </section>

      {/* Pop-up modal (Phase 6A slice 3) */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("settingsPopupTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">
            {t("settingsPopupDesc")}
          </p>
        </div>

        <ToggleField
          label={t("settingsPopupToggle")}
          checked={state.popupEnabled}
          onChange={(v) => set("popupEnabled", v)}
        />

        {state.popupEnabled ? (
          <>
            <TextField
              label={t("settingsPopupHeading")}
              value={state.popupHeading}
              onChange={(v) => set("popupHeading", v)}
              placeholder={t("settingsPopupHeadingPlaceholder")}
              maxLength={120}
            />
            <TextArea
              label={t("settingsPopupBody")}
              value={state.popupBody}
              onChange={(v) => set("popupBody", v)}
              placeholder={t("settingsPopupBodyPlaceholder")}
              maxLength={400}
              rows={2}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField<PopupTrigger>
                label={t("settingsPopupTrigger")}
                value={state.popupTrigger}
                onChange={(v) => set("popupTrigger", v)}
                options={[
                  { value: "delay", label: t("settingsPopupTriggerDelay") },
                  { value: "scroll", label: t("settingsPopupTriggerScroll") },
                  { value: "exit", label: t("settingsPopupTriggerExit") },
                ]}
              />
              {state.popupTrigger === "delay" ? (
                <NumberField
                  label={t("settingsPopupDelay")}
                  value={state.popupDelaySeconds}
                  onChange={(v) => set("popupDelaySeconds", v)}
                  min={0}
                  max={120}
                />
              ) : state.popupTrigger === "scroll" ? (
                <NumberField
                  label={t("settingsPopupScroll")}
                  value={state.popupScrollPercent}
                  onChange={(v) => set("popupScrollPercent", v)}
                  min={5}
                  max={100}
                />
              ) : (
                <div />
              )}
            </div>

            <SelectField<PopupFrequency>
              label={t("settingsPopupFrequency")}
              value={state.popupFrequency}
              onChange={(v) => set("popupFrequency", v)}
              options={[
                { value: "once", label: t("settingsPopupFreqOnce") },
                { value: "daily", label: t("settingsPopupFreqDaily") },
                { value: "always", label: t("settingsPopupFreqAlways") },
              ]}
            />

            <SelectField<string>
              label={t("settingsPopupForm")}
              value={state.popupFormId}
              onChange={(v) => set("popupFormId", v)}
              options={[
                { value: "", label: t("settingsPopupFormNone") },
                ...forms.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />

            {state.popupFormId ? (
              <p className="text-[13px] text-brand-mute">
                {t("settingsPopupFormHint")}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t("settingsPopupCtaLabel")}
                  value={state.popupCtaLabel}
                  onChange={(v) => set("popupCtaLabel", v)}
                  placeholder={t("settingsPopupCtaLabelPlaceholder")}
                  maxLength={60}
                />
                <TextField
                  label={t("settingsPopupCtaHref")}
                  value={state.popupCtaHref}
                  onChange={(v) => set("popupCtaHref", v)}
                  placeholder="/contact"
                  maxLength={300}
                  hint={t("settingsAnnouncementLinkHrefHint")}
                />
              </div>
            )}
          </>
        ) : null}
      </section>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t("save")}
      </button>
    </div>
  );
}
