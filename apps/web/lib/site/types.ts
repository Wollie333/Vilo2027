// Shared types for the hosted micro-site renderer.
//
// Section components are PURE PRESENTATIONAL — they never fetch. Auto-populate
// sections (gallery, rooms_preview, location, reviews, blog_preview) receive
// their live data via a `SiteData` map keyed by section id, assembled
// server-side (W4 `loadSitePage.ts`). Free-form sections read everything from
// their own `props` and ignore this map.
import type { SectionType } from "@/lib/website/sections.schema";
import type {
  FormField,
  FormSettings,
  FormType,
} from "@/lib/website/forms.schema";
import type { RoomMediaOverrides } from "@/lib/website/roomMedia";
import type { AmenityCategory } from "@/lib/taxonomy/groupAmenities";

export type SiteLogoStyle = "wordmark" | "mark" | "icon";

export type SiteSocials = {
  instagram?: string | null;
  facebook?: string | null;
  x?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  website?: string | null;
};

export type SiteBrand = {
  name: string;
  tagline?: string | null;
  logoUrl?: string | null;
  /** Logo variant for dark surfaces (footer / dark hero). Falls back to logoUrl. */
  logoLightUrl?: string | null;
  /** Compact mark used in the mobile header. Falls back to logoUrl. */
  logoIconUrl?: string | null;
  faviconUrl?: string | null;
  appleIconUrl?: string | null;
  /** Header logo height in px (28..64). */
  logoMaxHeight?: number | null;
  /** How the logo renders in chrome: wordmark (name), mark (logo+name), icon. */
  logoStyle?: SiteLogoStyle;
  /** Letter-mark (1–2 chars) shown when no logo image is uploaded. */
  monogram?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socials?: SiteSocials;
  /** Host opt-in (Website → Settings): show the floating social rail on every page
   *  when true AND at least one social link is set. Off by default. */
  showSocialRail?: boolean;
};

export type SiteNavItem = {
  label: string;
  href: string; // path within the site (e.g. "/", "/about")
};

// Navigation config (host_websites.navigation). All optional so the renderer can
// apply sensible defaults; the menu builder extends this later.
export type SiteTopBar = {
  enabled?: boolean;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  message?: string | null;
};
/** One layer of a per-link style override (desktop base, or a tablet/mobile diff). */
export type MenuItemStyleLayer = {
  color?: string;
  hoverColor?: string;
  fontSize?: number;
  weight?: "normal" | "medium" | "semibold" | "bold";
  uppercase?: boolean;
  /** Background colour — turns the link into a button/pill when set. */
  bg?: string;
  /** Rounded pill shape (with padding). */
  pill?: boolean;
};
/** Responsive per-link style: a desktop base + tablet/mobile diff layers. */
export type MenuItemStyle = MenuItemStyleLayer & {
  tablet?: MenuItemStyleLayer;
  mobile?: MenuItemStyleLayer;
};
export type SiteMenuItem = {
  id: string;
  label: string;
  href: string;
  newTab?: boolean;
  children?: SiteMenuItem[]; // up to two levels of dropdown
  /** Auto-fill this item's dropdown with the site's current rooms (live). */
  autoRooms?: boolean;
  /** Room ids excluded from the auto-rooms dropdown (host-hidden). */
  hiddenRoomIds?: string[];
  /** Auto-fill this item's dropdown with the site's current specials/offers (live). */
  autoSpecials?: boolean;
  /** Special ids excluded from the auto-specials dropdown (host-hidden). */
  hiddenSpecialIds?: string[];
  /** Per-link responsive style override (the selected-link Style controls). */
  style?: MenuItemStyle;
  /** Page keys this link is HIDDEN on ("home" or a slug) — per-page show/hide. */
  hiddenOnPages?: string[];
};
/** A named menu (multi-menu model). Sites can hold several; the header renders
 *  the one referenced by `SiteNavigation.primaryMenuId`. */
export type SiteNamedMenu = {
  id: string;
  name: string;
  items: SiteMenuItem[];
};
export type SiteFooterColumn = {
  id: string;
  heading?: string;
  links: SiteMenuItem[];
};
/** Optional styling for the header menu (the Style tab). */
/** Per-device override (tablet/mobile) — only the differing fields are stored.
 *  Optional strings (no null) to match the Zod-inferred builder type. */
