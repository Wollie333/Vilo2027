import type { CSSProperties, ReactNode } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";
import {
  dataFor,
  type SiteAssetResolver,
  type SiteData,
} from "@/lib/site/types";

import { SectionBoundary } from "./SectionBoundary";
import { blockStyleCss, sectionToneStyle } from "./sections/_shared";

import { HeroSection } from "./sections/HeroSection";
import { IntroSection } from "./sections/IntroSection";
import { HighlightsSection } from "./sections/HighlightsSection";
import { StatsSection } from "./sections/StatsSection";
import { LogosSection } from "./sections/LogosSection";
import { GallerySection } from "./sections/GallerySection";
import { MapSection } from "./sections/MapSection";
import { RoomsPreviewSection } from "./sections/RoomsPreviewSection";
import { LocationSection } from "./sections/LocationSection";
import { ReviewsSection } from "./sections/ReviewsSection";
import { CtaSection } from "./sections/CtaSection";
import { HostBioSection } from "./sections/HostBioSection";
import { ValuesSection } from "./sections/ValuesSection";
import { BlogPreviewSection } from "./sections/BlogPreviewSection";
import { SpecialsPreviewSection } from "./sections/SpecialsPreview";
import { AddonsPreviewSection } from "./sections/AddonsPreview";
import { RichTextSection } from "./sections/RichTextSection";
import { FaqSection } from "./sections/FaqSection";
import { ContactFormSection } from "./sections/ContactFormSection";
import { FormSection } from "./sections/FormSection";
import { AmenitiesSection } from "./sections/AmenitiesSection";
import { PricingSection } from "./sections/PricingSection";
import { VideoSection } from "./sections/VideoSection";
import { TrustSection } from "./sections/TrustSection";
import { BookingSearchSection } from "./sections/BookingSearchSection";
import { SearchResultsSection } from "./sections/SearchResultsSection";
import { AvailabilityCalendarSection } from "./sections/AvailabilityCalendarSection";
import { RateTableSection } from "./sections/RateTableSection";
import {
  RoomRatesSection,
  SeasonalPricingSection,
} from "./sections/RatesBlocks";
import {
  RoomGallerySection,
  RoomOverviewSection,
  RoomAmenitiesSection,
  RoomRateSection,
  RoomPoliciesSection,
  PoliciesSection,
} from "./sections/RoomDetailSections";
import {
  ElHeadingSection,
  ElTextSection,
  ElImageSection,
  ElButtonSection,
  ElSpacerSection,
  ElDividerSection,
  ElListSection,
} from "./sections/Elements";
import { ColumnsSection, FlexSection } from "./sections/ColumnsSection";

/**
 * Renders an ordered list of validated sections — the ONE renderer shared by the
 * dashboard live preview and the public site (preview === public). Free-form
 * sections read their `props`; auto-populate sections additionally receive their
 * live data via the `data` map (keyed by section id). `asset` resolves storage
 * paths → URLs for the image-bearing free-form sections (hero, host_bio).
 */
export function SectionRenderer({
  sections,
  data,
  asset,
  websiteId,
  interactive = false,
  errorLabel,
}: {
  sections: WebsiteSection[];
  data?: SiteData;
  asset?: SiteAssetResolver;
  /** Live website id — lets the contact form resolve the host on submit. */
  websiteId?: string;
  /** True on the public site (forms submit); false in the builder preview. */
  interactive?: boolean;
  /** Builder-only: shown in place of a section that throws at render. When
   *  omitted (public site), a broken section is silently omitted instead. */
  errorLabel?: string;
}) {
  return (
    <>
      {sections
        .filter((s) => s.enabled)
        .map((section) => (
          <SectionWrap key={section.id} section={section}>
            <SectionBoundary resetKey={section} fallbackLabel={errorLabel}>
              <SectionSwitch
                section={section}
                data={data}
                asset={asset}
                websiteId={websiteId}
                interactive={interactive}
              />
            </SectionBoundary>
          </SectionWrap>
        ))}
    </>
  );
}

/** Wraps a section in its colour tone + optional background, device visibility,
 *  and per-block responsive spacing (a scoped <style>). Renders no wrapper when
 *  everything is at its default. */
