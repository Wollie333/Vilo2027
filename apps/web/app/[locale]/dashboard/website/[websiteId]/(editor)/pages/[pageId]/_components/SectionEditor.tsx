"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import {
  listWebsiteBookablePropertiesAction,
  listWebsiteFormsAction,
  type WebsiteFormOption,
  type WebsitePropertyOption,
} from "@/app/[locale]/dashboard/website/actions";
import type {
  BlockSpace,
  BlockStyle,
  ColumnBlock,
  ColumnBlockKind,
  ElColor,
  ElSize,
  ElWeight,
  WebsiteSection,
} from "@/lib/website/sections.schema";

import { RichTextEditor } from "@/components/editor/RichTextEditor";

import {
  Field,
  ImageField,
  ItemListEditor,
  LiveNote,
  NumberField,
  SelectField,
  TextArea,
  TextField,
  ToggleField,
} from "./fields";

type Layout = "grid" | "list" | "carousel";
type TabKey = "content" | "style" | "advanced" | "laptop" | "mobile";

/**
 * Per-section editor: the type-specific fields (SectionFields) plus the shared
 * appearance control (colour-scheme "tone" — applies to every section type; the
 * layout "variant" lives in the per-type fields). `onChange` replaces the whole
 * (typed) section in the builder state.
 */