export type SiteMenuDeviceStyle = {
  color?: string;
  hoverColor?: string;
  weight?: "normal" | "medium" | "semibold" | "bold";
  uppercase?: boolean;
  fontSize?: number;
};

export type SiteMenuStyle = {
  /** Scrolled-state link/hover colour (transparent-over-hero headers). */
  scrolledColor?: string;
  scrolledHoverColor?: string;
  color?: string | null;
  hoverColor?: string | null;
  weight?: "normal" | "medium" | "semibold" | "bold";
  uppercase?: boolean;
  /** Top-level link size (px). */
  fontSize?: number;
  /** Menu alignment within its header slot. */
  align?: "start" | "center" | "end";
  /** Sub-menu (dropdown) styling — separate from the top-level links. */
  submenuColor?: string | null;
  submenuHoverColor?: string | null;
  submenuBg?: string | null;
  /** Scrolled-state dropdown colours (transparent-over-hero header, [data-scrolled]). */
  scrolledSubmenuBg?: string | null;
  scrolledSubmenuColor?: string | null;
  /** Layout: horizontal spacing between top-level links (px). */
  itemGap?: number;
  /** Per-device overrides scoped to screen size (mirrors the page builder). */
  tablet?: SiteMenuDeviceStyle;
  /** Mobile = the ☰ drawer / overlay (its own background + link styling). */
  mobile?: SiteMenuDeviceStyle & {
    overlayBg?: string;
    backdropColor?: string;
    /** Colour for the drawer's dropdown/submenu (nested child links). */
    submenuColor?: string;
  };
};
/** Per-page menu/header override — appearance + style scoped to one page key. */
export type MenuPageOverride = {
  transparentOverHero?: boolean;
  bgColor?: string;
  color?: string;
  hoverColor?: string;
  /** Scrolled-state menu colour for this page (transparent-over-hero headers). */
  scrolledColor?: string;
  fontSize?: number;
};
/** Per-device logo override (tablet/mobile) — unset fields inherit desktop. */
export type LogoOverride = {
  show?: boolean;
  style?: "wordmark" | "icon" | "mark";
  maxHeight?: number;
};
export type SiteNavigation = {
  /** Effective header menu — the primary named menu's items, mirrored here so the
   *  render path (SiteChrome) stays on one field. When empty the page-derived nav
   *  is used. Kept in sync with `menus`/`primaryMenuId`. */
  menu?: SiteMenuItem[];
  /** Named menus (multi-menu). The header renders the `primaryMenuId` menu. */
  menus?: SiteNamedMenu[];
  /** Id of the menu that drives the header (falls back to the first menu). */
  primaryMenuId?: string;
  /** Menu link styling (colours / weight / uppercase). */
  menuStyle?: SiteMenuStyle;
  /** Per-page appearance/style overrides, keyed by page key ("home" or a slug). */
  perPage?: Record<string, MenuPageOverride>;
  topBar?: SiteTopBar;
  header?: {
    /** Chosen header style; SiteChrome prefers this over the theme's layout. */
    layout?: "classic" | "centered" | "split" | "minimal";
    ctaLabel?: string | null;
    ctaHref?: string | null;
    /** Small subtitle beside the brand name (themes that show one, e.g. Safari). */
    tagline?: string | null;
    sticky?: boolean; // default true
    transparentOverHero?: boolean;
    /** Solid header background colour; blank → theme surface. */
    bgColor?: string | null;
    /** Background once scrolled (transparent mode); blank → theme ink. */
    scrolledBgColor?: string | null;
    /** Header bottom-border colour once solid/scrolled; blank → theme hairline. */
    scrolledBorderColor?: string | null;
    /** Drop-shadow under the header once lifted (scrolled / solid sticky bar). */
    scrolledShadow?: boolean | null;
    scrolledShadowColor?: string | null;
    scrolledShadowSize?: number | null;
    /** Header bottom-border (solid state) — colour + width; blank → theme hairline. */
    borderColor?: string | null;
    borderWidth?: number | null;
    /** Mobile ☰ icon design. */
    burger?: {
      color?: string;
      size?: number;
      weight?: "thin" | "regular" | "bold";
      style?: "lines" | "short" | "dots" | "grid";
      bg?: string;
    };
    /** Per-device logo overrides (tablet / mobile) — unset inherits desktop. */
    logoTablet?: LogoOverride;
    logoMobile?: LogoOverride;
    /** When the menu collapses to a ☰ button: phones only / tablets too / never. */
    menuCollapse?: "mobile" | "tablet" | "never";
    /** Show the header "Book now" button (hidden on collapsed views). Default true. */
    showBookCta?: boolean;
    /** Book button background colour; blank → theme primary button style. */
    bookCtaColor?: string | null;
    /** Show the brand logo in the header. Default true. */
    showLogo?: boolean;
    /** Header-level logo style override (blank → Brand Studio value). */
    logoStyle?: "wordmark" | "icon" | "mark";
    /** Header-level logo height override in px (blank → Brand Studio value). */
    logoMaxHeight?: number;
  };
  footer?: {
    showPoweredBy?: boolean; // default true
    copyright?: string | null;
    columns?: SiteFooterColumn[];
    /** Optional newsletter sign-up block (themes that show one, e.g. Safari). */
    newsletter?: {
      enabled?: boolean;
      heading?: string | null;
      body?: string | null;
    };
  };
};

