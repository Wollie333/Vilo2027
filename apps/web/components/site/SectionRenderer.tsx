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

  if (!fill && !hasVars && !visClass && !css) return <>{children}</>;
  const className =
    [visClass, css ? cls : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div style={fill ? { background: fill } : undefined} className={className}>
      {css ? <style>{css}</style> : null}
      {hasVars ? <div style={toneVars}>{children}</div> : children}
    </div>
  );
}

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
