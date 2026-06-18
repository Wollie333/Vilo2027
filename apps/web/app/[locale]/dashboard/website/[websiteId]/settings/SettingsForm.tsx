"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { saveWebsiteSettingsAction } from "@/app/[locale]/dashboard/website/actions";

import { TextField, ToggleField } from "../pages/[pageId]/_components/fields";

type SettingsState = {
  enquiryEmailEnabled: boolean;
  enquiryEmailTo: string;
};

export function SettingsForm({
  websiteId,
  defaultEmail,
  initial,
}: {
  websiteId: string;
  defaultEmail: string;
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
    startSave(async () => {
      const res = await saveWebsiteSettingsAction({
        websiteId,
        enquiryEmailEnabled: state.enquiryEmailEnabled,
        enquiryEmailTo: emailTo,
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