/**
 * Site-wide conversion chrome (Phase 6A slice 2), stored under
 * `host_websites.settings.conversion` and frozen into the publish snapshot. A
 * floating WhatsApp click-to-chat button + a dismissible announcement bar.
 */
export type SiteConversion = {
  whatsapp?: {
    enabled?: boolean;
    /** Number in international format (digits, may carry a leading +). */
    number?: string | null;
    /** Optional pre-filled message text. */
    message?: string | null;
  };
  announcement?: {
    enabled?: boolean;
    text?: string | null;
    /** Optional call-to-action link rendered after the text. */
    linkLabel?: string | null;
    linkHref?: string | null;
  };
  /** Pop-up modal (Phase 6A slice 3) with trigger rules + frequency cap. */
  popup?: {
    enabled?: boolean;
    heading?: string | null;
    body?: string | null;
    /** When the pop-up appears. */
    trigger?: "delay" | "scroll" | "exit";
    /** Seconds to wait before showing (trigger === "delay"). */
    delaySeconds?: number;
    /** Scroll depth percent that triggers it (trigger === "scroll"). */
    scrollPercent?: number;
    /** How often a returning visitor sees it again. */
    frequency?: "once" | "daily" | "always";
    /** Optional simple CTA button (used when no embedded form). */
    ctaLabel?: string | null;
    ctaHref?: string | null;
    /** Optional embedded `website_forms` row id (e.g. a newsletter form). */
    formId?: string | null;
  };
};

/**
 * Host-supplied third-party analytics for a tenant site, stored under
 * `host_websites.settings.analytics` and frozen into the publish snapshot. The
 * IDs belong to the HOST's own GA4 / Meta accounts — Wielo only injects the
 * scripts on the public site. Because these set cookies, a POPIA consent gate
 * (`cookieConsent`) defaults to ON: the pixels load only after the visitor
 * accepts.
 */
export type SiteAnalyticsSettings = {
  /** Google Analytics 4 Measurement ID, e.g. "G-XXXXXXXXXX". */
  ga4?: string | null;
  /** Meta (Facebook) Pixel ID — a numeric string. */
  metaPixel?: string | null;
  /** Google Tag Manager container ID, e.g. "GTM-XXXXXXX". */
  gtm?: string | null;
  /** TikTok Pixel ID. */
  tiktok?: string | null;
  /** Google Ads conversion ID, e.g. "AW-XXXXXXXXX". */
  googleAds?: string | null;
  cookieConsent?: {
    /** Require consent before loading any pixel (default true). */
    enabled?: boolean;
    /** Optional custom banner message. */
    message?: string | null;
    /** Optional link to the host's privacy/cookie policy. */
    privacyHref?: string | null;
  };
};

// ── Per-section live data (auto-populate sections only) ───────
export type GalleryImage = { url: string; caption?: string | null };
export type GalleryData = { images: GalleryImage[] };

