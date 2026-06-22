// Code-defined, professionally-designed sections + page templates attached to a
// THEME.
//
// • SECTION PRESETS — ready-made single sections (pre-set variant + styling +
//   starter copy) the host pulls into a page from the sidebar's theme group.
// • PAGE TEMPLATES — ordered compositions of those sections, so a host can start
//   a whole page from a designed layout in one click.
//
// Both are pre-configured instances of the EXISTING curated section types, so
// they render + validate through the same schema with zero new plumbing. Adding
// a theme's set = add factories + REGISTRY entries keyed by the theme slug
// (`SiteThemeConfig.preset`).
import { newSection } from "./sectionDefaults";
import type { WebsiteSection } from "./sections.schema";

export type ThemeSectionPreset = {
  /** Stable key (for the sidebar card key + search). */
  key: string;
  /** Sidebar card label. */
  label: string;
  /** Builds a ready-to-insert section (fresh id) pre-styled for the theme. */
  make: () => WebsiteSection;
};

export type ThemeTemplate = {
  key: string;
  label: string;
  /** One-line description shown in the template gallery. */
  description: string;
  /** Builds the full ordered section list (each with a fresh id). */
  make: () => WebsiteSection[];
};

// ── Aria (the modern flagship theme) — section factories ──────────────────
function ariaHeroSpotlight(): WebsiteSection {
  const s = newSection("hero");
  if (s.type === "hero") {
    s.tone = "dark";
    s.props = {
      ...s.props,
      headline: "Your escape begins here",
      subheadline: "A calm, design-led stay moments from everything.",
      cta_label: "Check availability",
      cta_href: "#book",
      align: "center",
      variant: "spotlight",
      overlay: "strong",
      textTone: "light",
      height: "tall",
    };
  }
  return s;
}

function ariaHeroSplit(): WebsiteSection {
  const s = newSection("hero");
  if (s.type === "hero") {
    s.props = {
      ...s.props,
      headline: "Designed for the way you travel",
      subheadline: "Thoughtful spaces, honest pricing, direct booking.",
      cta_label: "Explore the rooms",
      cta_href: "#rooms",
      align: "left",
      variant: "split_right",
      height: "medium",
    };
  }
  return s;
}

function ariaFeatureTrio(): WebsiteSection {
  const s = newSection("highlights");
  if (s.type === "highlights") {
    s.props = {
      ...s.props,
      heading: "Why guests choose us",
      variant: "grid",
      items: [
        {
          icon: "Sparkles",
          title: "Effortless stays",
          body: "Self check-in and a spotless space, every time.",
        },
        {
          icon: "MapPin",
          title: "Perfectly placed",
          body: "Minutes from the best of the area.",
        },
        {
          icon: "Heart",
          title: "Hosted with care",
          body: "Real people, quick replies, local tips.",
        },
      ],
    };
  }
  return s;
}

function ariaStatsBand(): WebsiteSection {
  const s = newSection("stats");
  if (s.type === "stats") {
    s.tone = "accent";
    s.props = {
      ...s.props,
      variant: "band",
      items: [
        { value: "4.9★", label: "Average guest rating" },
        { value: "1,200+", label: "Happy stays" },
        { value: "24/7", label: "Host support" },
      ],
    };
  }
  return s;
}

function ariaCtaBanner(): WebsiteSection {
  const s = newSection("cta");
  if (s.type === "cta") {
    s.tone = "dark";
    s.props = {
      ...s.props,
      heading: "Ready when you are",
      body: "Book direct for the best rate — no booking fees, ever.",
      button_label: "Book your dates",
      button_href: "#book",
      variant: "banner",
    };
  }
  return s;
}

function ariaRooms(): WebsiteSection {
  const s = newSection("rooms_preview");
  if (s.type === "rooms_preview") {
    s.props = { ...s.props, heading: "Where you'll stay" };
  }
  return s;
}

function ariaReviews(): WebsiteSection {
  const s = newSection("reviews");
  if (s.type === "reviews") {
    s.props = { ...s.props, heading: "Loved by guests", variant: "grid" };
  }
  return s;
}

function ariaIntro(): WebsiteSection {
  const s = newSection("intro");
  if (s.type === "intro") {
    s.props = {
      ...s.props,
      heading: "About your hosts",
      body: "Tell your story here — what makes the stay, and you, special.",
      variant: "lead",
    };
  }
  return s;
}

const ARIA_PRESETS: ThemeSectionPreset[] = [
  {
    key: "aria_hero_spotlight",
    label: "Hero — Spotlight",
    make: ariaHeroSpotlight,
  },
  {
    key: "aria_hero_split",
    label: "Hero — Split feature",
    make: ariaHeroSplit,
  },
  { key: "aria_feature_trio", label: "Feature trio", make: ariaFeatureTrio },
  { key: "aria_stats_band", label: "Stats band", make: ariaStatsBand },
  {
    key: "aria_cta_banner",
    label: "Closing call-to-action",
    make: ariaCtaBanner,
  },
];

const ARIA_TEMPLATES: ThemeTemplate[] = [
  {
    key: "aria_home",
    label: "Home",
    description:
      "Spotlight hero, features, rooms, stats, reviews and a closing CTA.",
    make: () => [
      ariaHeroSpotlight(),
      ariaFeatureTrio(),
      ariaRooms(),
      ariaStatsBand(),
      ariaReviews(),
      ariaCtaBanner(),
    ],
  },
  {
    key: "aria_about",
    label: "About",
    description: "Split hero, your story, what guests love, and a CTA.",
    make: () => [ariaHeroSplit(), ariaIntro(), ariaReviews(), ariaCtaBanner()],
  },
];

const PRESETS: Record<string, ThemeSectionPreset[]> = { aria: ARIA_PRESETS };
const TEMPLATES: Record<string, ThemeTemplate[]> = { aria: ARIA_TEMPLATES };

/** Designed section presets for a theme slug (empty when the theme ships none). */
export function getThemeSectionPresets(
  themeSlug: string | undefined | null,
): ThemeSectionPreset[] {
  return (themeSlug && PRESETS[themeSlug]) || [];
}

/** Designed page templates for a theme slug (empty when the theme ships none). */
export function getThemeTemplates(
  themeSlug: string | undefined | null,
): ThemeTemplate[] {
  return (themeSlug && TEMPLATES[themeSlug]) || [];
}

/** Human label for the sidebar theme group (capitalised slug, fallback "Theme"). */
export function themeGroupLabel(themeSlug: string | undefined | null): string {
  if (!themeSlug) return "Theme";
  return themeSlug.charAt(0).toUpperCase() + themeSlug.slice(1);
}
