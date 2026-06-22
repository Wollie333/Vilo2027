// Code-defined, professionally-designed section presets attached to a THEME.
//
// Each theme can ship a curated set of ready-made sections (pre-set variant +
// styling + starter copy) that the host "pulls in" from the builder sidebar's
// theme group, then edits photo/text/colour. These are NOT new section types —
// they're pre-configured instances of the existing curated sections, so they
// render + validate through the same schema with zero new plumbing.
//
// Adding a theme's set = add an entry to REGISTRY keyed by the theme slug
// (`SiteThemeConfig.preset`). Themes with no entry simply show no theme group.
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

// ── Aria (the modern flagship theme) ──────────────────────────────────────
const ARIA: ThemeSectionPreset[] = [
  {
    key: "aria_hero_spotlight",
    label: "Hero — Spotlight",
    make: () => {
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
    },
  },
  {
    key: "aria_hero_split",
    label: "Hero — Split feature",
    make: () => {
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
    },
  },
  {
    key: "aria_feature_trio",
    label: "Feature trio",
    make: () => {
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
    },
  },
  {
    key: "aria_stats_band",
    label: "Stats band",
    make: () => {
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
    },
  },
  {
    key: "aria_cta_banner",
    label: "Closing call-to-action",
    make: () => {
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
    },
  },
];

const REGISTRY: Record<string, ThemeSectionPreset[]> = {
  aria: ARIA,
};

/** Designed section presets for a theme slug (empty when the theme ships none). */
export function getThemeSectionPresets(
  themeSlug: string | undefined | null,
): ThemeSectionPreset[] {
  return (themeSlug && REGISTRY[themeSlug]) || [];
}

/** Human label for the sidebar theme group (capitalised slug, fallback "Theme"). */
export function themeGroupLabel(themeSlug: string | undefined | null): string {
  if (!themeSlug) return "Theme";
  return themeSlug.charAt(0).toUpperCase() + themeSlug.slice(1);
}