export type RoomCard = {
  id: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  bookHref: string; // absolute deep-link into the existing booking engine
  /** Link to this room's detail page (/rooms/<slug>) — the card's primary click. */
  detailHref?: string;
  featured?: boolean;
  badge?: string | null;
  /** Short facts derived from the room (e.g. "Sleeps 4", "2 beds", "Ensuite"). */
  facts?: string[];
  /** The property this room belongs to (drives optional group headers). */
  propertyId?: string;
};
/** Optional per-property group header for the rooms section (heading/intro/hero). */
export type RoomGroup = {
  propertyId: string;
  heading?: string;
  intro?: string;
  heroUrl?: string | null;
};
export type RoomsPreviewData = {
  rooms: RoomCard[];
  /** Per-property group meta, keyed by property id (only set when overrides exist). */
  groups?: Record<string, RoomGroup>;
};

// ── Room detail (the /rooms/<slug> page) ─────────────────────
export type RoomDetailImage = { url: string; alt?: string | null };
export type RoomAmenity = { icon?: string | null; label: string };
/**
 * The single room being viewed on a room-detail page. Resolved live from
 * property_rooms (+ photos + amenities); the room-scoped sections (room_gallery,
 * room_overview, room_amenities, room_rate) all render from this one object.
 */
export type RoomDetail = {
  id: string;
  /** URL slug (slugified display name; unique within the website's visible rooms). */
  slug: string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  images: RoomDetailImage[];
  /** Short facts (Sleeps 4, 2 beds, Ensuite, 28 m², Sea view). */
  facts: string[];
  amenities: RoomAmenity[];
  /** Deep-link into the on-site checkout with this room preselected. */
  bookHref: string;
  propertyId: string;
  /** Owning website id — lets the room_rate booking form call the quote API. */
  websiteId?: string;
  propertyName?: string | null;
  /** Max occupancy — caps the booking dock's guest selector. */
  maxGuests?: number | null;
  /** Auto-populated "things to know" (from the parent property) — drives the
   *  room_policies section. Absent when the property has none set. */
  policies?: RoomPolicies | null;
};

/** "Things to know" for a room — sourced from the parent property (cancellation,
 *  check-in/out, house rules, key allowances). All optional; the section only
 *  renders the lines that have a value. */
export type RoomPolicies = {
  cancellation?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  houseRules?: string | null;
  children?: boolean | null;
  pets?: boolean | null;
};

export type Poi = {
  name: string;
  category?: string | null;
  distance?: string | null;
};
export type LocationData = {
  /** Establishment name + public contact details (from the site brand). */
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** City / province / country only — privacy-limited locality for the home
   * page + map pin (keeps the exact address private on the marketplace side). */
  address?: string | null;
  /** The COMPLETE street address (line1/line2 + city/province/postal/country),
   * for the host's own contact page where a full business address belongs.
   * Null when the property hasn't set a street line (then callers fall back to
   * the locality `address`). */
  fullAddress?: string | null;
  mapEmbedUrl?: string | null;
  /** Property coordinates (for schema.org geo / map pin). Null when ungeocoded. */
  latitude?: number | null;
  longitude?: number | null;
  pois: Poi[];
};

export type ReviewCard = {
  author: string;
  rating: number; // 1..5
  body: string;
  date?: string | null;
};
export type ReviewsData = {
  items: ReviewCard[];
  average?: number | null;
  count?: number | null;
};

export type BlogCard = {
  title: string;
  href: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  date?: string | null;
};
export type BlogPreviewData = { posts: BlogCard[] };

export type SpecialCard = {
  id: string;
  title: string;
  slug: string | null;
  description?: string | null;
  imageUrl?: string | null;
  badge?: string | null;
  priceMode: "flat" | "per_night";
  /** flat_total for flat specials, per_night_price for per-night specials. */
  price?: number | null;
  currency?: string | null;
  /** Shadow price at normal/seasonal rate (drives the strike-through). */
  wasPrice?: number | null;
  savingsAmount?: number | null;
  savingsPct?: number | null;
  /** Remaining redemptions (drives the scarcity hint). */
  remaining?: number | null;
  bookHref: string; // deep-link into the booking engine (?booked_via=website)
  /** The offer's own detail page (`/specials/<slug>`) — where the card links so
   *  the guest browses the offer before the booking action lives on the detail. */
  detailHref?: string | null;
};
export type SpecialsPreviewData = { specials: SpecialCard[] };