function SectionWrap({
  section,
  children,
}: {
  section: WebsiteSection;
  children: ReactNode;
}) {
  const vis = section.visibility ?? "all";
  const visClass =
    vis === "desktop"
      ? "hidden md:block"
      : vis === "mobile"
        ? "block md:hidden"
        : "";

  // Split the tone: the background FILL goes on the outer element (so a dark
  // tone's `var(--site-ink)` resolves against the inherited palette), while the
  // tone's `--site-*` overrides go on an INNER wrapper (so children flip to the
  // right contrast). Setting both on one element makes `background:var(--site-ink)`
  // self-reference the overridden `--site-ink: #fff` and paint the band white —
  // same fix the PageDoc renderer already applies.
  const tone = sectionToneStyle(section.tone) as
    | (CSSProperties & { background?: string })
    | undefined;
  const { background: toneBg, ...toneVars } = tone ?? {};
  const bg = section.style?.background?.trim();
  const fill = bg || toneBg;
  const hasVars = Object.keys(toneVars).length > 0;

  const cls = `wsec-${section.id.replace(/-/g, "")}`;
  const css = blockStyleCss(cls, section.style);

  // Bare theme-template blocks carry no band padding or content-width clamp of
  // their own (the reframe made them "the section owns padding + width"), and the
  // flat template render path — unlike the v2 PageDocRenderer's SECTION_DEFAULT —
  // never supplied that band. So wrap CONTENT sections in a centred, gutter-padded
  // band: content never touches the screen edge on mobile and never over-stretches
  // on wide desktops. Genuinely full-bleed sections (hero/gallery/cta own their own
  // background + internal padding) opt out and render edge-to-edge.
  const banded = !FULL_BLEED_SECTIONS.has(section.type);
  const content = banded ? (
    <div className="site-band" style={BAND_STYLE}>
      {children}
    </div>
  ) : (
    children
  );

  // Always emit a wrapping element carrying the stable `data-section-type` hook
  // so per-theme skins can target each block on this (flat) render path too —
  // matching the v2 PageDocRenderer. A bare block `<div>` with only the data
  // attribute is layout-neutral.
  if (!fill && !hasVars && !visClass && !css)
    return <div data-section-type={section.type}>{content}</div>;
  const className =
    [visClass, css ? cls : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div
      data-section-type={section.type}
      style={fill ? { background: fill } : undefined}
      className={className}
    >
      {css ? <style>{css}</style> : null}
      {hasVars ? <div style={toneVars}>{content}</div> : content}
    </div>
  );
}

// Sections that render edge-to-edge (own full-bleed background + internal padding)
// — they must NOT be clamped/gutter-padded by the content band.
const FULL_BLEED_SECTIONS = new Set(["hero", "gallery", "cta"]);
// Centred content band: a mobile-safe horizontal gutter (never flush to the edge)
// plus a max-width so text doesn't over-stretch on wide screens (matches the v2
// renderer's 1180px content width). `paddingBlock` gives every content section the
// SAME vertical rhythm — 50px on phones → 100px on desktop — so sections read neat
// and professional instead of squashed. A per-section `style.padTop/padBottom`
// override still wins (applied as a scoped rule on the outer element).
const BAND_STYLE: CSSProperties = {
  width: "100%",
  maxWidth: 1180,
  marginInline: "auto",
  paddingInline: "clamp(20px, 4vw, 32px)",
  paddingBlock: "clamp(50px, 7vw, 100px)",
};

function SectionSwitch({
  section,
  data,
  asset,
  websiteId,
  interactive,
}: {
  section: WebsiteSection;
  data?: SiteData;
  asset?: SiteAssetResolver;
  websiteId?: string;
  interactive?: boolean;
}) {
  // Builder V2 cutover: one token-driven render for every theme (the bespoke
  // per-theme section renderers are gone).
  return (
    <GenericSection
      section={section}
      data={data}
      asset={asset}
      websiteId={websiteId}
      interactive={interactive}
    />
  );
}

/**
 * The theme-agnostic render for a single section — reads `--site-*` tokens only,
 * so it themes per tenant by construction. This is the fallback for every theme
 * today; under Builder V2 it becomes the SOLE render (the bespoke per-theme
 * dispatchers are deleted at cutover). Exported so the new PageDoc renderer
 * (components/site/v2) reuses the exact same on-brand leaves.
 */
