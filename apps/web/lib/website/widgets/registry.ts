// Builder V2 — the Widget Registry.
//
// THE single source of truth for the standardized Wielo-block vocabulary. The
// library panel, the default-props factory, the inspector (Content tab) and the
// renderer all read from here — add a widget once, wire it everywhere.
//
// Contract: docs/features/BUILDER_V2_WIDGET_REGISTRY.md
//
// Defaults use the EXISTING brand-safe token vocabulary (size:"auto",
// color:"default", level:"h2", …) — never raw px/hex — so blocks inherit the
// active theme and stay on-brand. `dataKey` names the SiteData bucket an
// auto-populate widget reads at render (Phase 5).
import type { WidgetType } from "../pageDoc.schema";
import {
  ICON_VARIANTS,
  ROOM_CARD_VARIANTS,
  LOGO_VARIANTS,
  NAV_VARIANTS,
  SOCIAL_VARIANTS,
} from "./newTypes.schema";

export type WidgetGroup =
  | "basic"
  | "media"
  | "content"
  | "wielo"
  | "site"
  | "system";

/** Declarative inspector control (Content tab). Style/Advanced/Responsive are generic. */
export type WidgetControl =
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "textarea"; key: string; label: string }
  | { kind: "select"; key: string; label: string; options: [string, string][] }
  | { kind: "seg"; key: string; label: string; options: [string, string][] }
  // Ordered preset steps shown as a labelled slider (Elementor-style, but tied to
  // the theme's brand-safe scale). `steps` is [value, label] in ascending order;
  // the slider index maps to a value, and the current label is shown as a readout.
  | { kind: "scale"; key: string; label: string; steps: [string, string][] }
  | {
      kind: "range";
      key: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      suffix?: string;
    }
  | { kind: "toggle"; key: string; label: string; hint?: string }
  | { kind: "align"; key: string; label: string }
  | { kind: "color"; key: string; label: string }
  // Dynamic select of the site's live rooms (options injected by the builder).
  | { kind: "roompicker"; key: string; label: string }
  // A small uppercase section label that groups the controls beneath it (e.g.
  // "Typography", "Link") so a long inspector panel reads cleanly.
  | { kind: "group"; label: string }
  | { kind: "hint"; text: string };

/**
 * Which per-element style controls to show for a block's sub-element. Each maps to
 * one or more `--el-<key>-*` CSS vars the block's component reads:
 *   bg → --el-<key>-bg · color → -fg · border → -bdw + -bdc · radius → -radius ·
 *   size → -size (font-size) · weight → -weight (font-weight) ·
 *   lineHeight → -lh · letterSpacing → -ls · transform → -tt (text-transform)
 */
export type ElementControlKind =
  | "bg"
  | "color"
  | "border"
  | "radius"
  | "size"
  | "weight"
  | "lineHeight"
  | "letterSpacing"
  | "transform";

/** A stylable sub-element of a composite block (drives the inspector Elements UI). */
export type ElementDef = {
  /** Element key — must match the `--el-<key>-*` vars the component reads. */
  key: string;
  /** Human label in the inspector accordion. */
  label: string;
  /** Which style controls this element exposes. */
  controls: ElementControlKind[];
};

export interface WidgetDef {
  type: WidgetType;
  group: WidgetGroup;
  label: string;
  /** lucide-react icon name (the library component resolves it). */
  icon: string;
  /** Auto-populate widgets read live data from SiteData[node.id]. */
  autoPopulate?: boolean;
  /** SiteData bucket / legacy section type reused for data + shared render. */
  dataKey?: string;
  /**
   * Contextual widgets: the library only OFFERS this widget on a page whose
   * `kind` is listed here (room-scoped blocks need the room_detail route's active
   * room; search_results needs the search page). Undefined = available on any page.
   */
  pageKinds?: readonly string[];
  /** Shared layout variants; the theme blueprint picks the default (index 0). */
  variants?: [string, string][];
  /** Initial props on drop — existing token vocabulary, brand-safe. */
  defaults: Record<string, unknown>;
  /** Content-tab controls — the WORDS / images / uploaded icons / links only. */
  content: WidgetControl[];
  /**
   * Style-tab controls — everything visual (colour · size · spacing · radius …).
   * Rendered above the generic block-frame controls. Same declarative kinds as
   * `content`; both write to `node.props`. Keeping content vs style split uniform
   * across every element is the whole point (content = what, style = how it looks).
   */
  style?: WidgetControl[];
  /**
   * Stylable sub-elements (Elementor-style per-element styling). Drives the Style
   * tab's "Elements" accordion; each element's controls write `node.elements[key]`
   * (per-device via the responsive layer). Undefined = block-level styling only.
   */
  elements?: ElementDef[];
}

const ALIGN_CTL = (key = "align"): WidgetControl => ({
  kind: "align",
  key,
  label: "Alignment",
});