export type AddonCard = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  /** per_stay | per_night | per_guest | per_guest_per_night | per_couple. */
  pricingModel: string;
  price?: number | null;
  currency?: string | null;
  required?: boolean;
};
export type AddonsPreviewData = { addons: AddonCard[] };

/** A host-built form's public-render definition (resolved live from website_forms). */
export type SiteFormDef = {
  id: string;
  name: string;
  type: FormType;
  fields: FormField[];
  settings: FormSettings;
};
/** All of the site's forms; a `form` section picks its own by props.form_id. */
export type FormRenderData = { forms: SiteFormDef[] };

// ── Booking funnel (Phase 6B) ────────────────────────────────
/**
 * A property the site can take bookings for (a visible channel member). Carries
 * only what the funnel widgets need to render selectors + build a deep-link;
 * every price is recalculated server-side via /api/website-quote (the client is
 * never trusted). `bookBase` is the absolute checkout URL to append dates to.
 */
export type BookableProperty = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  minNights: number;
  maxGuests: number;
  /** Absolute booking-engine URL for this property (append ?from=&to=&guests=). */
  bookBase: string;
};
/** Shared by booking_search + availability_calendar (the site's bookable set). */
export type BookingFunnelData = {
  websiteId: string;
  properties: BookableProperty[];
  /** Absolute path to the system search-results page (booking_search links here
   *  when the site has more than one bookable property). */
  searchHref?: string;
  /** The site's visible ROOMS (search-results only) — resolved at page load with
   *  their hrefs/images/facts. Per-room availability + a server-recalculated
   *  price for the searched dates come from /api/website-search at search time
   *  (never trusted client-side). `bookHref` is the base checkout link (property
   *  + room); the searched dates/guests are appended client-side. */
  rooms?: RoomCard[];
};

/** One row of the live rate table (display-only — booking re-prices server-side). */
export type RateRow = {
  roomId: string;
  name: string;
  propertyId: string;
  propertyName?: string | null;
  /** Live nightly "from" price (server-read from the room). */
  nightlyFrom: number | null;
  weekendPrice?: number | null;
  currency: string;
  minNights?: number | null;
  maxGuests?: number | null;
  bookHref: string;
};
export type RateTableData = { rows: RateRow[] };

/** One season for the editable Seasonal pricing block (auto source). Aggregated
 *  by label across the site's `property_seasonal_pricing` rules. */
export type SeasonRow = {
  label: string;
  /** Pre-formatted date range, e.g. "1 Dec – 15 Jan". */
  dates: string;
  /** "from" price across the rules under this label. */
  priceFrom: number | null;
  currency: string;
};
export type SeasonalPricingData = { seasons: SeasonRow[] };
/** Property-wide facilities — live amenity items (icon + label) plus the same
 *  amenities grouped by admin category (for the "categorized" Booking.com layout). */
export type AmenitiesData = {
  items: { icon: string | null; label: string }[];
  categories?: AmenityCategory[];
};
/** The site's host — pulled live from the `hosts` table for the Profile block. */
export type ProfileData = {
  name: string;
  avatar: string | null;
  bio: string | null;
  rating: number | null;
  reviews: number;
  superhost: boolean;
  verified: boolean;
};