export function SectionEditor({
  websiteId,
  section,
  onChange,
  themePreset,
}: {
  websiteId: string;
  section: WebsiteSection;
  onChange: (next: WebsiteSection) => void;
  /** Active theme slug — gates theme-specific fields (e.g. Safari hero extras). */
  themePreset?: string;
}) {
  const t = useTranslations("website");
  const [tab, setTab] = useState<TabKey>("content");
  // On a bespoke theme (Safari) the section renders a fixed design, so instead of
  // the generic Content/Style/Advanced tabs the inspector is organised by SCREEN
  // SIZE — Desktop (the base content) · Laptop · Mobile — where each device can
  // hide the section and swap its image for that screen. The generic Style/block
  // controls (which do nothing on Safari) are dropped.
  const isSafari = themePreset === "safari";
  const tabs = (
    isSafari
      ? [
          ["content", t("inspTabDesktop")],
          ["laptop", t("inspTabLaptop")],
          ["mobile", t("inspTabMobile")],
        ]
      : [
          ["content", t("inspTabContent")],
          ["style", t("inspTabStyle")],
          ["advanced", t("inspTabAdvanced")],
        ]
  ) as ReadonlyArray<readonly [TabKey, string]>;
  // If the active tab isn't available for this theme, fall back to Content/Desktop.
  const activeTab = tabs.some(([k]) => k === tab) ? tab : "content";
  return (
    <div className="space-y-4">
      {/* Tabs keep the inspector confined: Content (what it says) · Style
          (colour, type, spacing, frame) · Advanced (visibility, schedule). */}
      <div
        role="tablist"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        }}
        className="overflow-hidden rounded-[10px] border border-brand-line"
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setTab(key)}
            className={`px-2 py-1.5 text-[12.5px] font-semibold transition ${
              activeTab === key
                ? "bg-brand-light text-brand-secondary"
                : "bg-white text-brand-mute hover:text-brand-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "laptop" || activeTab === "mobile" ? (
        <ResponsiveDeviceFields
          device={activeTab}
          websiteId={websiteId}
          section={section}
          onChange={onChange}
          themePreset={themePreset}
        />
      ) : activeTab === "content" ? (
        <SectionFields
          websiteId={websiteId}
          section={section}
          onChange={onChange}
          themePreset={themePreset}
        />
      ) : activeTab === "style" ? (
        <div className="space-y-4">
          <SelectField
            label={t("fldTone")}
            value={section.tone}
            options={[
              { value: "default", label: t("tone_default") },
              { value: "accent", label: t("tone_accent") },
              { value: "dark", label: t("tone_dark") },
              { value: "muted", label: t("tone_muted") },
            ]}
            onChange={(tone) => onChange({ ...section, tone })}
          />
          <BlockStyleEditor section={section} onChange={onChange} />
        </div>
      ) : (
        <div className="space-y-4">
          {!isSafari ? (
            <SelectField
              label={t("fldVisibility")}
              value={section.visibility ?? "all"}
              options={[
                { value: "all", label: t("visibility_all") },
                { value: "desktop", label: t("visibility_desktop") },
                { value: "mobile", label: t("visibility_mobile") },
              ]}
              onChange={(v) => onChange({ ...section, visibility: v })}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-medium text-brand-mute">
                {t("fldScheduleStart")}
              </span>
              <input
                type="date"
                value={section.schedule?.start ?? ""}
                onChange={(e) =>
                  onChange({
                    ...section,
                    schedule: {
                      ...section.schedule,
                      start: e.target.value || undefined,
                    },
                  })
                }
                className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-brand-mute">
                {t("fldScheduleEnd")}
              </span>
              <input
                type="date"
                value={section.schedule?.end ?? ""}
                onChange={(e) =>
                  onChange({
                    ...section,
                    schedule: {
                      ...section.schedule,
                      end: e.target.value || undefined,
                    },
                  })
                }
                className="mt-1 w-full rounded-[8px] border border-brand-line bg-white px-2.5 py-1.5 text-[13px] text-brand-ink outline-none focus:border-brand-primary"
              />
            </label>
          </div>
          <p className="text-[11.5px] leading-snug text-brand-mute">
            {t("scheduleHint")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Per-block responsive style: an optional background colour + desktop/tablet/
 * mobile spacing overrides (top/bottom). Self-contained device sub-toggle so it
 * works in both builders without threading the canvas device state in.
 */
function BlockStyleEditor({
  section,
  onChange,
}: {
  section: WebsiteSection;
  onChange: (next: WebsiteSection) => void;
}) {
  const t = useTranslations("website");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const style = section.style ?? {};
  const vp = style[device] ?? {};

  const setVp = (patch: {
    padTop?: string;
    padBottom?: string;
    padX?: string;
  }) => {
    const next = { ...vp, ...patch };
    // Drop empty ("default") entries so the JSON stays lean.
    if (!next.padTop) delete next.padTop;
    if (!next.padBottom) delete next.padBottom;
    if (!next.padX) delete next.padX;
    const hasAny = next.padTop || next.padBottom || next.padX;
    onChange({
      ...section,
      style: { ...style, [device]: hasAny ? next : undefined },
    });
  };
  const setBg = (bg: string | undefined) =>
    onChange({ ...section, style: { ...style, background: bg } });
  // Global frame setters (drop empty so the JSON stays lean).
  const setFrame = (patch: Partial<BlockStyle>) => {
    const next: BlockStyle = { ...style, ...patch };
    for (const k of Object.keys(patch) as Array<keyof BlockStyle>) {
      if (!next[k]) delete next[k];
    }
    onChange({ ...section, style: next });
  };

  const spaceOptions: { value: BlockSpace | ""; label: string }[] = [
    { value: "", label: t("blockDefault") },
    { value: "none", label: t("spaceNone") },
    { value: "sm", label: t("elSpacer_sm") },
    { value: "md", label: t("elSpacer_md") },
    { value: "lg", label: t("elSpacer_lg") },
    { value: "xl", label: t("elSpacer_xl") },
  ];
  const devices: Array<{ key: typeof device; label: string }> = [
    { key: "desktop", label: t("deviceDesktop") },
    { key: "tablet", label: t("deviceTablet") },
    { key: "mobile", label: t("devicePhone") },
  ];

  return (
    <div className="space-y-4 border-t border-brand-line pt-4">
      <div>
        <span className="block text-[13px] font-semibold text-brand-ink">
          {t("fldBlockStyle")}
        </span>
        <p className="mt-0.5 text-[11.5px] leading-snug text-brand-mute">
          {t("blockStyleHint")}
        </p>
      </div>

      <div className="inline-flex rounded-[10px] border border-brand-line bg-brand-light/50 p-0.5">
        {devices.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDevice(d.key)}
            className={`rounded-[8px] px-3 py-1 text-[12px] font-semibold transition ${
              device === d.key
                ? "bg-white text-brand-secondary shadow-sm"
                : "text-brand-mute hover:text-brand-ink"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SelectField
          label={t("fldPadTop")}
          value={vp.padTop ?? ""}
          options={spaceOptions}
          onChange={(v) => setVp({ padTop: v })}
        />
        <SelectField
          label={t("fldPadBottom")}
          value={vp.padBottom ?? ""}
          options={spaceOptions}
          onChange={(v) => setVp({ padBottom: v })}
        />
        <SelectField
          label={t("fldPadX")}
          value={vp.padX ?? ""}
          options={spaceOptions}
          onChange={(v) => setVp({ padX: v })}
        />
      </div>

      <div>
        <span className="block text-[13px] font-semibold text-brand-ink">
          {t("fldBlockBg")}
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="color"
            value={style.background ?? "#ffffff"}
            onChange={(e) => setBg(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-[8px] border border-brand-line bg-white"
            aria-label={t("fldBlockBg")}
          />
          <input
            value={style.background ?? ""}
            onChange={(e) => setBg(e.target.value || undefined)}
            placeholder="#FFFFFF"
            className="w-32 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
          {style.background ? (
            <button
              type="button"
              onClick={() => setBg(undefined)}
              className="text-[12px] font-medium text-brand-mute hover:text-red-600"
            >
              {t("blockBgClear")}
            </button>
          ) : null}
        </div>
      </div>

      {/* Frame — global (all viewports): margin, border, radius, max-width. */}
      <div className="space-y-3 border-t border-dashed border-brand-line pt-3">
        <span className="block text-[12px] font-semibold text-brand-ink">
          {t("blockFrame")}
        </span>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label={t("fldMarginTop")}
            value={style.marginTop ?? ""}
            options={spaceOptions}
            onChange={(v) => setFrame({ marginTop: v || undefined })}
          />
          <SelectField
            label={t("fldMarginBottom")}
            value={style.marginBottom ?? ""}
            options={spaceOptions}
            onChange={(v) => setFrame({ marginBottom: v || undefined })}
          />
          <SelectField
            label={t("fldBlockMaxWidth")}
            value={style.maxWidth ?? "full"}
            options={[
              { value: "full", label: t("blockMaxWidth_full") },
              { value: "wide", label: t("blockMaxWidth_wide") },
              { value: "medium", label: t("blockMaxWidth_medium") },
              { value: "narrow", label: t("blockMaxWidth_narrow") },
            ]}
            onChange={(v) =>
              setFrame({ maxWidth: v === "full" ? undefined : v })
            }
          />
          <SelectField
            label={t("fldSectionHeight")}
            value={style.minHeight ?? "auto"}
            options={[
              { value: "auto", label: t("secHeight_auto") },
              { value: "sm", label: t("secHeight_sm") },
              { value: "md", label: t("secHeight_md") },
              { value: "lg", label: t("secHeight_lg") },
              { value: "screen", label: t("secHeight_screen") },
            ]}
            onChange={(v) =>
              setFrame({ minHeight: v === "auto" ? undefined : v })
            }
          />
          <SelectField
            label={t("fldBlockRadius")}
            value={style.radius ?? "none"}
            options={[
              { value: "none", label: t("blockRadius_none") },
              { value: "sm", label: t("blockRadius_sm") },
              { value: "md", label: t("blockRadius_md") },
              { value: "lg", label: t("blockRadius_lg") },
              { value: "full", label: t("blockRadius_full") },
            ]}
            onChange={(v) => setFrame({ radius: v === "none" ? undefined : v })}
          />
          <SelectField
            label={t("fldBlockBorder")}
            value={style.border ?? "none"}
            options={[
              { value: "none", label: t("blockBorder_none") },
              { value: "thin", label: t("blockBorder_thin") },
              { value: "medium", label: t("blockBorder_medium") },
              { value: "thick", label: t("blockBorder_thick") },
            ]}
            onChange={(v) => setFrame({ border: v === "none" ? undefined : v })}
          />
          {style.border && style.border !== "none" ? (
            <SelectField
              label={t("fldBlockBorderColor")}
              value={style.borderColor ?? "line"}
              options={[
                { value: "line", label: t("blockBorderColor_line") },
                { value: "ink", label: t("blockBorderColor_ink") },
                { value: "accent", label: t("blockBorderColor_accent") },
              ]}
              onChange={(v) => setFrame({ borderColor: v })}
            />
          ) : null}
        </div>
      </div>

      {/* Typography — the section's text size & weight (overrides the theme). */}
      <div className="space-y-3 border-t border-dashed border-brand-line pt-3">
        <span className="block text-[12px] font-semibold text-brand-ink">
          {t("blockText")}
        </span>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label={t("fldHeadingSize")}
            value={style.headingSize ?? ""}
            options={[
              { value: "", label: t("blockDefault") },
              { value: "sm", label: t("textSize_sm") },
              { value: "md", label: t("textSize_md") },
              { value: "lg", label: t("textSize_lg") },
              { value: "xl", label: t("textSize_xl") },
            ]}
            onChange={(v) => setFrame({ headingSize: v || undefined })}
          />
          <SelectField
            label={t("fldHeadingWeight")}
            value={style.headingWeight ?? ""}
            options={[
              { value: "", label: t("blockDefault") },
              { value: "normal", label: t("weight_normal") },
              { value: "medium", label: t("weight_medium") },
              { value: "semibold", label: t("weight_semibold") },
              { value: "bold", label: t("weight_bold") },
            ]}
            onChange={(v) => setFrame({ headingWeight: v || undefined })}
          />
          <SelectField
            label={t("fldBodySize")}
            value={style.bodySize ?? ""}
            options={[
              { value: "", label: t("blockDefault") },
              { value: "sm", label: t("textSize_sm") },
              { value: "md", label: t("textSize_md") },
              { value: "lg", label: t("textSize_lg") },
            ]}
            onChange={(v) => setFrame({ bodySize: v || undefined })}
          />
          <SelectField
            label={t("fldLineHeight")}
            value={style.lineHeight ?? ""}
            options={[
              { value: "", label: t("blockDefault") },
              { value: "tight", label: t("lineHeight_tight") },
              { value: "snug", label: t("lineHeight_snug") },
              { value: "normal", label: t("lineHeight_normal") },
              { value: "relaxed", label: t("lineHeight_relaxed") },
              { value: "loose", label: t("lineHeight_loose") },
            ]}
            onChange={(v) => setFrame({ lineHeight: v || undefined })}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Per-device (Laptop / Mobile) editor — the Safari inspector's device tabs. Shows
 * the SAME content form as Desktop, but every change is stored as an override for
 * just this screen size (only the fields that differ from Desktop are kept, so
 * untouched fields keep inheriting). Plus a "hide on this screen" toggle. Rendered
 * per breakpoint via the responsive CSS (@media live + @container builder frames).
 */
function ResponsiveDeviceFields({
  device,
  websiteId,
  section,
  onChange,
  themePreset,
}: {
  device: "laptop" | "mobile";
  websiteId: string;
  section: WebsiteSection;
  onChange: (next: WebsiteSection) => void;
  themePreset?: string;
}) {
  const t = useTranslations("website");
  const resp = section.responsive ?? {};
  const dev = resp[device] ?? {};
  const baseProps = section.props as Record<string, unknown>;
  const override = (dev.props ?? {}) as Record<string, unknown>;
  // The section as the host sees it on this device: desktop values + overrides.
  const mergedSection = {
    ...section,
    props: { ...baseProps, ...override },
  } as WebsiteSection;

  const setHidden = (hidden: boolean) =>
    onChange({
      ...section,
      responsive: { ...resp, [device]: { ...dev, hidden } },
    } as WebsiteSection);

  // Store only the fields that differ from Desktop, so unchanged fields keep
  // inheriting (and a later Desktop edit still flows through).
  const onFieldsChange = (next: WebsiteSection) => {
    const nextProps = next.props as Record<string, unknown>;
    const diff: Record<string, unknown> = {};
    for (const k of Object.keys(nextProps)) {
      if (JSON.stringify(nextProps[k]) !== JSON.stringify(baseProps[k])) {
        diff[k] = nextProps[k];
      }
    }
    onChange({
      ...section,
      responsive: { ...resp, [device]: { ...dev, props: diff } },
    } as WebsiteSection);
  };

  return (
    <div className="space-y-4">
      <ToggleField
        label={t("fldHideOnDevice")}
        checked={!!dev.hidden}
        onChange={setHidden}
      />
      <LiveNote>{t("responsiveDeviceNote")}</LiveNote>
      {!dev.hidden ? (
        <SectionFields
          websiteId={websiteId}
          section={mergedSection}
          onChange={onFieldsChange}
          themePreset={themePreset}
        />
      ) : null}
    </div>
  );
}

/**
 * Per-type property form for one section (W8). Switches on the discriminated
 * union so each branch edits a fully-typed `props`. Free-form sections edit their
 * own content; auto-populate sections edit only config + show a "pulls live data"
 * note.
 */
function SectionFields({
  websiteId,
  section,
  onChange,
  themePreset,
}: {
  websiteId: string;
  section: WebsiteSection;
  onChange: (next: WebsiteSection) => void;
  themePreset?: string;
}) {
  const t = useTranslations("website");
  const isSafari = themePreset === "safari";

  const layoutOptions: Array<{ value: Layout; label: string }> = [
    { value: "grid", label: t("layout_grid") },
    { value: "list", label: t("layout_list") },
    { value: "carousel", label: t("layout_carousel") },
  ];

  switch (section.type) {
    case "hero": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldEyebrow")}
            value={p.eyebrow ?? ""}
            onChange={(v) => set({ eyebrow: v })}
            maxLength={120}
            hint={t("fldEyebrowHint")}
          />
          <TextField
            label={t("fldHeadline")}
            value={p.headline}
            onChange={(v) => set({ headline: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldSubheadline")}
            value={p.subheadline ?? ""}
            onChange={(v) => set({ subheadline: v })}
            maxLength={400}
            rows={2}
          />
          <ImageField
            label={t("fldBackgroundImage")}
            websiteId={websiteId}
            path={p.image_path}
            onChange={(path) => set({ image_path: path })}
            hint={isSafari ? t("imgHintHero") : t("fldBackgroundImageHint")}
          />
          {isSafari ? (
            <ToggleField
              label={t("fldHeroCompact")}
              checked={!!p.compact}
              onChange={(v) => set({ compact: v })}
            />
          ) : null}
          {isSafari && !p.compact ? (
            <ToggleField
              label={t("fldShowPrimaryCta")}
              checked={p.show_cta !== false}
              onChange={(v) => set({ show_cta: v })}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={isSafari ? t("fldPrimaryCtaLabel") : t("fldCtaLabel")}
              value={p.cta_label ?? ""}
              onChange={(v) => set({ cta_label: v })}
              maxLength={60}
            />
            <TextField
              label={t("fldCtaHref")}
              value={p.cta_href ?? ""}
              onChange={(v) => set({ cta_href: v })}
              maxLength={500}
              hint={t("fldCtaHrefHint")}
            />
          </div>
          {isSafari ? (
            <>
              <ToggleField
                label={t("fldShowSecondaryCta")}
                checked={p.show_cta2 !== false}
                onChange={(v) => set({ show_cta2: v })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t("fldSecondaryCtaLabel")}
                  value={p.cta2_label ?? ""}
                  onChange={(v) => set({ cta2_label: v })}
                  maxLength={60}
                  hint={t("fldSecondaryCtaHint")}
                />
                <TextField
                  label={t("fldCtaHref")}
                  value={p.cta2_href ?? ""}
                  onChange={(v) => set({ cta2_href: v })}
                  maxLength={500}
                  hint={t("fldCtaHrefHint")}
                />
              </div>
              <ToggleField
                label={t("fldStackButtons")}
                checked={!!p.cta_stack}
                onChange={(v) => set({ cta_stack: v })}
              />
            </>
          ) : null}
          <SelectField
            label={t("fldAlign")}
            value={p.align}
            options={[
              { value: "left", label: t("align_left") },
              { value: "center", label: t("align_center") },
              { value: "right", label: t("align_right") },
            ]}
            onChange={(v) => set({ align: v })}
          />
          {isSafari ? (
            <div className="space-y-3 rounded-[10px] border border-brand-line bg-brand-light/30 p-3">
              <ToggleField
                label={t("fldShowStats")}
                checked={p.show_stats !== false}
                onChange={(v) => set({ show_stats: v })}
              />
              {p.show_stats !== false ? (
                <ItemListEditor
                  label={t("fldStats")}
                  items={p.stats ?? []}
                  onChange={(stats) => set({ stats })}
                  blank={() => ({ value: "", label: "" })}
                  addLabel={t("fldStatsAdd")}
                  max={4}
                  renderItem={(item, patch) => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <TextField
                        label={t("fldStatValue")}
                        value={item.value ?? ""}
                        onChange={(v) => patch({ value: v })}
                        maxLength={60}
                      />
                      <TextField
                        label={t("fldStatLabel")}
                        value={item.label ?? ""}
                        onChange={(v) => patch({ label: v })}
                        maxLength={80}
                      />
                    </div>
                  )}
                />
              ) : null}
              <LiveNote>{t("fldStatsHint")}</LiveNote>
            </div>
          ) : null}
          {/* Layout / overlay / height / text-tone do nothing on the Safari hero
              (it's a fixed full-bleed design with a CSS overlay + light text), so
              they're hidden there — only the controls that actually apply show. */}
          {!isSafari ? (
            <>
              <SelectField
                label={t("fldHeroLayout")}
                value={
                  p.variant === "classic"
                    ? "spotlight"
                    : p.variant === "split"
                      ? "split_right"
                      : p.variant
                }
                options={[
                  { value: "spotlight", label: t("heroLayout_spotlight") },
                  { value: "split_right", label: t("heroLayout_split_right") },
                  { value: "split_left", label: t("heroLayout_split_left") },
                  { value: "fullscreen", label: t("heroLayout_fullscreen") },
                  { value: "minimal", label: t("heroLayout_minimal") },
                  { value: "boxed", label: t("heroLayout_boxed") },
                  { value: "search", label: t("heroLayout_search") },
                ]}
                onChange={(v) => set({ variant: v })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label={t("fldHeroHeight")}
                  value={p.height ?? "auto"}
                  options={[
                    { value: "auto", label: t("heroHeight_auto") },
                    { value: "medium", label: t("heroHeight_medium") },
                    { value: "tall", label: t("heroHeight_tall") },
                    { value: "screen", label: t("heroHeight_screen") },
                  ]}
                  onChange={(v) => set({ height: v })}
                />
                <SelectField
                  label={t("fldHeroOverlay")}
                  value={p.overlay ?? "medium"}
                  options={[
                    { value: "none", label: t("heroOverlay_none") },
                    { value: "light", label: t("heroOverlay_light") },
                    { value: "medium", label: t("heroOverlay_medium") },
                    { value: "strong", label: t("heroOverlay_strong") },
                  ]}
                  onChange={(v) => set({ overlay: v })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[12px] font-medium text-brand-mute">
                    {t("fldHeroOverlayColor")}
                  </span>
                  <input
                    type="color"
                    value={p.overlayColor?.trim() || "#000000"}
                    onChange={(e) => set({ overlayColor: e.target.value })}
                    className="mt-1 h-9 w-full cursor-pointer rounded-[8px] border border-brand-line bg-white"
                    aria-label={t("fldHeroOverlayColor")}
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-medium text-brand-mute">
                    {t("fldHeroOverlayOpacity")}
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={
                        p.overlayOpacity ??
                        { none: 0, light: 25, medium: 45, strong: 65 }[
                          p.overlay ?? "medium"
                        ]
                      }
                      onChange={(e) =>
                        set({ overlayOpacity: Number(e.target.value) })
                      }
                      className="flex-1"
                    />
                    <span className="w-9 text-right text-[12px] tabular-nums text-brand-mute">
                      {p.overlayOpacity ??
                        { none: 0, light: 25, medium: 45, strong: 65 }[
                          p.overlay ?? "medium"
                        ]}
                      %
                    </span>
                  </div>
                </label>
              </div>
              <SelectField
                label={t("fldHeroTextTone")}
                value={p.textTone ?? "auto"}
                options={[
                  { value: "auto", label: t("heroTone_auto") },
                  { value: "light", label: t("heroTone_light") },
                  { value: "dark", label: t("heroTone_dark") },
                ]}
                onChange={(v) => set({ textTone: v })}
              />
            </>
          ) : null}
        </div>
      );
    }

    case "intro": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldEyebrow")}
            value={p.eyebrow ?? ""}
            onChange={(v) => set({ eyebrow: v })}
            maxLength={120}
            hint={t("fldEyebrowHint")}
          />
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldBody")}
            value={p.body}
            onChange={(v) => set({ body: v })}
            maxLength={4000}
            rows={5}
          />
          <ImageField
            label={t("fldImage")}
            websiteId={websiteId}
            path={p.image_path}
            onChange={(path) => set({ image_path: path })}
            hint={isSafari ? t("imgHintIntro") : t("fldImageHint")}
          />
          {isSafari ? (
            <div className="space-y-3 rounded-[10px] border border-brand-line bg-brand-light/30 p-3">
              <ToggleField
                label={t("fldShowBadge")}
                checked={p.show_badge !== false}
                onChange={(v) => set({ show_badge: v })}
              />
              {p.show_badge !== false ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <TextField
                    label={t("fldBadgeValue")}
                    value={p.badge_value ?? ""}
                    onChange={(v) => set({ badge_value: v })}
                    maxLength={40}
                  />
                  <TextField
                    label={t("fldBadgeLabel")}
                    value={p.badge_label ?? ""}
                    onChange={(v) => set({ badge_label: v })}
                    maxLength={80}
                  />
                </div>
              ) : null}
              <LiveNote>{t("fldBadgeHint")}</LiveNote>
            </div>
          ) : null}
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "centered", label: t("introVariant_centered") },
                { value: "split", label: t("introVariant_split") },
                { value: "lead", label: t("introVariant_lead") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
        </div>
      );
    }

    case "highlights": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldEyebrow")}
            value={p.eyebrow ?? ""}
            onChange={(v) => set({ eyebrow: v })}
            maxLength={120}
            hint={t("fldEyebrowHint")}
          />
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldSubheading")}
            value={p.subheading ?? ""}
            onChange={(v) => set({ subheading: v })}
            maxLength={600}
            rows={2}
          />
          <ItemListEditor
            label={t("fldHighlights")}
            items={p.items}
            onChange={(items) => set({ items })}
            blank={() => ({ icon: "", title: "", body: "" })}
            addLabel={t("addHighlight")}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("fldTitle")}
                  value={item.title}
                  onChange={(v) => patch({ title: v })}
                  maxLength={120}
                />
                <TextArea
                  label={t("fldText")}
                  value={item.body ?? ""}
                  onChange={(v) => patch({ body: v })}
                  maxLength={600}
                  rows={2}
                />
                <ImageField
                  label={t("fldImage")}
                  websiteId={websiteId}
                  path={item.image_path}
                  onChange={(path) => patch({ image_path: path })}
                  hint={isSafari ? t("imgHintHighlight") : t("fldImageHint")}
                />
              </>
            )}
          />
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "grid", label: t("highlightsVariant_grid") },
                { value: "list", label: t("highlightsVariant_list") },
                { value: "plain", label: t("highlightsVariant_plain") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
        </div>
      );
    }

    case "stats": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <ItemListEditor
            label={t("fldStats")}
            items={p.items}
            onChange={(items) => set({ items })}
            blank={() => ({ value: "", label: "" })}
            addLabel={t("addStat")}
            max={8}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("fldStatValue")}
                  value={item.value}
                  onChange={(v) => patch({ value: v })}
                  maxLength={40}
                />
                <TextField
                  label={t("fldStatLabel")}
                  value={item.label}
                  onChange={(v) => patch({ label: v })}
                  maxLength={120}
                />
              </>
            )}
          />
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "band", label: t("statsVariant_band") },
              { value: "plain", label: t("statsVariant_plain") },
              { value: "cards", label: t("statsVariant_cards") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
        </div>
      );
    }

    case "logos": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <ItemListEditor
            label={t("fldLogos")}
            items={p.items}
            onChange={(items) => set({ items })}
            blank={() => ({ image_path: "", alt: "", href: "" })}
            addLabel={t("addLogo")}
            max={16}
            renderItem={(item, patch) => (
              <>
                <ImageField
                  label={t("fldLogoImage")}
                  websiteId={websiteId}
                  path={item.image_path || undefined}
                  onChange={(path) => patch({ image_path: path ?? "" })}
                />
                <TextField
                  label={t("fldLogoAlt")}
                  value={item.alt ?? ""}
                  onChange={(v) => patch({ alt: v })}
                  maxLength={120}
                />
                <TextField
                  label={t("fldLogoHref")}
                  value={item.href ?? ""}
                  onChange={(v) => patch({ href: v })}
                  maxLength={500}
                  hint={t("fldCtaHrefHint")}
                />
              </>
            )}
          />
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "row", label: t("logosVariant_row") },
              { value: "grid", label: t("logosVariant_grid") },
              { value: "color", label: t("logosVariant_color") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
        </div>
      );
    }

    case "map": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextField
            label={t("fldMapAddress")}
            value={p.address}
            onChange={(v) => set({ address: v })}
            maxLength={300}
            hint={t("fldMapAddressHint")}
          />
          <TextField
            label={t("fldMapCaption")}
            value={p.caption ?? ""}
            onChange={(v) => set({ caption: v })}
            maxLength={300}
          />
          <NumberField
            label={t("fldMapZoom")}
            value={p.zoom}
            min={1}
            max={20}
            onChange={(v) => set({ zoom: v })}
          />
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "boxed", label: t("mapVariant_boxed") },
              { value: "wide", label: t("mapVariant_wide") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
        </div>
      );
    }

    case "values": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <ItemListEditor
            label={t("fldValues")}
            items={p.items}
            onChange={(items) => set({ items })}
            blank={() => ({ title: "", body: "" })}
            addLabel={t("addValue")}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("fldTitle")}
                  value={item.title}
                  onChange={(v) => patch({ title: v })}
                  maxLength={120}
                />
                <TextArea
                  label={t("fldText")}
                  value={item.body ?? ""}
                  onChange={(v) => patch({ body: v })}
                  maxLength={600}
                  rows={2}
                />
              </>
            )}
          />
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "border", label: t("valuesVariant_border") },
              { value: "cards", label: t("valuesVariant_cards") },
              { value: "numbered", label: t("valuesVariant_numbered") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
        </div>
      );
    }

    case "faq": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <ItemListEditor
            label={t("fldFaqs")}
            items={p.items}
            onChange={(items) => set({ items })}
            blank={() => ({ q: "", a: "" })}
            addLabel={t("addFaq")}
            max={40}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("fldQuestion")}
                  value={item.q}
                  onChange={(v) => patch({ q: v })}
                  maxLength={300}
                />
                <TextArea
                  label={t("fldAnswer")}
                  value={item.a}
                  onChange={(v) => patch({ a: v })}
                  maxLength={2000}
                  rows={2}
                />
              </>
            )}
          />
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "accordion", label: t("faqVariant_accordion") },
                { value: "plain", label: t("faqVariant_plain") },
                { value: "columns", label: t("faqVariant_columns") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
        </div>
      );
    }

    case "contact_form": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldBody")}
            value={p.body ?? ""}
            onChange={(v) => set({ body: v })}
            maxLength={600}
            rows={2}
          />
          <ToggleField
            label={t("fldContactShowPhone")}
            checked={p.show_phone}
            onChange={(v) => set({ show_phone: v })}
          />
          <TextField
            label={t("fldContactSubmitLabel")}
            value={p.submit_label}
            onChange={(v) => set({ submit_label: v })}
            maxLength={60}
          />
          <TextArea
            label={t("fldContactSuccess")}
            value={p.success_message}
            onChange={(v) => set({ success_message: v })}
            maxLength={300}
            rows={2}
          />
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "stacked", label: t("contactVariant_stacked") },
                { value: "split", label: t("contactVariant_split") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
          <LiveNote>{t("contactFormNote")}</LiveNote>
        </div>
      );
    }

    case "form":
      // Hooks (forms-list fetch) live in a child so this switch stays hook-free.
      return (
        <FormFieldsEditor
          websiteId={websiteId}
          section={section}
          onChange={onChange}
        />
      );

    case "cta": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldEyebrow")}
            value={p.eyebrow ?? ""}
            onChange={(v) => set({ eyebrow: v })}
            maxLength={120}
            hint={t("fldEyebrowHint")}
          />
          <TextField
            label={t("fldHeading")}
            value={p.heading}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldBody")}
            value={p.body ?? ""}
            onChange={(v) => set({ body: v })}
            maxLength={600}
            rows={2}
          />
          <ImageField
            label={t("fldImage")}
            websiteId={websiteId}
            path={p.image_path}
            onChange={(path) => set({ image_path: path })}
            hint={isSafari ? t("imgHintCta") : t("fldImageHint")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t("fldButtonLabel")}
              value={p.button_label}
              onChange={(v) => set({ button_label: v })}
              maxLength={60}
            />
            <TextField
              label={t("fldButtonHref")}
              value={p.button_href}
              onChange={(v) => set({ button_href: v })}
              maxLength={500}
              hint={t("fldCtaHrefHint")}
            />
          </div>
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "banner", label: t("ctaVariant_banner") },
                { value: "card", label: t("ctaVariant_card") },
                { value: "split", label: t("ctaVariant_split") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
        </div>
      );
    }

    case "host_bio": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextField
            label={t("fldHostName")}
            value={p.name ?? ""}
            onChange={(v) => set({ name: v })}
            maxLength={120}
          />
          <TextArea
            label={t("fldBody")}
            value={p.body}
            onChange={(v) => set({ body: v })}
            maxLength={4000}
            rows={4}
          />
          <ImageField
            label={t("fldHostPhoto")}
            websiteId={websiteId}
            path={p.photo_path}
            onChange={(path) => set({ photo_path: path })}
            hint={isSafari ? t("imgHintHostBio") : undefined}
          />
          {isSafari ? (
            <>
              <ToggleField
                label={t("fldReverseImage")}
                checked={!!p.reverse}
                onChange={(v) => set({ reverse: v })}
              />
              <ItemListEditor
                label={t("fldCheckList")}
                items={p.points ?? []}
                onChange={(points) => set({ points })}
                blank={() => ({ text: "" })}
                addLabel={t("fldCheckListAdd")}
                max={8}
                renderItem={(item, patch) => (
                  <TextField
                    label={t("fldCheckListItem")}
                    value={item.text}
                    onChange={(v) => patch({ text: v })}
                    maxLength={200}
                  />
                )}
              />
            </>
          ) : null}
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "side", label: t("hostbioVariant_side") },
                { value: "centered", label: t("hostbioVariant_centered") },
                { value: "card", label: t("hostbioVariant_card") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
        </div>
      );
    }

    case "rich_text": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <Field label={t("fldHtml")} hint={t("fldHtmlHint")}>
            <div className="mt-1.5">
              <RichTextEditor
                value={p.html}
                onChange={(v) => set({ html: v.slice(0, 50000) })}
              />
            </div>
          </Field>
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "narrow", label: t("richtextVariant_narrow") },
              { value: "wide", label: t("richtextVariant_wide") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
        </div>
      );
    }

    case "gallery": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          {!isSafari ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={t("fldLayout")}
                value={(p.layout ?? "grid") as Layout}
                options={layoutOptions}
                onChange={(v) => set({ layout: v })}
              />
              <NumberField
                label={t("fldMax")}
                value={p.max}
                min={1}
                max={60}
                onChange={(v) => set({ max: v })}
              />
            </div>
          ) : null}
          <LiveNote>{t("liveGallery")}</LiveNote>
        </div>
      );
    }

    case "rooms_preview": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          {!isSafari ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label={t("fldLayout")}
                value={(p.layout ?? "grid") as Layout}
                options={layoutOptions}
                onChange={(v) => set({ layout: v })}
              />
              <NumberField
                label={t("fldMax")}
                value={p.max}
                min={1}
                max={60}
                onChange={(v) => set({ max: v })}
              />
            </div>
          ) : null}
          <TextField
            label={t("fldRoomCtaLabel")}
            value={p.ctaLabel ?? ""}
            onChange={(v) => set({ ctaLabel: v })}
            maxLength={60}
          />
          <LiveNote>{t("liveRooms")}</LiveNote>
        </div>
      );
    }

    case "location": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldEyebrow")}
            value={p.eyebrow ?? ""}
            onChange={(v) => set({ eyebrow: v })}
            maxLength={120}
            hint={t("fldEyebrowHint")}
          />
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldBody")}
            value={p.body ?? ""}
            onChange={(v) => set({ body: v })}
            maxLength={1000}
            rows={3}
          />
          <ImageField
            label={t("fldImage")}
            websiteId={websiteId}
            path={p.image_path}
            onChange={(path) => set({ image_path: path })}
            hint={isSafari ? t("imgHintLocation") : t("fldImageHint")}
          />
          {!isSafari ? (
            <>
              <ToggleField
                label={t("fldShowMap")}
                checked={p.show_map}
                onChange={(v) => set({ show_map: v })}
              />
              <SelectField
                label={t("fldVariant")}
                value={p.variant}
                options={[
                  { value: "split", label: t("locationVariant_split") },
                  { value: "stacked", label: t("locationVariant_stacked") },
                  { value: "list", label: t("locationVariant_list") },
                ]}
                onChange={(v) => set({ variant: v })}
              />
            </>
          ) : null}
          <LiveNote>{t("liveLocation")}</LiveNote>
        </div>
      );
    }

    case "reviews": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          {isSafari ? (
            <TextField
              label={t("fldSubheading")}
              value={p.subheading ?? ""}
              onChange={(v) => set({ subheading: v })}
              maxLength={300}
              hint={t("fldReviewsSubheadingHint")}
            />
          ) : null}
          {!isSafari ? (
            <>
              <NumberField
                label={t("fldMax")}
                value={p.max}
                min={1}
                max={30}
                onChange={(v) => set({ max: v })}
              />
              <SelectField
                label={t("fldVariant")}
                value={p.variant}
                options={[
                  { value: "grid", label: t("reviewsVariant_grid") },
                  { value: "list", label: t("reviewsVariant_list") },
                  { value: "plain", label: t("reviewsVariant_plain") },
                ]}
                onChange={(v) => set({ variant: v })}
              />
            </>
          ) : null}
          <LiveNote>{t("liveReviews")}</LiveNote>
        </div>
      );
    }

    case "blog_preview": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <NumberField
            label={t("fldMax")}
            value={p.max}
            min={1}
            max={12}
            onChange={(v) => set({ max: v })}
          />
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "grid", label: t("blogVariant_grid") },
              { value: "list", label: t("blogVariant_list") },
              { value: "compact", label: t("blogVariant_compact") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
          <LiveNote>{t("liveBlog")}</LiveNote>
        </div>
      );
    }

    case "specials_preview": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("fldLayout")}
              value={(p.layout ?? "grid") as Layout}
              options={layoutOptions}
              onChange={(v) => set({ layout: v })}
            />
            <NumberField
              label={t("fldMax")}
              value={p.max}
              min={1}
              max={60}
              onChange={(v) => set({ max: v })}
            />
          </div>
          <TextField
            label={t("fldSpecialsCtaLabel")}
            value={p.ctaLabel ?? ""}
            onChange={(v) => set({ ctaLabel: v })}
            maxLength={60}
          />
          <LiveNote>{t("liveSpecials")}</LiveNote>
        </div>
      );
    }

    case "amenities": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <ItemListEditor
            label={t("fldAmenities")}
            items={p.items}
            onChange={(items) => set({ items })}
            blank={() => ({ icon: "", label: "" })}
            addLabel={t("addAmenity")}
            max={40}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("fldAmenityIcon")}
                  value={item.icon ?? ""}
                  onChange={(v) => patch({ icon: v })}
                  maxLength={60}
                  hint={t("fldAmenityIconHint")}
                />
                <TextField
                  label={t("fldAmenityLabel")}
                  value={item.label}
                  onChange={(v) => patch({ label: v })}
                  maxLength={120}
                />
              </>
            )}
          />
        </div>
      );
    }

    case "pricing": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <ItemListEditor
            label={t("fldPricing")}
            items={p.items}
            onChange={(items) => set({ items })}
            blank={() => ({ label: "", price: "", note: "" })}
            addLabel={t("addPriceRow")}
            max={20}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("fldPriceLabel")}
                  value={item.label}
                  onChange={(v) => patch({ label: v })}
                  maxLength={120}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t("fldPrice")}
                    value={item.price}
                    onChange={(v) => patch({ price: v })}
                    maxLength={40}
                  />
                  <TextField
                    label={t("fldPriceNote")}
                    value={item.note ?? ""}
                    onChange={(v) => patch({ note: v })}
                    maxLength={160}
                  />
                </div>
              </>
            )}
          />
          <TextField
            label={t("fldPricingFootnote")}
            value={p.footnote ?? ""}
            onChange={(v) => set({ footnote: v })}
            maxLength={300}
          />
        </div>
      );
    }

    case "video": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextField
            label={t("fldVideoUrl")}
            value={p.url}
            onChange={(v) => set({ url: v })}
            maxLength={500}
            hint={t("fldVideoUrlHint")}
          />
          <TextField
            label={t("fldVideoCaption")}
            value={p.caption ?? ""}
            onChange={(v) => set({ caption: v })}
            maxLength={300}
          />
        </div>
      );
    }

    case "trust": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldBody")}
            value={p.body ?? ""}
            onChange={(v) => set({ body: v })}
            maxLength={600}
            rows={2}
          />
          <ToggleField
            label={t("fldTrustShowScore")}
            checked={p.show_review_score}
            onChange={(v) => set({ show_review_score: v })}
          />
          <ItemListEditor
            label={t("fldTrustBadges")}
            items={p.items}
            onChange={(items) => set({ items })}
            blank={() => ({ icon: "", label: "", caption: "" })}
            addLabel={t("addTrustBadge")}
            max={20}
            renderItem={(item, patch) => (
              <>
                <TextField
                  label={t("fldAmenityIcon")}
                  value={item.icon ?? ""}
                  onChange={(v) => patch({ icon: v })}
                  maxLength={60}
                  hint={t("fldAmenityIconHint")}
                />
                <TextField
                  label={t("fldTrustBadgeLabel")}
                  value={item.label}
                  onChange={(v) => patch({ label: v })}
                  maxLength={120}
                />
                <TextField
                  label={t("fldTrustBadgeCaption")}
                  value={item.caption ?? ""}
                  onChange={(v) => patch({ caption: v })}
                  maxLength={160}
                />
              </>
            )}
          />
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "badges", label: t("trustVariant_badges") },
              { value: "grid", label: t("trustVariant_grid") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
          <LiveNote>{t("liveTrustScore")}</LiveNote>
        </div>
      );
    }

    case "booking_search": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldBody")}
            value={p.body ?? ""}
            onChange={(v) => set({ body: v })}
            maxLength={600}
            rows={2}
          />
          <FunnelPropertyPicker
            websiteId={websiteId}
            value={p.property_id}
            onChange={(id) => set({ property_id: id })}
          />
          <TextField
            label={t("fldBookingSearchCta")}
            value={p.ctaLabel ?? ""}
            onChange={(v) => set({ ctaLabel: v })}
            maxLength={60}
          />
          <LiveNote>{t("liveBookingSearch")}</LiveNote>
        </div>
      );
    }

    case "availability_calendar": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextArea
            label={t("fldBody")}
            value={p.body ?? ""}
            onChange={(v) => set({ body: v })}
            maxLength={600}
            rows={2}
          />
          <FunnelPropertyPicker
            websiteId={websiteId}
            value={p.property_id}
            onChange={(id) => set({ property_id: id })}
          />
          <SelectField
            label={t("fldCalendarMonths")}
            value={String(p.months ?? 1)}
            options={[
              { value: "1", label: t("calendarMonths_one") },
              { value: "2", label: t("calendarMonths_two") },
            ]}
            onChange={(v) => set({ months: Number(v) })}
          />
          <LiveNote>{t("liveAvailabilityCalendar")}</LiveNote>
        </div>
      );
    }

    case "rate_table": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {isSafari ? (
            <TextField
              label={t("fldEyebrow")}
              value={p.eyebrow ?? ""}
              onChange={(v) => set({ eyebrow: v })}
              maxLength={120}
              hint={t("fldEyebrowHint")}
            />
          ) : null}
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextField
            label={t("fldRateTableCta")}
            value={p.ctaLabel ?? ""}
            onChange={(v) => set({ ctaLabel: v })}
            maxLength={60}
          />
          <TextArea
            label={t("fldRateTableNote")}
            value={p.note ?? ""}
            onChange={(v) => set({ note: v })}
            maxLength={300}
            rows={2}
          />
          <LiveNote>{t("liveRateTable")}</LiveNote>
        </div>
      );
    }

    case "room_rates": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      const source = p.source ?? "auto";
      return (
        <div className="space-y-4">
          <SelectField
            label={t("fldRatesSource")}
            value={source}
            options={[
              { value: "auto", label: t("ratesSource_auto") },
              { value: "manual", label: t("ratesSource_manual") },
            ]}
            onChange={(v) => set({ source: v })}
          />
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          {source === "manual" ? (
            <ItemListEditor
              label={t("fldRoomRates")}
              items={p.items}
              onChange={(items) => set({ items })}
              blank={() => ({ room: "", price: "", detail: "" })}
              addLabel={t("addRoomRate")}
              max={20}
              renderItem={(item, patch) => (
                <>
                  <TextField
                    label={t("fldRoomName")}
                    value={item.room}
                    onChange={(v) => patch({ room: v })}
                    maxLength={120}
                  />
                  <TextField
                    label={t("fldRatePrice")}
                    value={item.price}
                    onChange={(v) => patch({ price: v })}
                    maxLength={60}
                  />
                  <TextField
                    label={t("fldRateDetail")}
                    value={item.detail ?? ""}
                    onChange={(v) => patch({ detail: v })}
                    maxLength={200}
                  />
                </>
              )}
            />
          ) : (
            <LiveNote>{t("liveRoomRates")}</LiveNote>
          )}
          <TextArea
            label={t("fldNote")}
            value={p.note ?? ""}
            onChange={(v) => set({ note: v })}
            maxLength={300}
            rows={2}
          />
        </div>
      );
    }

    case "seasonal_pricing": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      const source = p.source ?? "auto";
      return (
        <div className="space-y-4">
          <SelectField
            label={t("fldRatesSource")}
            value={source}
            options={[
              { value: "auto", label: t("ratesSource_auto") },
              { value: "manual", label: t("ratesSource_manual") },
            ]}
            onChange={(v) => set({ source: v })}
          />
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          {source === "manual" ? (
            <ItemListEditor
              label={t("fldSeasons")}
              items={p.items}
              onChange={(items) => set({ items })}
              blank={() => ({ season: "", dates: "", price: "", detail: "" })}
              addLabel={t("addSeason")}
              max={20}
              renderItem={(item, patch) => (
                <>
                  <TextField
                    label={t("fldSeasonName")}
                    value={item.season}
                    onChange={(v) => patch({ season: v })}
                    maxLength={120}
                  />
                  <TextField
                    label={t("fldSeasonDates")}
                    value={item.dates ?? ""}
                    onChange={(v) => patch({ dates: v })}
                    maxLength={80}
                  />
                  <TextField
                    label={t("fldRatePrice")}
                    value={item.price}
                    onChange={(v) => patch({ price: v })}
                    maxLength={60}
                  />
                  <TextField
                    label={t("fldRateDetail")}
                    value={item.detail ?? ""}
                    onChange={(v) => patch({ detail: v })}
                    maxLength={200}
                  />
                </>
              )}
            />
          ) : (
            <LiveNote>{t("liveSeasonalPricing")}</LiveNote>
          )}
          <TextArea
            label={t("fldNote")}
            value={p.note ?? ""}
            onChange={(v) => set({ note: v })}
            maxLength={300}
            rows={2}
          />
        </div>
      );
    }

    case "room_gallery": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "mosaic", label: t("roomGalleryVariant_mosaic") },
                { value: "carousel", label: t("roomGalleryVariant_carousel") },
                { value: "grid", label: t("roomGalleryVariant_grid") },
                { value: "stacked", label: t("roomGalleryVariant_stacked") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
          <NumberField
            label={t("fldMax")}
            value={p.max}
            min={1}
            max={30}
            onChange={(v) => set({ max: v })}
          />
          <LiveNote>{t("liveRoom")}</LiveNote>
        </div>
      );
    }

    case "room_overview": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldRoomHeadingOverride")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <ToggleField
            label={t("fldShowFacts")}
            checked={p.show_facts}
            onChange={(v) => set({ show_facts: v })}
          />
          <ToggleField
            label={t("fldShowPrice")}
            checked={p.show_price}
            onChange={(v) => set({ show_price: v })}
          />
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "split", label: t("roomOverviewVariant_split") },
                { value: "stacked", label: t("roomOverviewVariant_stacked") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
          <LiveNote>{t("liveRoom")}</LiveNote>
        </div>
      );
    }

    case "room_amenities": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "grid", label: t("roomAmenitiesVariant_grid") },
              { value: "list", label: t("roomAmenitiesVariant_list") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
          <LiveNote>{t("liveRoom")}</LiveNote>
        </div>
      );
    }

    case "room_rate": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
          <TextField
            label={t("fldRoomCtaLabel")}
            value={p.cta_label ?? ""}
            onChange={(v) => set({ cta_label: v })}
            maxLength={60}
          />
          <TextArea
            label={t("fldRateTableNote")}
            value={p.note ?? ""}
            onChange={(v) => set({ note: v })}
            maxLength={300}
            rows={2}
          />
          {!isSafari ? (
            <SelectField
              label={t("fldVariant")}
              value={p.variant}
              options={[
                { value: "card", label: t("roomRateVariant_card") },
                { value: "banner", label: t("roomRateVariant_banner") },
              ]}
              onChange={(v) => set({ variant: v })}
            />
          ) : null}
          <LiveNote>{t("liveRoom")}</LiveNote>
        </div>
      );
    }

    case "el_heading": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldElHeadingText")}
            value={p.text}
            onChange={(v) => set({ text: v })}
            maxLength={200}
          />
          <SelectField
            label={t("fldElLevel")}
            value={p.level}
            options={[
              { value: "h1", label: t("elLevel_h1") },
              { value: "h2", label: t("elLevel_h2") },
              { value: "h3", label: t("elLevel_h3") },
              { value: "h4", label: t("elLevel_h4") },
              { value: "h5", label: t("elLevel_h5") },
              { value: "h6", label: t("elLevel_h6") },
              { value: "p", label: t("elLevel_p") },
            ]}
            onChange={(v) => set({ level: v })}
          />
          <AlignField value={p.align} onChange={(v) => set({ align: v })} />
          <TypographyFields
            size={p.size}
            weight={p.weight}
            color={p.color}
            onChange={set}
          />
        </div>
      );
    }

    case "el_text": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextArea
            label={t("fldBody")}
            value={p.body}
            onChange={(v) => set({ body: v })}
            maxLength={4000}
            rows={5}
          />
          <AlignField value={p.align} onChange={(v) => set({ align: v })} />
          <TypographyFields
            size={p.size}
            weight={p.weight}
            color={p.color}
            onChange={set}
          />
        </div>
      );
    }

    case "el_image": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <ImageField
            label={t("fldElImage")}
            websiteId={websiteId}
            path={p.image_path}
            onChange={(path) => set({ image_path: path })}
          />
          <TextField
            label={t("fldElImageAlt")}
            value={p.alt ?? ""}
            onChange={(v) => set({ alt: v })}
            maxLength={200}
            hint={t("fldElImageAltHint")}
          />
          <TextField
            label={t("fldElImageCaption")}
            value={p.caption ?? ""}
            onChange={(v) => set({ caption: v })}
            maxLength={300}
          />
          <TextField
            label={t("fldElImageLink")}
            value={p.href ?? ""}
            onChange={(v) => set({ href: v })}
            maxLength={500}
          />
          <SelectField
            label={t("fldElWidth")}
            value={p.width}
            options={[
              { value: "narrow", label: t("elWidth_narrow") },
              { value: "medium", label: t("elWidth_medium") },
              { value: "full", label: t("elWidth_full") },
            ]}
            onChange={(v) => set({ width: v })}
          />
          <AlignField value={p.align} onChange={(v) => set({ align: v })} />
        </div>
      );
    }

    case "el_button": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextField
            label={t("fldCtaLabel")}
            value={p.label}
            onChange={(v) => set({ label: v })}
            maxLength={60}
          />
          <TextField
            label={t("fldCtaHref")}
            value={p.href}
            onChange={(v) => set({ href: v })}
            maxLength={500}
          />
          <SelectField
            label={t("fldElButtonStyle")}
            value={p.variant}
            options={[
              { value: "primary", label: t("elButton_primary") },
              { value: "secondary", label: t("elButton_secondary") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
          <SelectField
            label={t("fldElButtonSize")}
            value={p.size}
            options={[
              { value: "sm", label: t("elBtnSize_sm") },
              { value: "md", label: t("elBtnSize_md") },
              { value: "lg", label: t("elBtnSize_lg") },
            ]}
            onChange={(v) => set({ size: v })}
          />
          <AlignField value={p.align} onChange={(v) => set({ align: v })} />
        </div>
      );
    }

    case "el_spacer": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <SelectField
            label={t("fldElSpacerSize")}
            value={p.size}
            options={[
              { value: "xs", label: t("elSpacer_xs") },
              { value: "sm", label: t("elSpacer_sm") },
              { value: "md", label: t("elSpacer_md") },
              { value: "lg", label: t("elSpacer_lg") },
              { value: "xl", label: t("elSpacer_xl") },
              { value: "2xl", label: t("elSpacer_2xl") },
            ]}
            onChange={(v) => set({ size: v })}
          />
        </div>
      );
    }

    case "el_divider": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <SelectField
            label={t("fldElDividerLine")}
            value={p.line}
            options={[
              { value: "solid", label: t("elLine_solid") },
              { value: "dashed", label: t("elLine_dashed") },
              { value: "dotted", label: t("elLine_dotted") },
            ]}
            onChange={(v) => set({ line: v })}
          />
          <SelectField
            label={t("fldElThickness")}
            value={p.thickness}
            options={[
              { value: "thin", label: t("elThick_thin") },
              { value: "medium", label: t("elThick_medium") },
              { value: "thick", label: t("elThick_thick") },
            ]}
            onChange={(v) => set({ thickness: v })}
          />
          <SelectField
            label={t("fldElWidth")}
            value={p.width}
            options={[
              { value: "narrow", label: t("elWidth_narrow") },
              { value: "full", label: t("elWidth_full") },
            ]}
            onChange={(v) => set({ width: v })}
          />
        </div>
      );
    }

    case "columns":
      return (
        <ColumnsEditor
          websiteId={websiteId}
          section={section}
          onChange={onChange}
        />
      );

    case "flex":
      return (
        <FlexEditor
          websiteId={websiteId}
          section={section}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
}