// Policies (property + room) — label/value pairs.
const POLICY_ELEMENTS: ElementDef[] = [
  { key: "label", label: "Label", controls: ["color"] },
  { key: "value", label: "Value", controls: ["color", "size"] },
];
// Rate list / seasonal cards — card + room/season label + price.
const RATE_LIST_ELEMENTS: ElementDef[] = [
  { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
  { key: "label", label: "Label", controls: ["color", "size"] },
  { key: "price", label: "Price", controls: ["color", "size", "weight"] },
];
// Shared per-element styling for the card-grid Wielo blocks (specials / add-ons —
// same card anatomy). Keys match the `--el-<key>-*` vars each component reads.
const SPECIAL_CARD_ELEMENTS: ElementDef[] = [
  { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
  { key: "image", label: "Image", controls: ["radius"] },
  { key: "badge", label: "Badge", controls: ["bg", "color", "radius"] },
  { key: "title", label: "Title", controls: ["color", "size", "weight"] },
  { key: "desc", label: "Description", controls: ["color", "size"] },
  { key: "price", label: "Price", controls: ["color", "size", "weight"] },
  {
    key: "button",
    label: "Button",
    controls: ["bg", "color", "border", "radius"],
  },
];

// Brand-safe typography scales shared by the text elements — presented as
// labelled sliders (see the "scale" control). "Auto" inherits the theme (a
// heading uses its level size/weight; body uses the base) so a host can nudge
// size/weight without going off the theme's type scale.
const SIZE_STEPS: [string, string][] = [
  ["auto", "Auto"],
  ["xs", "XS"],
  ["sm", "S"],
  ["md", "M"],
  ["lg", "L"],
  ["xl", "XL"],
  ["2xl", "2XL"],
];
const WEIGHT_STEPS: [string, string][] = [
  ["auto", "Auto"],
  ["light", "Light"],
  ["normal", "Regular"],
  ["medium", "Medium"],
  ["semibold", "Semibold"],
  ["bold", "Bold"],
];
// "Auto" keeps the theme's own leading/tracking; the rest are common presets.
const LINE_HEIGHT_STEPS: [string, string][] = [
  ["auto", "Auto"],
  ["1", "1.0"],
  ["1.15", "1.15"],
  ["1.3", "1.3"],
  ["1.5", "1.5"],
  ["1.75", "1.75"],
  ["2", "2.0"],
];
const LETTER_SPACING_STEPS: [string, string][] = [
  ["auto", "Auto"],
  ["-1", "-1"],
  ["0", "0"],
  ["0.5", "0.5"],
  ["1", "1"],
  ["2", "2"],
  ["4", "4"],
];
const TRANSFORM_CTL: WidgetControl = {
  kind: "seg",
  key: "transform",
  label: "Text case",
  options: [
    ["none", "Aa"],
    ["uppercase", "AG"],
    ["lowercase", "ag"],
    ["capitalize", "Ap"],
  ],
};
// Text elements share one professional typography panel (grouped for readability):
// size · weight · line-height · letter-spacing · case · colour.
const TYPOGRAPHY_CTLS: WidgetControl[] = [
  { kind: "group", label: "Typography" },
  { kind: "scale", key: "size", label: "Font size", steps: SIZE_STEPS },
  { kind: "scale", key: "weight", label: "Font weight", steps: WEIGHT_STEPS },
  {
    kind: "scale",
    key: "lineHeight",
    label: "Line height",
    steps: LINE_HEIGHT_STEPS,
  },
  {
    kind: "scale",
    key: "letterSpacing",
    label: "Letter spacing",
    steps: LETTER_SPACING_STEPS,
  },
  TRANSFORM_CTL,
  { kind: "color", key: "color", label: "Text colour" },
];

export const WIDGET_DEFS: Record<WidgetType, WidgetDef> = {
  // ── Basics ──────────────────────────────────────────────
  el_heading: {
    type: "el_heading",
    group: "basic",
    label: "Heading",
    icon: "Heading",
    defaults: {
      text: "A little house that feeds you well",
      level: "h2",
      align: "left",
      size: "auto",
      weight: "auto",
      color: "default",
    },
    content: [
      { kind: "text", key: "text", label: "Text" },
      {
        kind: "select",
        key: "level",
        label: "HTML tag",
        options: [
          ["h1", "H1"],
          ["h2", "H2"],
          ["h3", "H3"],
          ["h4", "H4"],
          ["p", "Paragraph"],
        ],
      },
    ],
    style: [...TYPOGRAPHY_CTLS, ALIGN_CTL()],
  },
  el_text: {
    type: "el_text",
    group: "basic",
    label: "Text",
    icon: "Type",
    defaults: {
      body: "Five sunny rooms in a restored parsonage, a garden full of figs, and a breakfast worth setting an alarm for.",
      align: "left",
      size: "auto",
      weight: "auto",
      color: "default",
    },
    content: [{ kind: "textarea", key: "body", label: "Text" }],
    style: [...TYPOGRAPHY_CTLS, ALIGN_CTL()],
  },
  el_button: {
    type: "el_button",
    group: "basic",
    label: "Button",
    icon: "MousePointerClick",
    defaults: {
      label: "Book a room",
      href: "#",
      variant: "primary",
      size: "md",
      align: "left",
    },
    content: [
      { kind: "text", key: "label", label: "Label" },
      { kind: "text", key: "href", label: "Link", placeholder: "https://" },
    ],
    style: [
      {
        kind: "seg",
        key: "variant",
        label: "Type",
        options: [
          ["primary", "Primary"],
          ["secondary", "Secondary"],
        ],
      },
      {
        kind: "seg",
        key: "size",
        label: "Size",
        options: [
          ["sm", "S"],
          ["md", "M"],
          ["lg", "L"],
        ],
      },
      {
        kind: "scale",
        key: "radius",
        label: "Corner radius",
        steps: [
          ["auto", "Auto"],
          ["0", "0"],
          ["6", "6"],
          ["10", "10"],
          ["16", "16"],
          ["24", "24"],
          ["999", "Pill"],
        ],
      },
      { kind: "toggle", key: "full_width", label: "Full width" },
      ALIGN_CTL(),
    ],
  },
  el_image: {
    type: "el_image",
    group: "basic",
    label: "Image",
    icon: "Image",
    defaults: { image_path: "", alt: "", width: "full", align: "center" },
    content: [
      { kind: "text", key: "image_path", label: "Image" },
      { kind: "text", key: "alt", label: "Alt text" },
      {
        kind: "hint",
        text: "In the builder, click the image to upload from your media library.",
      },
    ],
    style: [
      {
        kind: "seg",
        key: "width",
        label: "Width",
        options: [
          ["narrow", "Narrow"],
          ["medium", "Medium"],
          ["full", "Full"],
        ],
      },
      {
        kind: "scale",
        key: "radius",
        label: "Corner radius",
        steps: [
          ["auto", "Auto"],
          ["0", "0"],
          ["6", "6"],
          ["12", "12"],
          ["20", "20"],
          ["32", "32"],
          ["999", "Pill"],
        ],
      },
      {
        kind: "seg",
        key: "shadow",
        label: "Shadow",
        options: [
          ["auto", "Auto"],
          ["none", "None"],
          ["sm", "S"],
          ["md", "M"],
          ["lg", "L"],
        ],
      },
      ALIGN_CTL(),
    ],
  },
  el_divider: {
    type: "el_divider",
    group: "basic",
    label: "Divider",
    icon: "Minus",
    defaults: { line: "solid", thickness: "thin", width: "full" },
    content: [
      {
        kind: "hint",
        text: "A divider has no text — style it in the Style tab.",
      },
    ],
    style: [
      {
        kind: "seg",
        key: "line",
        label: "Line",
        options: [
          ["solid", "Solid"],
          ["dashed", "Dashed"],
          ["dotted", "Dotted"],
        ],
      },
      {
        kind: "seg",
        key: "thickness",
        label: "Thickness",
        options: [
          ["thin", "Thin"],
          ["medium", "Medium"],
          ["thick", "Thick"],
        ],
      },
      {
        kind: "seg",
        key: "width",
        label: "Width",
        options: [
          ["narrow", "Narrow"],
          ["full", "Full"],
        ],
      },
      { kind: "color", key: "color", label: "Colour" },
    ],
  },
  el_spacer: {
    type: "el_spacer",
    group: "basic",
    label: "Spacer",
    icon: "MoveVertical",
    defaults: { size: "md" },
    content: [
      {
        kind: "hint",
        text: "A spacer has no text — set its height in the Style tab.",
      },
    ],
    style: [
      {
        kind: "seg",
        key: "size",
        label: "Height",
        options: [
          ["xs", "XS"],
          ["sm", "S"],
          ["md", "M"],
          ["lg", "L"],
          ["xl", "XL"],
          ["2xl", "2XL"],
        ],
      },
    ],
  },
  el_icon: {
    type: "el_icon",
    group: "basic",
    label: "Icon Box",
    icon: "Sparkles",
    variants: [...ICON_VARIANTS].map((v) => [
      v,
      v[0].toUpperCase() + v.slice(1),
    ]) as [string, string][],
    defaults: {
      glyph: "☕",
      title: "Breakfast in the garden",
      body: "Fig jam, fresh bread and eggs from the hens out back.",
      color: "accent",
      align: "center",
    },
    content: [
      { kind: "text", key: "glyph", label: "Icon / emoji" },
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "body", label: "Description" },
    ],
    style: [
      {
        kind: "scale",
        key: "icon_size",
        label: "Icon size",
        steps: [
          ["auto", "Auto"],
          ["24", "24"],
          ["34", "34"],
          ["44", "44"],
          ["56", "56"],
          ["72", "72"],
          ["96", "96"],
        ],
      },
      { kind: "color", key: "color", label: "Icon colour" },
      ALIGN_CTL(),
    ],
  },

  // ── Media ───────────────────────────────────────────────
  gallery: {
    type: "gallery",
    group: "media",
    label: "Gallery",
    icon: "LayoutGrid",
    autoPopulate: true,
    dataKey: "gallery",
    variants: [
      ["grid", "Grid"],
      ["list", "List"],
      ["carousel", "Carousel"],
    ],
    defaults: { heading: "", layout: "grid", max: 12 },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      {
        kind: "range",
        key: "max",
        label: "Images",
        min: 1,
        max: 30,
        suffix: "",
      },
    ],
    elements: [{ key: "image", label: "Image", controls: ["radius"] }],
  },
  video: {
    type: "video",
    group: "media",
    label: "Video",
    icon: "Play",
    defaults: { heading: "", url: "", caption: "" },
    content: [
      {
        kind: "text",
        key: "url",
        label: "Video URL",
        placeholder: "YouTube / Vimeo",
      },
      { kind: "text", key: "caption", label: "Caption" },
    ],
  },

  // ── Content blocks (theme-composite marketing sections) ─────
  hero: {
    type: "hero",
    group: "content",
    label: "Hero",
    icon: "Image",
    variants: [
      ["spotlight", "Spotlight"],
      ["fullscreen", "Full screen"],
      ["split_right", "Split right"],
      ["split_left", "Split left"],
      ["minimal", "Minimal"],
      ["boxed", "Boxed"],
      ["search", "Search"],
    ],
    defaults: {
      headline: "Your headline here",
      subheadline: "A short welcoming line beneath it.",
      align: "center",
      variant: "spotlight",
      overlay: "medium",
      textTone: "auto",
      height: "auto",
    },
    content: [
      { kind: "text", key: "headline", label: "Headline" },
      { kind: "textarea", key: "subheadline", label: "Subheadline" },
      { kind: "text", key: "cta_label", label: "Button label" },
      { kind: "text", key: "cta_href", label: "Button link" },
      ALIGN_CTL(),
    ],
  },
  intro: {
    type: "intro",
    group: "content",
    label: "Intro",
    icon: "AlignLeft",
    variants: [
      ["centered", "Centered"],
      ["story", "Story"],
    ],
    defaults: {
      heading: "Welcome",
      body: "Tell guests what makes your place special.",
      variant: "centered",
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "textarea", key: "body", label: "Body" },
    ],
  },
  highlights: {
    type: "highlights",
    group: "content",
    label: "Highlights",
    icon: "Star",
    defaults: {
      heading: "Why guests come back",
      variant: "grid",
      items: [
        { title: "Direct rates", body: "No platform markup." },
        { title: "Personal welcome", body: "We host every guest ourselves." },
        { title: "Great location", body: "Close to everything that matters." },
      ],
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      {
        kind: "hint",
        text: "Restyle via Style & Advanced; per-item editing lands in a later slice.",
      },
    ],
    elements: [
      { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
      { key: "icon", label: "Icon", controls: ["color"] },
      { key: "title", label: "Title", controls: ["color", "size", "weight"] },
      { key: "body", label: "Body", controls: ["color", "size"] },
    ],
  },
  stats: {
    type: "stats",
    group: "content",
    label: "Stats",
    icon: "BarChart3",
    defaults: {
      heading: "By the numbers",
      variant: "band",
      items: [
        { value: "500+", label: "Happy guests" },
        { value: "4.9", label: "Average rating" },
        { value: "10 yrs", label: "Hosting experience" },
      ],
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "hint", text: "Stat items are editable in a later slice." },
    ],
    elements: [
      { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
      { key: "value", label: "Value", controls: ["color", "size", "weight"] },
      { key: "label", label: "Label", controls: ["color", "size"] },
    ],
  },
  cta: {
    type: "cta",
    group: "content",
    label: "Call to action",
    icon: "MousePointerClick",
    defaults: {
      heading: "Ready to book?",
      body: "Reserve your dates directly — no booking fees.",
      button_label: "Check availability",
      button_href: "#rooms",
      variant: "banner",
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "textarea", key: "body", label: "Body" },
      { kind: "text", key: "button_label", label: "Button label" },
      { kind: "text", key: "button_href", label: "Button link" },
    ],
  },
  host_bio: {
    type: "host_bio",
    group: "content",
    label: "Host bio",
    icon: "UserRound",
    defaults: {
      heading: "Your host",
      variant: "side",
      name: "",
      body: "A few warm lines about you and your team.",
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "text", key: "name", label: "Host name" },
      { kind: "textarea", key: "body", label: "Bio" },
    ],
    elements: [
      { key: "photo", label: "Photo", controls: ["radius"] },
      { key: "name", label: "Name", controls: ["color", "size", "weight"] },
      { key: "body", label: "Bio", controls: ["color", "size"] },
    ],
  },
  values: {
    type: "values",
    group: "content",
    label: "Values",
    icon: "Heart",
    defaults: {
      heading: "How we host",
      variant: "border",
      items: [
        { title: "Thoughtful", body: "The little touches guests remember." },
        { title: "Local", body: "We point you to the best of the area." },
      ],
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "hint", text: "Value items are editable in a later slice." },
    ],
    elements: [
      { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
      { key: "title", label: "Title", controls: ["color", "size", "weight"] },
      { key: "body", label: "Body", controls: ["color", "size"] },
    ],
  },
  rich_text: {
    type: "rich_text",
    group: "content",
    label: "Rich text",
    icon: "Type",
    defaults: { html: "<p>Add your own text here.</p>", variant: "narrow" },
    content: [{ kind: "textarea", key: "html", label: "Text (HTML)" }],
  },
  faq: {
    type: "faq",
    group: "content",
    label: "FAQ",
    icon: "HelpCircle",
    defaults: {
      heading: "Good to know",
      variant: "accordion",
      items: [{ q: "Is there Wi-Fi?", a: "Yes — free, uncapped." }],
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "hint", text: "Q&A items are editable in a later slice." },
    ],
    elements: [
      { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
      {
        key: "question",
        label: "Question",
        controls: ["color", "size", "weight"],
      },
      { key: "answer", label: "Answer", controls: ["color", "size"] },
    ],
  },
  pricing: {
    type: "pricing",
    group: "content",
    label: "Pricing",
    icon: "DollarSign",
    defaults: {
      heading: "Rates",
      items: [
        { label: "Standard room", price: "R1 200", note: "per night" },
        { label: "Deluxe suite", price: "R2 400", note: "per night" },
      ],
      footnote:
        "Rates are indicative — your final price is confirmed at booking.",
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "text", key: "footnote", label: "Footnote" },
    ],
    elements: [
      { key: "card", label: "Table", controls: ["bg", "radius"] },
      { key: "label", label: "Label", controls: ["color", "size"] },
      { key: "price", label: "Price", controls: ["color", "size", "weight"] },
    ],
  },
  logos: {
    type: "logos",
    group: "content",
    label: "Logos",
    icon: "BadgeCheck",
    defaults: { heading: "As featured in", items: [], variant: "row" },
    content: [{ kind: "text", key: "heading", label: "Heading" }],
  },
  trust: {
    type: "trust",
    group: "content",
    label: "Trust badges",
    icon: "ShieldCheck",
    defaults: {
      heading: "Book with confidence",
      show_review_score: true,
      variant: "badges",
      items: [
        { icon: "🔒", label: "Secure payments" },
        { icon: "✅", label: "Verified host" },
        { icon: "🏅", label: "Superhost award" },
      ],
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "toggle", key: "show_review_score", label: "Show review score" },
    ],
    elements: [
      { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
      { key: "icon", label: "Icon", controls: ["color"] },
      { key: "label", label: "Label", controls: ["color", "size"] },
      { key: "caption", label: "Caption", controls: ["color"] },
    ],
  },

  // ── Wielo blocks (auto-populate) ────────────────────────
  rooms_preview: {
    type: "rooms_preview",
    group: "wielo",
    label: "Rooms Grid",
    icon: "BedDouble",
    autoPopulate: true,
    dataKey: "rooms_preview",
    variants: [
      ["grid", "Grid"],
      ["showcase", "Showcase"],
    ],
    defaults: {
      heading: "Pick a room, any room",
      layout: "grid",
      max: 6,
      display: "grid",
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "range", key: "max", label: "Rooms shown", min: 1, max: 12 },
    ],
    // Elementor-style per-element styling — each maps to `--el-<key>-*` vars read
    // by RoomsPreviewSection's room card. Keys MUST match the component.
    elements: [
      { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
      { key: "image", label: "Image", controls: ["radius"] },
      {
        key: "title",
        label: "Title",
        controls: [
          "color",
          "size",
          "weight",
          "lineHeight",
          "letterSpacing",
          "transform",
        ],
      },
      {
        key: "price",
        label: "Price",
        controls: ["color", "size", "weight", "letterSpacing"],
      },
      {
        key: "desc",
        label: "Description",
        controls: ["color", "size", "lineHeight", "letterSpacing"],
      },
      {
        key: "button",
        label: "Button",
        controls: ["bg", "color", "border", "radius"],
      },
      { key: "badge", label: "Badge", controls: ["bg", "color", "radius"] },
    ],
  },
  amenities: {
    type: "amenities",
    group: "wielo",
    label: "Amenities",
    icon: "Sparkles",
    autoPopulate: true,
    dataKey: "amenities",
    variants: [
      ["grid", "Grid"],
      ["inline", "Inline pills"],
    ],
    defaults: { heading: "Facilities", items: [], variant: "grid" },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      {
        kind: "hint",
        text: "Amenities come from your property — use “Edit amenities…” to choose them.",
      },
    ],
    elements: [
      { key: "card", label: "Chip", controls: ["bg", "radius"] },
      { key: "icon", label: "Icon", controls: ["color"] },
      { key: "label", label: "Label", controls: ["color", "size"] },
    ],
  },
  addons_preview: {
    type: "addons_preview",
    group: "wielo",
    label: "Add-ons",
    icon: "PlusCircle",
    autoPopulate: true,
    dataKey: "addons_preview",
    defaults: { heading: "Add-ons & extras", layout: "grid", max: 6 },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "range", key: "max", label: "Add-ons shown", min: 1, max: 12 },
    ],
    // Add-on cards have no per-card button (the block CTA covers it).
    elements: SPECIAL_CARD_ELEMENTS.filter((e) => e.key !== "button"),
  },
  blog_preview: {
    type: "blog_preview",
    group: "wielo",
    label: "Journal",
    icon: "Newspaper",
    autoPopulate: true,
    dataKey: "blog_preview",
    variants: [
      ["grid", "Grid"],
      ["list", "List"],
    ],
    defaults: {
      heading: "From the journal",
      max: 3,
      variant: "grid",
      display: "grid",
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "range", key: "max", label: "Posts shown", min: 1, max: 12 },
    ],
    elements: [
      { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
      { key: "image", label: "Image", controls: ["radius"] },
      { key: "meta", label: "Date", controls: ["color"] },
      { key: "title", label: "Title", controls: ["color", "size", "weight"] },
      { key: "excerpt", label: "Excerpt", controls: ["color", "size"] },
    ],
  },
  policies: {
    type: "policies",
    group: "wielo",
    label: "Policies",
    icon: "ScrollText",
    autoPopulate: true,
    dataKey: "policies",
    defaults: { heading: "Things to know", variant: "grid" },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      {
        kind: "hint",
        text: "Check-in/out, cancellation and house rules come from your property.",
      },
    ],
    elements: POLICY_ELEMENTS,
  },
  rate_table: {
    type: "rate_table",
    group: "wielo",
    label: "Rate Table",
    icon: "Table",
    autoPopulate: true,
    dataKey: "rate_table",
    defaults: {
      heading: "Our rates",
      note: "Rates are per night from — your final price is confirmed at checkout.",
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "text", key: "note", label: "Note" },
    ],
    elements: [
      { key: "card", label: "Table", controls: ["bg", "border", "radius"] },
      { key: "label", label: "Room name", controls: ["color", "size"] },
      { key: "price", label: "Price", controls: ["color", "size", "weight"] },
      {
        key: "button",
        label: "Button",
        controls: ["bg", "color", "border", "radius"],
      },
    ],
  },
  room_rates: {
    type: "room_rates",
    group: "wielo",
    label: "Room Rates",
    icon: "Tag",
    autoPopulate: true,
    dataKey: "room_rates",
    defaults: {
      heading: "Room rates",
      note: "Per night, from.",
      source: "auto",
      items: [],
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "text", key: "note", label: "Note" },
    ],
    elements: RATE_LIST_ELEMENTS,
  },
  seasonal_pricing: {
    type: "seasonal_pricing",
    group: "wielo",
    label: "Seasonal Pricing",
    icon: "CalendarRange",
    autoPopulate: true,
    dataKey: "seasonal_pricing",
    defaults: {
      heading: "Seasonal pricing",
      note: "Rates vary by season.",
      source: "auto",
      items: [],
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "text", key: "note", label: "Note" },
    ],
    elements: RATE_LIST_ELEMENTS,
  },
  el_room_card: {
    type: "el_room_card",
    group: "wielo",
    label: "Room Card",
    icon: "RectangleHorizontal",
    autoPopulate: true,
    dataKey: "el_room_card",
    variants: [...ROOM_CARD_VARIANTS].map((v) => [
      v,
      v[0].toUpperCase() + v.slice(1),
    ]) as [string, string][],
    defaults: { room_id: "", show_price: true, show_meta: true },
    content: [
      { kind: "roompicker", key: "room_id", label: "Room" },
      { kind: "toggle", key: "show_price", label: "Show price" },
      { kind: "toggle", key: "show_meta", label: "Show details" },
    ],
  },
  booking_search: {
    type: "booking_search",
    group: "wielo",
    label: "Booking Bar",
    icon: "CalendarSearch",
    autoPopulate: true,
    dataKey: "booking_search",
    variants: [
      ["bar", "Bar"],
      ["search", "Date search"],
      ["searchbar", "Search bar"],
    ],
    defaults: { heading: "", ctaLabel: "Check availability" },
    content: [
      { kind: "text", key: "ctaLabel", label: "Button label" },
      {
        kind: "hint",
        text: "Dates + guests search the live availability engine — prices are always recalculated server-side.",
      },
    ],
  },
  availability_calendar: {
    type: "availability_calendar",
    group: "wielo",
    label: "Date Search",
    icon: "CalendarDays",
    autoPopulate: true,
    dataKey: "availability_calendar",
    defaults: { heading: "", months: 1 },
    content: [
      {
        kind: "seg",
        key: "months",
        label: "Months shown",
        options: [
          ["1", "1"],
          ["2", "2"],
        ],
      },
    ],
  },
  reviews: {
    type: "reviews",
    group: "wielo",
    label: "Reviews",
    icon: "Star",
    autoPopulate: true,
    dataKey: "reviews",
    variants: [
      ["grid", "Grid"],
      ["list", "List"],
      ["plain", "Plain"],
    ],
    defaults: { heading: "What people write home", max: 6 },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "range", key: "max", label: "Reviews", min: 1, max: 30 },
    ],
    // Per-element styling — keys match the `--el-<key>-*` vars ReviewsSection reads.
    elements: [
      { key: "card", label: "Card", controls: ["bg", "border", "radius"] },
      {
        key: "quote",
        label: "Quote",
        controls: ["color", "size", "lineHeight", "letterSpacing"],
      },
      { key: "author", label: "Author", controls: ["color", "size", "weight"] },
    ],
  },
  specials_preview: {
    type: "specials_preview",
    group: "wielo",
    label: "Specials",
    icon: "Tag",
    autoPopulate: true,
    dataKey: "specials_preview",
    defaults: { heading: "Specials", layout: "grid", max: 6 },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "range", key: "max", label: "Specials shown", min: 1, max: 12 },
    ],
    elements: SPECIAL_CARD_ELEMENTS,
  },
  location: {
    type: "location",
    group: "wielo",
    label: "Map / Contact",
    icon: "MapPin",
    autoPopulate: true,
    dataKey: "location",
    variants: [
      ["split", "Split"],
      ["stacked", "Stacked"],
      ["list", "List"],
    ],
    defaults: { heading: "Finding us", show_map: true },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "textarea", key: "body", label: "Body" },
      { kind: "toggle", key: "show_map", label: "Show map" },
    ],
    elements: [
      { key: "card", label: "Map", controls: ["bg", "border", "radius"] },
      { key: "address", label: "Address", controls: ["color"] },
      { key: "poi", label: "Places", controls: ["color", "size"] },
    ],
  },
  map: {
    type: "map",
    group: "wielo",
    label: "Map",
    icon: "Map",
    variants: [
      ["boxed", "Boxed"],
      ["wide", "Wide"],
    ],
    defaults: { heading: "", address: "", zoom: 14 },
    content: [
      { kind: "text", key: "address", label: "Address" },
      { kind: "text", key: "caption", label: "Caption" },
    ],
  },

  // ── Site parts ──────────────────────────────────────────
  el_logo: {
    type: "el_logo",
    group: "site",
    label: "Logo",
    icon: "Hexagon",
    variants: [...LOGO_VARIANTS].map((v) => [v, v]) as [string, string][],
    defaults: { style: "markName", align: "left" },
    content: [
      {
        kind: "seg",
        key: "style",
        label: "Show",
        options: [
          ["markName", "Mark + name"],
          ["name", "Name only"],
          ["mark", "Mark only"],
        ],
      },
      { kind: "hint", text: "Reads your logo + name from Brand Studio." },
    ],
    style: [
      {
        kind: "seg",
        key: "size",
        label: "Size",
        options: [
          ["sm", "S"],
          ["md", "M"],
          ["lg", "L"],
        ],
      },
      ALIGN_CTL(),
    ],
  },
  el_nav: {
    type: "el_nav",
    group: "site",
    label: "Nav Menu",
    icon: "Menu",
    variants: [...NAV_VARIANTS].map((v) => [
      v,
      v[0].toUpperCase() + v.slice(1),
    ]) as [string, string][],
    defaults: { source: "menu", color: "default", align: "center" },
    content: [
      {
        kind: "seg",
        key: "source",
        label: "Source",
        options: [
          ["menu", "Menu builder"],
          ["custom", "Custom"],
        ],
      },
      {
        kind: "text",
        key: "items",
        label: "Custom links",
        placeholder: "Comma-separated",
      },
      {
        kind: "hint",
        text: "Header & menu are managed in the Nav builder — this is for the footer / in-page.",
      },
    ],
    style: [{ kind: "color", key: "color", label: "Link colour" }, ALIGN_CTL()],
  },
  el_social: {
    type: "el_social",
    group: "site",
    label: "Social Icons",
    icon: "Share2",
    variants: [...SOCIAL_VARIANTS].map((v) => [
      v,
      v[0].toUpperCase() + v.slice(1),
    ]) as [string, string][],
    defaults: { source: "brand", color: "default", align: "left" },
    content: [
      {
        kind: "seg",
        key: "source",
        label: "Source",
        options: [
          ["brand", "Brand Studio"],
          ["custom", "Custom"],
        ],
      },
      {
        kind: "text",
        key: "networks",
        label: "Networks",
        placeholder: "instagram, facebook, x",
      },
    ],
    style: [
      { kind: "color", key: "color", label: "Colour" },
      {
        kind: "scale",
        key: "icon_size",
        label: "Icon size",
        steps: [
          ["auto", "Auto"],
          ["30", "30"],
          ["38", "38"],
          ["46", "46"],
          ["56", "56"],
        ],
      },
      ALIGN_CTL(),
    ],
  },

  // ── System / page-template blocks (contextual — see `pageKinds`) ──
  // Search-results page: a search form + live list of available stays.
  search_results: {
    type: "search_results",
    group: "system",
    label: "Search Results",
    icon: "ListFilter",
    autoPopulate: true,
    dataKey: "search_results",
    pageKinds: ["search_results"],
    defaults: {
      heading: "Available stays",
      body: "Choose your dates to see what’s open — book direct for the best rate.",
    },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "textarea", key: "body", label: "Intro" },
      {
        kind: "hint",
        text: "Dates search the live availability engine — prices are always recalculated server-side.",
      },
    ],
  },
  // Room detail: the SINGLE room in scope (injected by the /rooms/<slug> route).
  room_gallery: {
    type: "room_gallery",
    group: "system",
    label: "Room Gallery",
    icon: "Images",
    autoPopulate: true,
    dataKey: "room_gallery",
    pageKinds: ["room_detail"],
    variants: [
      ["carousel", "Carousel"],
      ["mosaic", "Mosaic"],
      ["grid", "Grid"],
      ["stacked", "Stacked"],
    ],
    defaults: { max: 12 },
    content: [
      { kind: "range", key: "max", label: "Photos", min: 1, max: 30 },
      { kind: "hint", text: "Shows the photos of the room being viewed." },
    ],
    elements: [{ key: "image", label: "Image", controls: ["radius"] }],
  },
  room_overview: {
    type: "room_overview",
    group: "system",
    label: "Room Overview",
    icon: "DoorOpen",
    autoPopulate: true,
    dataKey: "room_overview",
    pageKinds: ["room_detail"],
    variants: [
      ["split", "Split"],
      ["stacked", "Stacked"],
    ],
    defaults: { show_facts: true, show_price: true },
    content: [
      { kind: "text", key: "heading", label: "Heading override" },
      { kind: "toggle", key: "show_facts", label: "Show room facts" },
      { kind: "toggle", key: "show_price", label: "Show price + book" },
      {
        kind: "hint",
        text: "Name, facts, description + price come from the room being viewed.",
      },
    ],
  },
  room_amenities: {
    type: "room_amenities",
    group: "system",
    label: "Room Amenities",
    icon: "ListChecks",
    autoPopulate: true,
    dataKey: "room_amenities",
    pageKinds: ["room_detail"],
    variants: [
      ["grid", "Grid"],
      ["list", "List"],
    ],
    defaults: { heading: "Room amenities" },
    content: [{ kind: "text", key: "heading", label: "Heading" }],
  },
  room_rate: {
    type: "room_rate",
    group: "system",
    label: "Room Rate + Book",
    icon: "BadgeDollarSign",
    autoPopulate: true,
    dataKey: "room_rate",
    pageKinds: ["room_detail"],
    variants: [
      ["card", "Card"],
      ["banner", "Banner"],
    ],
    defaults: { cta_label: "Book this room" },
    content: [
      { kind: "text", key: "heading", label: "Heading" },
      { kind: "text", key: "cta_label", label: "Button label" },
      { kind: "text", key: "note", label: "Note" },
    ],
  },
  room_policies: {
    type: "room_policies",
    group: "system",
    label: "Room Policies",
    icon: "ScrollText",
    autoPopulate: true,
    dataKey: "room_policies",
    pageKinds: ["room_detail"],
    variants: [
      ["grid", "Grid"],
      ["list", "List"],
    ],
    defaults: { heading: "Things to know" },
    content: [{ kind: "text", key: "heading", label: "Heading" }],
    elements: POLICY_ELEMENTS,
  },
};

/** Library grouping order + labels (matches the prototype). */
export const WIDGET_GROUPS: [WidgetGroup, string][] = [
  ["basic", "Basics"],
  ["media", "Media"],
  ["content", "Content blocks"],
  ["wielo", "Wielo blocks"],
  ["site", "Site parts"],
  ["system", "Room & search"],
];

export function widgetDef(type: WidgetType): WidgetDef {
  return WIDGET_DEFS[type];
}

/**
 * Whether the drag-library should OFFER this widget on a page of the given kind.
 * A widget with no `pageKinds` is universal; a contextual one (room-scoped blocks,
 * search_results) is offered only on its matching page kind — dropping it elsewhere
 * would render an empty placeholder (no room / no search in scope).
 */
export function widgetAvailableOnPage(
  def: WidgetDef,
  pageKind?: string,
): boolean {
  if (!def.pageKinds) return true;
  return !!pageKind && def.pageKinds.includes(pageKind);
}

/** A fresh copy of a widget's default props (deep-cloned so nodes never share refs). */
export function widgetDefaults(type: WidgetType): Record<string, unknown> {
  return structuredClone(WIDGET_DEFS[type].defaults);
}
