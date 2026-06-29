"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { NavigationConfig } from "@/app/[locale]/dashboard/website/schemas";
import type { SiteFooterColumn } from "@/lib/site/types";

import { FooterBuilder } from "./FooterBuilder";
import type { PageOption } from "./MenuBuilder";
import { ThemeColorPicker } from "@/components/ui/ThemeColorPicker";

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

/** A colour swatch + value + reset, for optional colour overrides. */
function ColorRow({
  label,
  value,
  fallback = "#000000",
  swatches = [],
  onChange,
}: {
  label: string;
  value?: string | null;
  fallback?: string;
  swatches?: string[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <Fld label={label}>
      <ThemeColorPicker
        value={value ?? undefined}
        fallback={fallback}
        swatches={swatches}
        onChange={(v) => onChange(v)}
        onReset={() => onChange(undefined)}
      />
    </Fld>
  );
}

export function HeaderInspector({
  nav,
  setHeader,
  setTop,
  pages = [],
  transparentDefault = false,
  swatches = [],
}: {
  nav: NavigationConfig;
  setHeader: (p: Partial<NavigationConfig["header"]>) => void;
  setTop: (p: Partial<NavigationConfig["topBar"]>) => void;
  /** In-nav pages, so the Book button can link to a page (or a custom URL). */
  pages?: PageOption[];
  /** Theme colours (Brand Studio) for the colour pickers' preset swatches. */
  swatches?: string[];
  /** Theme's natural transparent-over-hero default when the host hasn't chosen
   *  (Safari is transparent by design; generic themes are solid). Drives the
   *  toggle's displayed state so it matches what actually renders. */
  transparentDefault?: boolean;
}) {
  const transparentOn = nav.header.transparentOverHero ?? transparentDefault;
  const t = useTranslations("website");
  return (
    <>
      <div className="insp-sec">
        <div className="isec-t">{t("navBrandTitle")}</div>
        <Fld label={t("navHeaderTagline")}>
          <input
            type="text"
            value={nav.header.tagline ?? ""}
            maxLength={80}
            placeholder={t("navHeaderTaglinePh")}
            onChange={(e) => setHeader({ tagline: e.target.value })}
          />
        </Fld>
      </div>
      <div className="insp-sec">
        <div className="isec-t">{t("navCtaTitle")}</div>
        <Toggle
          label={t("navShowBookCta")}
          on={nav.header.showBookCta !== false}
          onClick={() =>
            setHeader({ showBookCta: nav.header.showBookCta === false })
          }
        />
        {nav.header.showBookCta !== false ? (
          <>
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
            {pages.length > 0 ? (
              <Fld label={t("navCtaPage")}>
                <select
                  value=""
                  onChange={(e) => {
                    const p = pages.find((x) => x.href === e.target.value);
                    if (p) setHeader({ ctaHref: p.href });
                    e.target.value = "";
                  }}
                >
                  <option value="">{t("menuPickPage")}</option>
                  {pages.map((p) => (
                    <option key={p.href} value={p.href}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Fld>
            ) : null}
            <ColorRow
              label={t("navCtaColor")}
              value={nav.header.bookCtaColor}
              fallback="#0f172a"
              swatches={swatches}
              onChange={(v) => setHeader({ bookCtaColor: v })}
            />
            <p className="mt-1 text-[11.5px] text-brand-mute">
              {t("navBookCtaHint")}
            </p>
          </>
        ) : null}
      </div>
      <div className="insp-sec">
        <div className="isec-t">{t("navElementsTitle")}</div>
        <Toggle
          label={t("navShowLogo")}
          on={nav.header.showLogo !== false}
          onClick={() => setHeader({ showLogo: nav.header.showLogo === false })}
        />
        {nav.header.showLogo !== false ? (
          <>
            <Fld label={t("navLogoStyle")}>
              <select
                value={nav.header.logoStyle ?? ""}
                onChange={(e) =>
                  setHeader({
                    logoStyle:
                      (e.target.value as "wordmark" | "icon" | "mark") ||
                      undefined,
                  })
                }
              >
                <option value="">{t("navLogoStyleDefault")}</option>
                <option value="mark">{t("navLogoStyle_mark")}</option>
                <option value="wordmark">{t("navLogoStyle_wordmark")}</option>
                <option value="icon">{t("navLogoStyle_icon")}</option>
              </select>
            </Fld>
            <Fld label={t("navLogoHeight")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={16}
                  max={96}
                  value={nav.header.logoMaxHeight ?? 40}
                  onChange={(e) =>
                    setHeader({ logoMaxHeight: Number(e.target.value) })
                  }
                  style={{ flex: 1 }}
                />
                <span className="text-[12px] tabular-nums text-brand-mute">
                  {nav.header.logoMaxHeight ?? 40}px
                </span>
              </div>
            </Fld>
          </>
        ) : null}
        <p className="mt-1 text-[11.5px] text-brand-mute">{t("navLogoHint")}</p>
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
          on={transparentOn}
          onClick={() => setHeader({ transparentOverHero: !transparentOn })}
        />
        {transparentOn ? (
          <>
            <ColorRow
              label={t("navScrolledBg")}
              value={nav.header.scrolledBgColor}
              fallback="#181715"
              swatches={swatches}
              onChange={(v) => setHeader({ scrolledBgColor: v })}
            />
            <p className="mt-1 text-[11.5px] text-brand-mute">
              {t("navScrolledBgHint")}
            </p>
            <ColorRow
              label={t("navScrolledBorder")}
              value={nav.header.scrolledBorderColor}
              fallback="#e2e2e2"
              swatches={swatches}
              onChange={(v) => setHeader({ scrolledBorderColor: v })}
            />
          </>
        ) : (
          <ColorRow
            label={t("navHeaderBg")}
            value={nav.header.bgColor}
            fallback="#ffffff"
            swatches={swatches}
            onChange={(v) => setHeader({ bgColor: v })}
          />
        )}
        {/* "Collapse menu" lives in the Menu builder (Layout tab) — it's a menu
            concern, not a header-container one. */}
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
  const nl = nav.footer.newsletter;
  const nlOn = nl?.enabled !== false;
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
        <div className="isec-t">{t("navFooterNewsletter")}</div>
        <Toggle
          label={t("navFooterNewsletterShow")}
          on={nlOn}
          onClick={() => setFooter({ newsletter: { ...nl, enabled: !nlOn } })}
        />
        {nlOn ? (
          <>
            <Fld label={t("navFooterNewsletterHeading")}>
              <input
                type="text"
                value={nl?.heading ?? ""}
                maxLength={80}
                placeholder={t("navFooterNewsletterHeadingPh")}
                onChange={(e) =>
                  setFooter({
                    newsletter: {
                      ...nl,
                      enabled: nlOn,
                      heading: e.target.value,
                    },
                  })
                }
              />
            </Fld>
            <Fld label={t("navFooterNewsletterBody")}>
              <textarea
                value={nl?.body ?? ""}
                maxLength={200}
                onChange={(e) =>
                  setFooter({
                    newsletter: { ...nl, enabled: nlOn, body: e.target.value },
                  })
                }
              />
            </Fld>
          </>
        ) : null}
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