/**
 * Preset typography controls (size / weight / colour) shared by the heading and
 * text elements. All preset-only and theme-tied: "Auto" inherits the theme, and
 * colours are palette roles — a host can't enter raw px/hex, so it stays
 * on-brand (RULES: curated, not Elementor).
 */
function TypographyFields({
  size,
  weight,
  color,
  onChange,
}: {
  size: ElSize;
  weight: ElWeight;
  color: ElColor;
  onChange: (patch: {
    size?: ElSize;
    weight?: ElWeight;
    color?: ElColor;
  }) => void;
}) {
  const t = useTranslations("website");
  return (
    <>
      <SelectField
        label={t("fldElSize")}
        value={size}
        options={[
          { value: "auto", label: t("elSize_auto") },
          { value: "xs", label: t("elSize_xs") },
          { value: "sm", label: t("elSize_sm") },
          { value: "md", label: t("elSize_md") },
          { value: "lg", label: t("elSize_lg") },
          { value: "xl", label: t("elSize_xl") },
          { value: "2xl", label: t("elSize_2xl") },
        ]}
        onChange={(v: ElSize) => onChange({ size: v })}
      />
      <SelectField
        label={t("fldElWeight")}
        value={weight}
        options={[
          { value: "auto", label: t("elWeight_auto") },
          { value: "light", label: t("elWeight_light") },
          { value: "normal", label: t("elWeight_normal") },
          { value: "medium", label: t("elWeight_medium") },
          { value: "semibold", label: t("elWeight_semibold") },
          { value: "bold", label: t("elWeight_bold") },
        ]}
        onChange={(v: ElWeight) => onChange({ weight: v })}
      />
      <SelectField
        label={t("fldElColor")}
        value={color}
        options={[
          { value: "default", label: t("elColor_default") },
          { value: "muted", label: t("elColor_muted") },
          { value: "accent", label: t("elColor_accent") },
          { value: "secondary", label: t("elColor_secondary") },
        ]}
        onChange={(v: ElColor) => onChange({ color: v })}
      />
    </>
  );
}

