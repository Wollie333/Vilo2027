import type { ReactNode } from "react";

import type { WebsiteSection } from "@/lib/website/sections.schema";
import {
  dataFor,
  type SiteAssetResolver,
  type SiteData,
} from "@/lib/site/types";

import { sectionToneStyle } from "./sections/_shared";

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
import { RichTextSection } from "./sections/RichTextSection";
import { FaqSection } from "./sections/FaqSection";
import { ContactFormSection } from "./sections/ContactFormSection";
import { FormSection } from "./sections/FormSection";
import { AmenitiesSection } from "./sections/AmenitiesSection";
import { PricingSection } from "./sections/PricingSection";
import { VideoSection } from "./sections/VideoSection";

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
}: {
  sections: WebsiteSection[];
  data?: SiteData;
  asset?: SiteAssetResolver;
  /** Live website id — lets the contact form resolve the host on submit. */
  websiteId?: string;
  /** True on the public site (forms submit); false in the builder preview. */
  interactive?: boolean;
}) {
  return (
    <>
      {sections
        .filter((s) => s.enabled)
        .map((section) => (
          <SectionWrap key={section.id} section={section}>
            <SectionSwitch
              section={section}
              data={data}
              asset={asset}
              websiteId={websiteId}
              interactive={interactive}
            />
          </SectionWrap>
        ))}
    </>
  );
}

/** Wraps a section in its colour tone (style) + device visibility (class).
 *  Renders no wrapper when both are at their defaults. */
function SectionWrap({
  section,
  children,
}: {
  section: WebsiteSection;
  children: ReactNode;
}) {
  const style = sectionToneStyle(section.tone);
  const vis = section.visibility ?? "all";
  const visClass =
    vis === "desktop"
      ? "hidden md:block"
      : vis === "mobile"
        ? "block md:hidden"
        : "";
  if (!style && !visClass) return <>{children}</>;
  return (
    <div style={style} className={visClass || undefined}>
      {children}
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
  switch (section.type) {
    case "hero":
      return <HeroSection props={section.props} asset={asset} />;
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
      return <AmenitiesSection props={section.props} />;
    case "pricing":
      return <PricingSection props={section.props} />;
    case "video":
      return <VideoSection props={section.props} />;
    default:
      return null;
  }
}
