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

export type WidgetGroup = "basic" | "media" | "wielo" | "site";

/** Declarative inspector control (Content tab). Style/Advanced/Responsive are generic. */
export type WidgetControl =
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "textarea"; key: string; label: string }
  | { kind: "select"; key: string; label: string; options: [string, string][] }
  | { kind: "seg"; key: string; label: string; options: [string, string][] }
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
  | { kind: "hint"; text: string };

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
  /** Shared layout variants; the theme blueprint picks the default (index 0). */
  variants?: [string, string][];
  /** Initial props on drop — existing token vocabulary, brand-safe. */
  defaults: Record<string, unknown>;
  /** Content-tab controls (Style/Advanced/Responsive are generic + shared). */
  content: WidgetControl[];
}

const ALIGN_CTL = (key = "align"): WidgetControl => ({
  kind: "align",
  key,
  label: "Alignment",
});

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
      ALIGN_CTL(),
    ],
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
    content: [{ kind: "textarea", key: "body", label: "Text" }, ALIGN_CTL()],
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
      {
        kind: "seg",
        key: "variant",
        label: "Style",
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
        kind: "seg",
        key: "width",
        label: "Width",
        options: [
          ["narrow", "Narrow"],
          ["medium", "Medium"],
          ["full", "Full"],
        ],
      },
      ALIGN_CTL(),
      {
        kind: "hint",
        text: "In the builder, click the image to upload from your media library.",
      },
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
        kind: "seg",
        key: "line",
        label: "Style",
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
    defaults: { show_price: true, show_meta: true },
    content: [
      {
        kind: "text",
        key: "room_id",
        label: "Room",
        placeholder: "First / featured room",
      },
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
      ALIGN_CTL(),
      { kind: "hint", text: "Reads your logo + name from Brand Studio." },
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
      { kind: "color", key: "color", label: "Link colour" },
      ALIGN_CTL(),
      {
        kind: "hint",
        text: "Header & menu are managed in the Nav builder — this is for the footer / in-page.",
      },
    ],
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
      { kind: "color", key: "color", label: "Colour" },
      ALIGN_CTL(),
    ],
  },
};

/** Library grouping order + labels (matches the prototype). */
export const WIDGET_GROUPS: [WidgetGroup, string][] = [
  ["basic", "Basics"],
  ["media", "Media"],
  ["wielo", "Wielo blocks"],
  ["site", "Site parts"],
];

export function widgetDef(type: WidgetType): WidgetDef {
  return WIDGET_DEFS[type];
}

/** A fresh copy of a widget's default props (deep-cloned so nodes never share refs). */
export function widgetDefaults(type: WidgetType): Record<string, unknown> {
  return structuredClone(WIDGET_DEFS[type].defaults);
}