/** Live-data shape per auto-populate section type. */
export type SiteDataByType = {
  gallery: GalleryData;
  rooms_preview: RoomsPreviewData;
  // A single-room card (Builder V2 el_room_card). Renders ONE room chosen from
  // the site's rooms by props.room_id (else the first/featured); reuses RoomCard.
  el_room_card: RoomCard;
  location: LocationData;
  reviews: ReviewsData;
  blog_preview: BlogPreviewData;
  specials_preview: SpecialsPreviewData;
  addons_preview: AddonsPreviewData;
  form: FormRenderData;
  // The trust section is free-form (badges in props) but takes an OPTIONAL live
  // review aggregate (average + count) — reuses the reviews shape.
  trust: ReviewsData;
  // Property-level "Things to know" — auto-pulled from the site's PRIMARY
  // property (cancellation, check-in/out, house rules, allowances). Unlike the
  // room-scoped room_policies, this is resolved by type (not room) and its data
  // is a RoomPolicies object directly. Reuses the RoomPolicies shape.
  policies: RoomPolicies;
  // Property-wide facilities grid — live from property_amenities (room_id null),
  // resolved by TYPE (not room). Manual items in props are the fallback.
  amenities: AmenitiesData;
  // Host profile — live from the site's host record (photo/name/rating/bio/badges).
  profile: ProfileData;
  // Booking funnel — search + calendar share the bookable-property set; the
  // rate table reads live nightly rates. Pricing/availability resolve live.
  booking_search: BookingFunnelData;
  // Search-results template — reuses the bookable-property set; each is quoted
  // live client-side via /api/website-quote.
  search_results: BookingFunnelData;
  availability_calendar: BookingFunnelData;
  rate_table: RateTableData;
  // Editable rates blocks (default source = "auto"): room_rates reuses the live
  // rate rows; seasonal_pricing reads property_seasonal_pricing, grouped by label.
  room_rates: RateTableData;
  seasonal_pricing: SeasonalPricingData;
  // Room-scoped sections — all render the SAME active room (injected by the
  // /rooms/<slug> route; a sample room in the builder preview).
  room_gallery: RoomDetail;
  room_overview: RoomDetail;
  room_amenities: RoomDetail;
  room_rate: RoomDetail;
  room_policies: RoomDetail;
};
export type AutoSectionType = keyof SiteDataByType;

/** A datum tagged with its section type (for the by-id map). */
export type SiteSectionDatum = {
  [K in AutoSectionType]: { type: K; data: SiteDataByType[K] };
}[AutoSectionType];

/** sectionId → live data for that section (only auto-populate sections appear). */
export type SiteData = Record<string, SiteSectionDatum>;

// ── Publish snapshot (W10) ───────────────────────────────────
/** One room's published channel state, captured into the publish snapshot. */
export type SnapshotRoom = {
  room_id: string;
  is_visible: boolean;
  featured: boolean;
  badge: string | null;
  display_name: string | null;
  display_price: number | null;
  display_currency: string | null;
  display_desc: string | null;
  sort_order: number;
  /** Per-room media overrides for the room-detail page (hidden ids + extras). */
  media_overrides?: RoomMediaOverrides;
};

/** Per-property group overrides on the rooms section (heading/intro/hero). */
export type PropertyOverride = {
  heading?: string;
  intro?: string;
  hero_path?: string;
};

/**
 * Frozen public-render config captured at publish time
 * (`host_websites.published_snapshot`). The public renderer reads chrome +
 * channel membership from here so unpublished edits never leak; preview mode
 * keeps reading the live columns.
 */
export type PublishSnapshot = {
  brand: Record<string, unknown>;
  theme: Record<string, unknown>;
  seo: Record<string, unknown>;
  nav: SiteNavItem[];
  /** Navigation config (top bar, header CTA/behaviour, footer extras). */
  navigation?: SiteNavigation;
  /** Conversion chrome (WhatsApp button + announcement bar). */
  conversion?: SiteConversion;
  /** Host third-party analytics (GA4 + Meta Pixel + consent). */
  analytics?: SiteAnalyticsSettings;
  /** Site width: "full" (edge-to-edge) or "boxed" (centred max-width). */
  layout?: "full" | "boxed";
  propertyIds: string[];
  rooms: SnapshotRoom[];
  /** Per-property rooms-section overrides, keyed by property id. */
  propertyOverrides?: Record<string, PropertyOverride>;
};
// NOTE: keep `SiteContext.conversion` (loadSitePage) and this field in sync.

export type SiteAssetResolver = (
  path: string | null | undefined,
) => string | undefined;

/** Narrow a SiteData entry to the datum for a given section type. */
export function dataFor<T extends AutoSectionType>(
  map: SiteData | undefined,
  id: string,
  type: T,
): SiteDataByType[T] | undefined {
  const entry = map?.[id];
  if (!entry || entry.type !== type) return undefined;
  // Runtime check guarantees the match; the flat lookup keeps the return type
  // narrow for call sites (which pass a literal `type`).
  return entry.data as SiteDataByType[T];
}

export type { SectionType };