/** Left/Centre/Right alignment select shared by the free elements. */
function AlignField({
  value,
  onChange,
}: {
  value: "left" | "center" | "right";
  onChange: (v: "left" | "center" | "right") => void;
}) {
  const t = useTranslations("website");
  return (
    <SelectField
      label={t("fldAlign")}
      value={value}
      options={[
        { value: "left", label: t("align_left") },
        { value: "center", label: t("align_center") },
        { value: "right", label: t("align_right") },
      ]}
      onChange={onChange}
    />
  );
}

/**
 * Property picker shared by the booking-funnel section editors. Fetches the
 * site's visible properties; an empty value means "let the guest choose" (or the
 * primary property when the section pins none).
 */
function FunnelPropertyPicker({
  websiteId,
  value,
  onChange,
}: {
  websiteId: string;
  value?: string;
  onChange: (id: string | undefined) => void;
}) {
  const t = useTranslations("website");
  const [properties, setProperties] = useState<WebsitePropertyOption[]>([]);

  useEffect(() => {
    let active = true;
    listWebsiteBookablePropertiesAction(websiteId).then((res) => {
      if (active && res.ok) setProperties(res.properties);
    });
    return () => {
      active = false;
    };
  }, [websiteId]);

  return (
    <SelectField
      label={t("fldFunnelProperty")}
      value={value ?? ""}
      options={[
        { value: "", label: t("funnelPropertyAny") },
        ...properties.map((p) => ({ value: p.id, label: p.name })),
      ]}
      onChange={(v) => onChange(v || undefined)}
    />
  );
}

