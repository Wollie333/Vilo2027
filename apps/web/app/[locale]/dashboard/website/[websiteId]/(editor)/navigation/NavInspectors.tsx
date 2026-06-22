"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { NavigationConfig } from "@/app/[locale]/dashboard/website/schemas";
import type { SiteFooterColumn } from "@/lib/site/types";

import { FooterBuilder } from "./FooterBuilder";
import type { PageOption } from "./MenuBuilder";

// Shared inspector panels for the header + footer, used by BOTH the standalone
// nav editor route and the page builder's inline chrome editing (so there's one
// implementation, no divergence). `.fld`/`.sw`/`.insp-sec` are `.vilo-builder`
// scoped, so these render in either full-screen editor.

export function Fld({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="fld">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Toggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <div className="fld">
      <div className="fld-row">
        <label style={{ margin: 0 }}>{label}</label>
        <button
          type="button"
          className={on ? "sw on" : "sw"}
          aria-pressed={on}
          onClick={onClick}
        />
      </div>
    </div>
  );
}

export function HeaderInspector({
  nav,
  setHeader,
  setTop,
}: {
  nav: NavigationConfig;
  setHeader: (p: Partial<NavigationConfig["header"]>) => void;
  setTop: (p: Partial<NavigationConfig["topBar"]>) => void;
}) {
  const t = useTranslations("website");
  return (
    <>
      <div className="insp-sec">
        <div className="isec-t">{t("navCtaTitle")}</div>
        <Fld label={t("navCtaLabel")}>
          <input
            type="text"
            value={nav.header.ctaLabel ?? ""}
            maxLength={40}
            onChange={(e) => setHeader({ ctaLabel: e.target.value })}
          />
        </Fld>
        <Fld label={t("navCtaHref")}>
          <input
            type="text"
            value={nav.header.ctaHref ?? ""}
            maxLength={500}
            onChange={(e) => setHeader({ ctaHref: e.target.value })}
          />
        </Fld>
      </div>
      <div className="insp-sec">
        <div className="isec-t">{t("navBehaviourTitle")}</div>
        <Toggle
          label={t("navSticky")}
          on={nav.header.sticky}
          onClick={() => setHeader({ sticky: !nav.header.sticky })}
        />
        <Toggle
          label={t("navTransparent")}
          on={nav.header.transparentOverHero}
          onClick={() =>
            setHeader({ transparentOverHero: !nav.header.transparentOverHero })
          }
        />
      </div>
      <div className="insp-sec">
        <div className="isec-t">{t("navTopBarTitle")}</div>
        <Toggle
          label={t("navTopBarEnable")}
          on={nav.topBar.enabled}
          onClick={() => setTop({ enabled: !nav.topBar.enabled })}
        />
        {nav.topBar.enabled ? (
          <>
            <Fld label={t("navMessage")}>
              <input
                type="text"
                value={nav.topBar.message ?? ""}
                maxLength={160}
                onChange={(e) => setTop({ message: e.target.value })}
              />
            </Fld>
            <Fld label={t("navPhone")}>
              <input
                type="text"
                value={nav.topBar.phone ?? ""}
                maxLength={40}
                onChange={(e) => setTop({ phone: e.target.value })}
              />
            </Fld>
            <Fld label={t("navEmail")}>
              <input
                type="text"
                value={nav.topBar.email ?? ""}
                maxLength={200}
                onChange={(e) => setTop({ email: e.target.value })}
              />
            </Fld>
          </>
        ) : null}
      </div>
    </>
  );
}

export function FooterInspector({
  nav,
  pages,
  setFooter,
  setColumns,
}: {
  nav: NavigationConfig;
  pages: PageOption[];
  setFooter: (p: Partial<NavigationConfig["footer"]>) => void;
  setColumns: (c: SiteFooterColumn[]) => void;
}) {
  const t = useTranslations("website");
  return (
    <>
      <div className="insp-sec">
        <div className="isec-t">{t("navFooterTitle")}</div>
        <Toggle
          label={t("navPoweredBy")}
          on={nav.footer.showPoweredBy}
          onClick={() =>
            setFooter({ showPoweredBy: !nav.footer.showPoweredBy })
          }
        />
        <Fld label={t("navCopyright")}>
          <input
            type="text"
            value={nav.footer.copyright ?? ""}
            maxLength={160}
            onChange={(e) => setFooter({ copyright: e.target.value })}
          />
        </Fld>
      </div>
      <div className="insp-sec">
        <FooterBuilder
          columns={nav.footer.columns ?? []}
          pages={pages}
          onChange={setColumns}
        />
      </div>
    </>
  );
}
