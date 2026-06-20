"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import {
  listWebsiteFormsAction,
  type WebsiteFormOption,
} from "@/app/[locale]/dashboard/website/actions";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import {
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
}: {
  websiteId: string;
  section: WebsiteSection;
  onChange: (next: WebsiteSection) => void;
}) {
  const t = useTranslations("website");
  return (
    <div className="space-y-5">
      <SectionFields
        websiteId={websiteId}
        section={section}
        onChange={onChange}
      />
      <div className="space-y-4 border-t border-brand-line pt-4">
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
}: {
  websiteId: string;
  section: WebsiteSection;
  onChange: (next: WebsiteSection) => void;
}) {
  const t = useTranslations("website");

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
            hint={t("fldBackgroundImageHint")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t("fldCtaLabel")}
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
          <SelectField
            label={t("fldAlign")}
            value={p.align}
            options={[
              { value: "center", label: t("align_center") },
              { value: "left", label: t("align_left") },
            ]}
            onChange={(v) => set({ align: v })}
          />
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "classic", label: t("heroVariant_classic") },
              { value: "split", label: t("heroVariant_split") },
              { value: "minimal", label: t("heroVariant_minimal") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
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
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
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
              </>
            )}
          />
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
        </div>
      );
    }

    case "contact_form": {
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
          <SelectField
            label={t("fldVariant")}
            value={p.variant}
            options={[
              { value: "stacked", label: t("contactVariant_stacked") },
              { value: "split", label: t("contactVariant_split") },
            ]}
            onChange={(v) => set({ variant: v })}
          />
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
          />
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
        </div>
      );
    }

    case "rich_text": {
      const p = section.props;
      const set = (patch: Partial<typeof p>) =>
        onChange({ ...section, props: { ...p, ...patch } });
      return (
        <div className="space-y-4">
          <TextArea
            label={t("fldHtml")}
            value={p.html}
            onChange={(v) => set({ html: v })}
            maxLength={50000}
            rows={8}
            hint={t("fldHtmlHint")}
          />
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
            label={t("fldHeading")}
            value={p.heading ?? ""}
            onChange={(v) => set({ heading: v })}
            maxLength={200}
          />
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

    default:
      return null;
  }
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
