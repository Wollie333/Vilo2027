"use client";

import { useTranslations } from "next-intl";

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
 * Per-type property form for one section (W8). Switches on the discriminated
 * union so each branch edits a fully-typed `props`. Free-form sections edit their
 * own content; auto-populate sections edit only config + show a "pulls live data"
 * note. `onChange` replaces the whole (typed) section in the builder state.
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
          <LiveNote>{t("contactFormNote")}</LiveNote>
        </div>
      );
    }

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
        </div>
      );
    }

    case "rich_text": {
      const p = section.props;
      return (
        <TextArea
          label={t("fldHtml")}
          value={p.html}
          onChange={(v) => onChange({ ...section, props: { html: v } })}
          maxLength={50000}
          rows={8}
          hint={t("fldHtmlHint")}
        />
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

    default:
      return null;
  }
}
