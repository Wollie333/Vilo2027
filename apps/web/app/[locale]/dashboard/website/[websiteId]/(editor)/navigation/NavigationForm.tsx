"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { saveNavigationAction } from "@/app/[locale]/dashboard/website/actions";
import type { NavigationConfig } from "@/app/[locale]/dashboard/website/schemas";
import type { SiteMenuItem } from "@/lib/site/types";

import { TextField, ToggleField } from "../pages/[pageId]/_components/fields";
import { MenuBuilder, type PageOption } from "./MenuBuilder";

export function NavigationForm({
  websiteId,
  initial,
  pages,
}: {
  websiteId: string;
  initial: NavigationConfig;
  pages: PageOption[];
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [nav, setNav] = useState<NavigationConfig>(initial);
  const [saving, startSave] = useTransition();

  const setTop = (patch: Partial<NavigationConfig["topBar"]>) =>
    setNav((n) => ({ ...n, topBar: { ...n.topBar, ...patch } }));
  const setHeader = (patch: Partial<NavigationConfig["header"]>) =>
    setNav((n) => ({ ...n, header: { ...n.header, ...patch } }));
  const setFooter = (patch: Partial<NavigationConfig["footer"]>) =>
    setNav((n) => ({ ...n, footer: { ...n.footer, ...patch } }));
  const setMenu = (menu: SiteMenuItem[]) => setNav((n) => ({ ...n, menu }));

  function onSave() {
    startSave(async () => {
      const res = await saveNavigationAction({ websiteId, navigation: nav });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("navSaved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <MenuBuilder menu={nav.menu} pages={pages} onChange={setMenu} />

      {/* Top bar */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("navTopBarTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">
            {t("navTopBarDesc")}
          </p>
        </div>
        <ToggleField
          label={t("navTopBarEnable")}
          checked={nav.topBar.enabled}
          onChange={(v) => setTop({ enabled: v })}
        />
        {nav.topBar.enabled ? (
          <>
            <TextField
              label={t("navMessage")}
              value={nav.topBar.message ?? ""}
              onChange={(v) => setTop({ message: v })}
              maxLength={160}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t("navPhone")}
                value={nav.topBar.phone ?? ""}
                onChange={(v) => setTop({ phone: v })}
                maxLength={40}
              />
              <TextField
                label={t("navWhatsapp")}
                value={nav.topBar.whatsapp ?? ""}
                onChange={(v) => setTop({ whatsapp: v })}
                maxLength={40}
                hint={t("navWhatsappHint")}
              />
            </div>
            <TextField
              label={t("navEmail")}
              value={nav.topBar.email ?? ""}
              onChange={(v) => setTop({ email: v })}
              maxLength={200}
            />
          </>
        ) : null}
      </section>

      {/* Header */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink">
            {t("navHeaderTitle")}
          </h3>
          <p className="mt-1 text-[13px] text-brand-mute">
            {t("navHeaderDesc")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("navCtaLabel")}
            value={nav.header.ctaLabel ?? ""}
            onChange={(v) => setHeader({ ctaLabel: v })}
            maxLength={40}
            placeholder="Book now"
          />
          <TextField
            label={t("navCtaHref")}
            value={nav.header.ctaHref ?? ""}
            onChange={(v) => setHeader({ ctaHref: v })}
            maxLength={500}
            hint={t("navCtaHrefHint")}
          />
        </div>
        <ToggleField
          label={t("navSticky")}
          checked={nav.header.sticky}
          onChange={(v) => setHeader({ sticky: v })}
        />
      </section>

      {/* Footer */}
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-6 shadow-card">
        <h3 className="text-sm font-semibold text-brand-ink">
          {t("navFooterTitle")}
        </h3>
        <ToggleField
          label={t("navPoweredBy")}
          checked={nav.footer.showPoweredBy}
          onChange={(v) => setFooter({ showPoweredBy: v })}
        />
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