/**
 * Editor for a `form` section. Fetches the site's forms (built in the Forms tab)
 * for the picker; the chosen form's fields/settings are resolved live at render.
 */
function FormFieldsEditor({
  websiteId,
  section,
  onChange,
}: {
  websiteId: string;
  section: Extract<WebsiteSection, { type: "form" }>;
  onChange: (next: WebsiteSection) => void;
}) {
  const t = useTranslations("website");
  const [forms, setForms] = useState<WebsiteFormOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    listWebsiteFormsAction(websiteId).then((res) => {
      if (!active) return;
      if (res.ok) setForms(res.forms);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [websiteId]);

  const p = section.props;
  const set = (patch: Partial<typeof p>) =>
    onChange({ ...section, props: { ...p, ...patch } });

  return (
    <div className="space-y-4">
      {loaded && forms.length === 0 ? (
        <LiveNote>{t("formSectionNoForms")}</LiveNote>
      ) : (
        <SelectField
          label={t("formSectionPick")}
          value={p.form_id ?? ""}
          options={[
            { value: "", label: t("formSectionPickPrompt") },
            ...forms.map((f) => ({ value: f.id, label: f.name })),
          ]}
          onChange={(v) => set({ form_id: v || undefined })}
        />
      )}
      <TextField
        label={t("fldHeading")}
        value={p.heading ?? ""}
        onChange={(v) => set({ heading: v })}
        maxLength={200}
      />
      <TextArea
        label={t("fldBody")}
        value={p.body ?? ""}
        onChange={(v) => set({ body: v })}
        maxLength={600}
        rows={2}
      />
      <SelectField
        label={t("fldVariant")}
        value={p.variant}
        options={[
          { value: "stacked", label: t("contactVariant_stacked") },
          { value: "split", label: t("contactVariant_split") },
        ]}
        onChange={(v) => set({ variant: v })}
      />
      <LiveNote>{t("formSectionNote")}</LiveNote>
    </div>
  );
}

/** A blank inline block of the given kind (column content). */
function newColumnBlock(kind: ColumnBlockKind): ColumnBlock {
  switch (kind) {
    case "heading":
      return { kind, text: "Heading", level: "h3" };
    case "text":
      return { kind, body: "Add some text." };
    case "image":
      return { kind };
    case "button":
      return { kind, label: "Button", href: "#", variant: "primary" };
  }
}

/**
 * Columns editor — a bounded single-level container: pick the column count, gap
 * and alignment, then add/reorder/remove inline content blocks (heading / text /
 * image / button) inside each column.
 */
function ColumnsEditor({
  websiteId,
  section,
  onChange,
}: {
  websiteId: string;
  section: Extract<WebsiteSection, { type: "columns" }>;
  onChange: (next: WebsiteSection) => void;
}) {
  const t = useTranslations("website");
  const p = section.props;
  const columns = p.columns ?? [];
  const set = (patch: Partial<typeof p>) =>
    onChange({ ...section, props: { ...p, ...patch } });

  const setColumnBlocks = (ci: number, blocks: ColumnBlock[]) =>
    set({ columns: columns.map((c, i) => (i === ci ? { ...c, blocks } : c)) });

  const setCount = (n: number) => {
    const next = columns.slice(0, n);
    while (next.length < n) next.push({ blocks: [] });
    set({ columns: next });
  };

  return (
    <div className="space-y-4">
      <TextField
        label={t("fldHeading")}
        value={p.heading ?? ""}
        onChange={(v) => set({ heading: v })}
        maxLength={200}
        hint={t("fldColumnsHeadingHint")}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={t("fldColumnsCount")}
          value={String(Math.min(4, Math.max(1, columns.length || 1)))}
          options={[
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4" },
          ]}
          onChange={(v) => setCount(Number(v))}
        />
        <SelectField
          label={t("fldColumnsGap")}
          value={p.gap}
          options={[
            { value: "sm", label: t("elSpacer_sm") },
            { value: "md", label: t("elSpacer_md") },
            { value: "lg", label: t("elSpacer_lg") },
          ]}
          onChange={(v) => set({ gap: v })}
        />
      </div>
      <SelectField
        label={t("fldAlign")}
        value={p.align}
        options={[
          { value: "left", label: t("align_left") },
          { value: "center", label: t("align_center") },
        ]}
        onChange={(v) => set({ align: v })}
      />

      {columns.map((col, ci) => (
        <div
          key={ci}
          className="rounded-[12px] border border-brand-line bg-brand-light/30 p-3"
        >
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-brand-mute">
            {t("columnLabel", { n: ci + 1 })}
          </div>
          <div className="space-y-3">
            {col.blocks.map((block, bi) => (
              <ColumnBlockEditor
                key={bi}
                websiteId={websiteId}
                block={block}
                isFirst={bi === 0}
                isLast={bi === col.blocks.length - 1}
                onChange={(next) =>
                  setColumnBlocks(
                    ci,
                    col.blocks.map((b, i) => (i === bi ? next : b)),
                  )
                }
                onRemove={() =>
                  setColumnBlocks(
                    ci,
                    col.blocks.filter((_, i) => i !== bi),
                  )
                }
                onMove={(dir) => {
                  const j = bi + dir;
                  if (j < 0 || j >= col.blocks.length) return;
                  const next = [...col.blocks];
                  [next[bi], next[j]] = [next[j], next[bi]];
                  setColumnBlocks(ci, next);
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["heading", "text", "image", "button"] as ColumnBlockKind[]).map(
              (kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() =>
                    setColumnBlocks(ci, [...col.blocks, newColumnBlock(kind)])
                  }
                  className="inline-flex items-center gap-1 rounded-[8px] border border-dashed border-brand-line px-2.5 py-1 text-[12px] font-medium text-brand-mute transition hover:border-brand-mute hover:text-brand-ink"
                >
                  + {t(`blockKind_${kind}`)}
                </button>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Flex container editor — block list (reused) + flexbox layout controls. */
function FlexEditor({
  websiteId,
  section,
  onChange,
}: {
  websiteId: string;
  section: Extract<WebsiteSection, { type: "flex" }>;
  onChange: (next: WebsiteSection) => void;
}) {
  const t = useTranslations("website");
  const p = section.props;
  const blocks = p.blocks ?? [];
  const set = (patch: Partial<typeof p>) =>
    onChange({ ...section, props: { ...p, ...patch } });
  const setBlocks = (b: ColumnBlock[]) => set({ blocks: b });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={t("fldFlexDirection")}
          value={p.direction}
          options={[
            { value: "row", label: t("flexDir_row") },
            { value: "column", label: t("flexDir_column") },
          ]}
          onChange={(v) => set({ direction: v })}
        />
        <SelectField
          label={t("fldColumnsGap")}
          value={p.gap}
          options={[
            { value: "sm", label: t("elSpacer_sm") },
            { value: "md", label: t("elSpacer_md") },
            { value: "lg", label: t("elSpacer_lg") },
          ]}
          onChange={(v) => set({ gap: v })}
        />
        <SelectField
          label={t("fldFlexJustify")}
          value={p.justify}
          options={[
            { value: "start", label: t("flexJustify_start") },
            { value: "center", label: t("flexJustify_center") },
            { value: "end", label: t("flexJustify_end") },
            { value: "between", label: t("flexJustify_between") },
            { value: "around", label: t("flexJustify_around") },
          ]}
          onChange={(v) => set({ justify: v })}
        />
        <SelectField
          label={t("fldFlexAlign")}
          value={p.align}
          options={[
            { value: "start", label: t("flexAlign_start") },
            { value: "center", label: t("flexAlign_center") },
            { value: "end", label: t("flexAlign_end") },
            { value: "stretch", label: t("flexAlign_stretch") },
          ]}
          onChange={(v) => set({ align: v })}
        />
      </div>
      <ToggleField
        label={t("fldFlexWrap")}
        checked={p.wrap !== false}
        onChange={(v) => set({ wrap: v })}
      />

      <div className="space-y-3">
        {blocks.map((block, bi) => (
          <ColumnBlockEditor
            key={bi}
            websiteId={websiteId}
            block={block}
            isFirst={bi === 0}
            isLast={bi === blocks.length - 1}
            onChange={(next) =>
              setBlocks(blocks.map((b, i) => (i === bi ? next : b)))
            }
            onRemove={() => setBlocks(blocks.filter((_, i) => i !== bi))}
            onMove={(dir) => {
              const j = bi + dir;
              if (j < 0 || j >= blocks.length) return;
              const next = [...blocks];
              [next[bi], next[j]] = [next[j], next[bi]];
              setBlocks(next);
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["heading", "text", "image", "button"] as ColumnBlockKind[]).map(
          (kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setBlocks([...blocks, newColumnBlock(kind)])}
              className="inline-flex items-center gap-1 rounded-[8px] border border-dashed border-brand-line px-2.5 py-1 text-[12px] font-medium text-brand-mute transition hover:border-brand-mute hover:text-brand-ink"
            >
              + {t(`blockKind_${kind}`)}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/** One inline block's fields inside a column, with move/remove controls. */
function ColumnBlockEditor({
  websiteId,
  block,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMove,
}: {
  websiteId: string;
  block: ColumnBlock;
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: ColumnBlock) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const t = useTranslations("website");

  return (
    <div className="relative rounded-[10px] border border-brand-line bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {t(`blockKind_${block.kind}`)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            className="rounded p-1 text-brand-mute hover:bg-brand-light disabled:opacity-30"
            aria-label={t("moveUp")}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMove(1)}
            className="rounded p-1 text-brand-mute hover:bg-brand-light disabled:opacity-30"
            aria-label={t("moveDown")}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-brand-mute hover:bg-white hover:text-red-600"
            aria-label={t("removeItem")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {block.kind === "heading" ? (
        <div className="space-y-2.5">
          <TextField
            label={t("fldElHeadingText")}
            value={block.text}
            onChange={(v) => onChange({ ...block, text: v })}
            maxLength={200}
          />
          <SelectField
            label={t("fldElLevel")}
            value={block.level}
            options={[
              { value: "h1", label: t("elLevel_h1") },
              { value: "h2", label: t("elLevel_h2") },
              { value: "h3", label: t("elLevel_h3") },
              { value: "h4", label: t("elLevel_h4") },
              { value: "h5", label: t("elLevel_h5") },
              { value: "h6", label: t("elLevel_h6") },
              { value: "p", label: t("elLevel_p") },
            ]}
            onChange={(v) => onChange({ ...block, level: v })}
          />
        </div>
      ) : null}

      {block.kind === "text" ? (
        <TextArea
          label={t("fldBody")}
          value={block.body}
          onChange={(v) => onChange({ ...block, body: v })}
          maxLength={2000}
          rows={3}
        />
      ) : null}

      {block.kind === "image" ? (
        <div className="space-y-2.5">
          <ImageField
            label={t("fldElImage")}
            websiteId={websiteId}
            path={block.image_path}
            onChange={(path) => onChange({ ...block, image_path: path })}
          />
          <TextField
            label={t("fldElImageAlt")}
            value={block.alt ?? ""}
            onChange={(v) => onChange({ ...block, alt: v })}
            maxLength={200}
          />
        </div>
      ) : null}

      {block.kind === "button" ? (
        <div className="space-y-2.5">
          <TextField
            label={t("fldCtaLabel")}
            value={block.label}
            onChange={(v) => onChange({ ...block, label: v })}
            maxLength={60}
          />
          <TextField
            label={t("fldCtaHref")}
            value={block.href}
            onChange={(v) => onChange({ ...block, href: v })}
            maxLength={500}
          />
          <SelectField
            label={t("fldElButtonStyle")}
            value={block.variant}
            options={[
              { value: "primary", label: t("elButton_primary") },
              { value: "secondary", label: t("elButton_secondary") },
            ]}
            onChange={(v) => onChange({ ...block, variant: v })}
          />
        </div>
      ) : null}
    </div>
  );
}
