// Builder V2 — prop schemas for the FIVE new widget types.
//
// These types are introduced by the standardized Wielo-block builder and do not
// exist in the legacy sections.schema.ts: icon box, single room card, and the
// three site-part widgets (logo / nav / social) used in the Footer document and
// in-page. Brand-safe by construction — colours are theme palette ROLES
// (EL_COLOR), never raw hex, so a host cannot drift off-brand.
//
// Kept in the widgets module (not sections.schema.ts) because only the new
// builder consumes them; the legacy flat model never renders them.
import { z } from "zod";

const ALIGN = ["left", "center", "right"] as const;

// Icon box — a glyph/emoji (or lucide icon name) + a title + a short body.
export const ICON_VARIANTS = ["stack", "inline"] as const;
export const elIconProps = z.object({
  glyph: z.string().max(500).default("★"), // emoji/char OR uploaded image/SVG URL/path
  title: z.string().max(120).default("A little something"),
  body: z.string().max(600).default("Say what makes it special."),
  color: z.string().max(60).default("accent"),
  align: z.enum(ALIGN).default("center"),
  // Glyph size in px (scale string; "auto" = the default 34px).
  icon_size: z.string().max(6).optional(),
});

// Single room card — renders ONE room. `room_id` pins it to a live room; empty
// = the site's first/featured room. Price/photo/meta resolve live server-side
// (never stored, never trusted from the client).
export const ROOM_CARD_VARIANTS = ["postcard", "clean", "overlay"] as const;
export const elRoomCardProps = z.object({
  room_id: z.string().uuid().optional(),
  show_price: z.boolean().default(true),
  show_meta: z.boolean().default(true),
  ctaLabel: z.string().max(60).optional(),
});

// ── Site parts (Footer document + in-page) ────────────────────
// Logo — reads Brand Studio identity by default; `style` picks what shows.
export const LOGO_VARIANTS = ["markName", "name", "mark"] as const;
export const elLogoProps = z.object({
  style: z.enum(LOGO_VARIANTS).default("markName"),
  align: z.enum(ALIGN).default("left"),
  size: z.enum(["sm", "md", "lg"]).optional(),
});

// Nav menu — by default renders the menu the Nav builder assigns (SSOT). In
// "custom" mode the host types a comma-separated fallback list. Header/menu are
// still governed by the Nav builder; this widget is for the footer / in-page.
export const NAV_VARIANTS = ["underline", "pill", "plain"] as const;
export const elNavProps = z.object({
  source: z.enum(["menu", "custom"]).default("menu"),
  menu_key: z.string().max(60).optional(),
  items: z.string().max(600).optional(),
  color: z.string().max(60).default("default"),
  align: z.enum(ALIGN).default("center"),
});

// Social icons — reads Brand Studio socials by default; "custom" overrides.
export const SOCIAL_VARIANTS = ["round", "rounded"] as const;
export const elSocialProps = z.object({
  source: z.enum(["brand", "custom"]).default("brand"),
  networks: z.string().max(300).optional(),
  color: z.string().max(60).default("default"),
  align: z.enum(ALIGN).default("left"),
  // Icon chip size in px (scale string; "auto" = the default 38px).
  icon_size: z.string().max(6).optional(),
});

/** Zod prop schema per new widget type (used by the registry + write-validation). */
export const NEW_TYPE_SCHEMAS = {
  el_icon: elIconProps,
  el_room_card: elRoomCardProps,
  el_logo: elLogoProps,
  el_nav: elNavProps,
  el_social: elSocialProps,
} as const;