export function GenericSection({
  section,
  data,
  asset,
  websiteId,
  interactive,
}: {
  section: WebsiteSection;
  data?: SiteData;
  asset?: SiteAssetResolver;
  websiteId?: string;
  interactive?: boolean;
}) {
  switch (section.type) {
    case "hero":
      return (
        <HeroSection
          props={section.props}
          asset={asset}
          interactive={interactive}
        />
      );
    case "intro":
      return <IntroSection props={section.props} />;
    case "highlights":
      return <HighlightsSection props={section.props} />;
    case "stats":
      return <StatsSection props={section.props} />;
    case "logos":
      return <LogosSection props={section.props} asset={asset} />;
    case "map":
      return <MapSection props={section.props} />;
    case "gallery":
      return (
        <GallerySection
          props={section.props}
          data={dataFor(data, section.id, "gallery")}
        />
      );
    case "rooms_preview":
      return (
        <RoomsPreviewSection
          props={section.props}
          data={dataFor(data, section.id, "rooms_preview")}
        />
      );
    case "location":
      return (
        <LocationSection
          props={section.props}
          data={dataFor(data, section.id, "location")}
        />
      );
    case "reviews":
      return (
        <ReviewsSection
          props={section.props}
          data={dataFor(data, section.id, "reviews")}
        />
      );
    case "cta":
      return <CtaSection props={section.props} />;
    case "host_bio":
      return <HostBioSection props={section.props} asset={asset} />;
    case "values":
      return <ValuesSection props={section.props} />;
    case "blog_preview":
      return (
        <BlogPreviewSection
          props={section.props}
          data={dataFor(data, section.id, "blog_preview")}
        />
      );
    case "specials_preview":
      return (
        <SpecialsPreviewSection
          props={section.props}
          data={dataFor(data, section.id, "specials_preview")}
        />
      );
    case "addons_preview":
      return (
        <AddonsPreviewSection
          props={section.props}
          data={dataFor(data, section.id, "addons_preview")}
        />
      );
    case "rich_text":
      return <RichTextSection props={section.props} />;
    case "faq":
      return <FaqSection props={section.props} />;
    case "contact_form":
      return (
        <ContactFormSection
          props={section.props}
          websiteId={websiteId}
          interactive={interactive}
        />
      );
    case "form":
      return (
        <FormSection
          props={section.props}
          data={dataFor(data, section.id, "form")}
          websiteId={websiteId}
          interactive={interactive}
        />
      );
    case "amenities":
      return (
        <AmenitiesSection
          props={section.props}
          data={dataFor(data, section.id, "amenities")}
        />
      );
    case "policies":
      return (
        <PoliciesSection
          props={section.props}
          data={dataFor(data, section.id, "policies")}
        />
      );
    case "pricing":
      return <PricingSection props={section.props} />;
    case "video":
      return <VideoSection props={section.props} />;
    case "trust":
      return (
        <TrustSection
          props={section.props}
          data={dataFor(data, section.id, "trust")}
        />
      );
    case "booking_search":
      return (
        <BookingSearchSection
          props={section.props}
          data={dataFor(data, section.id, "booking_search")}
          interactive={interactive}
        />
      );
    case "search_results":
      return (
        <SearchResultsSection
          props={section.props}
          data={dataFor(data, section.id, "search_results")}
          interactive={interactive}
        />
      );
    case "availability_calendar":
      return (
        <AvailabilityCalendarSection
          props={section.props}
          data={dataFor(data, section.id, "availability_calendar")}
          interactive={interactive}
        />
      );
    case "rate_table":
      return (
        <RateTableSection
          props={section.props}
          data={dataFor(data, section.id, "rate_table")}
        />
      );
    case "room_rates":
      return (
        <RoomRatesSection
          props={section.props}
          data={dataFor(data, section.id, "room_rates")}
        />
      );
    case "seasonal_pricing":
      return (
        <SeasonalPricingSection
          props={section.props}
          data={dataFor(data, section.id, "seasonal_pricing")}
        />
      );
    case "room_gallery":
      return (
        <RoomGallerySection
          props={section.props}
          data={dataFor(data, section.id, "room_gallery")}
        />
      );
    case "room_overview":
      return (
        <RoomOverviewSection
          props={section.props}
          data={dataFor(data, section.id, "room_overview")}
        />
      );
    case "room_amenities":
      return (
        <RoomAmenitiesSection
          props={section.props}
          data={dataFor(data, section.id, "room_amenities")}
        />
      );
    case "room_rate":
      return (
        <RoomRateSection
          props={section.props}
          data={dataFor(data, section.id, "room_rate")}
        />
      );
    case "room_policies":
      return (
        <RoomPoliciesSection
          props={section.props}
          data={dataFor(data, section.id, "room_policies")}
        />
      );
    case "el_heading":
      return <ElHeadingSection props={section.props} />;
    case "el_text":
      return <ElTextSection props={section.props} />;
    case "el_image":
      return (
        <ElImageSection
          props={section.props}
          asset={asset}
          interactive={interactive}
        />
      );
    case "el_button":
      return <ElButtonSection props={section.props} />;
    case "el_spacer":
      return <ElSpacerSection props={section.props} />;
    case "el_divider":
      return <ElDividerSection props={section.props} />;
    case "el_list":
      return <ElListSection props={section.props} />;
    case "columns":
      return <ColumnsSection props={section.props} asset={asset} />;
    case "flex":
      return <FlexSection props={section.props} asset={asset} />;
    default:
      return null;
  }
}
