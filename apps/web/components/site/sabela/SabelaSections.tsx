import { Fragment, type CSSProperties, type ReactNode } from "react";

import { siteImageUrl } from "@/lib/site/image";
import {
  dataFor,
  type RoomsPreviewData,
  type GalleryData,
  type ReviewsData,
  type BlogPreviewData,
  type RoomDetail,
  type RoomPolicies,
  type RateTableData,
  type SiteAssetResolver,
  type SiteData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { FormSection } from "../sections/FormSection";
import { ColumnsSection, FlexSection } from "../sections/ColumnsSection";
import {
  ElButtonSection,
  ElDividerSection,
  ElHeadingSection,
  ElImageSection,
  ElSpacerSection,
  ElTextSection,
} from "../sections/Elements";
import { RichTextSection } from "../sections/RichTextSection";
import { VideoSection } from "../sections/VideoSection";
import { LogosSection } from "../sections/LogosSection";
import { SpecialsPreviewSection } from "../sections/SpecialsPreview";
import { AddonsPreviewSection } from "../sections/AddonsPreview";
import { TrustSection } from "../sections/TrustSection";
import { BookingSearchSection } from "../sections/BookingSearchSection";
import { SearchResultsSection } from "../sections/SearchResultsSection";
import { AvailabilityCalendarSection } from "../sections/AvailabilityCalendarSection";
import {
  RoomRatesSection,
  SeasonalPricingSection,
} from "../sections/RatesBlocks";
import { SabelaContactForm } from "./SabelaContactForm";

/**
 * The Sabela Lodge ("sabela" theme) bands — the SAME flat sections the builder
 * already knows, rendered in the bespoke dark-first Sabela design instead of the
 * generic look. The SectionRenderer dispatches here (via `renderSabelaSection`)
 * when the active theme is sabela, so the builder canvas and the public site
 * render identically (true WYSIWYG) and every band is editable + reorderable.
 *
 * Content comes from the host's section props; imagery falls back to the
 * design's stock so a fresh Sabela site looks like the example out of the box,
 * and the suites/reviews/gallery bands bind to the host's REAL data when present.
 * Every selector lives in sabela.css under `.wielo-sabela`, driven by `--site-*`.
 */

type P<T extends WebsiteSection["type"]> = Extract<
  WebsiteSection,
  { type: T }
>["props"];

export type SectionResponsive = WebsiteSection["responsive"];

/** Cross-page links + brand + contact used by the bands. Every field optional
 *  with a sensible fallback so the builder canvas (links inert) still renders. */
export interface SabelaCtx {
  brandName?: string;
  homeHref?: string;
  roomsHref?: string;
  aboutHref?: string;
  contactHref?: string;
  reserveHref?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

const IMG = {
  hero: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2400&q=80",
  intro:
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80",
  exp1: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=1200&q=80",
  suite1:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80",
  suite2:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80",
  suite3:
    "https://images.unsplash.com/photo-1504675099198-7023dd85f5a3?w=900&q=80",
  g1: "https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=1200&q=80",
  g2: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=700&q=80",
  g3: "https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=700&q=80",
  g4: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=700&q=80",
  g5: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&q=80",
  g6: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
  g7: "https://images.unsplash.com/photo-1502920514313-52581002a659?w=700&q=80",
  host: "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=900&q=80",
  location:
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1100&q=80",
};

const STOCK_EXP = [
  {
    title: "Twice-daily game drives",
    body: "Dawn and dusk on open vehicles with rangers who grew up reading this land.",
  },
  {
    title: "Eight suites, nothing more",
    body: "A small camp by design, so the bush stays quiet and the moments stay yours.",
  },
  {
    title: "The table & the fire",
    body: "Long dinners under the stars, the boma fire, and stories that run late.",
  },
];

const STOCK_SUITES = [
  {
    tag: "Sleeps 2 · River",
    name: "River Suite",
    meta: ["Private deck", "Outdoor bath"],
    desc: "A glass-walled retreat above the riverbed with an outdoor bath and a deck made for doing nothing at all.",
    price: "R8,900",
    img: IMG.suite1,
  },
  {
    tag: "Sleeps 2 · Canopy",
    name: "Treehouse Suite",
    meta: ["Raised deck", "Star bed"],
    desc: "Set into the canopy on stilts, with a roll-back roof and a star bed for clear Waterberg nights.",
    price: "R9,500",
    img: IMG.suite2,
  },
  {
    tag: "Sleeps 4 · Family",
    name: "Family Villa",
    meta: ["Two bedrooms", "Private guide"],
    desc: "Two connected rooms under a single thatch, with a shaded family deck and a dedicated ranger for your stay.",
    price: "R14,500",
    img: IMG.suite3,
  },
];

const STOCK_REVIEWS = [
  {
    quote:
      "We came for the Big Five and left changed by the silence. Our ranger found a leopard at dawn and a kind of peace by dusk.",
    initials: "AM",
    name: "Anna & Marc",
    date: "May 2026 · Cape Town",
  },
  {
    quote:
      "The River Suite ruins you for ordinary hotels. Bath open to the bush, elephants at the water over breakfast. Faultless.",
    initials: "TZ",
    name: "Thandi Z.",
    date: "Apr 2026 · Johannesburg",
  },
  {
    quote:
      "Booked direct, paid exactly what they quoted, and felt like the only people for miles. We're already back next winter.",
    initials: "JS",
    name: "James S.",
    date: "Mar 2026 · London",
  },
];

const STOCK_GALLERY = [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6, IMG.g7];

const STOCK_POSTS = [
  {
    title: "Reading the riverbed at first light",
    href: "#",
    excerpt:
      "What the tracks tell us before the sun is fully up — and why the best sightings come to the patient.",
    coverUrl: IMG.g1,
    date: "May 2026",
  },
  {
    title: "A season of new arrivals",
    href: "#",
    excerpt: "The herds are calving, and the predators know it.",
    coverUrl: IMG.g3,
    date: "Apr 2026",
  },
  {
    title: "From the kitchen: bushveld suppers",
    href: "#",
    excerpt: "Long tables, open coals, and Limpopo wines under the stars.",
    coverUrl: IMG.g5,
    date: "Mar 2026",
  },
];

const STOCK_HERO_STATS = [
  { value: "12,000", label: "Hectares" },
  { value: "Big Five", label: "Free-roaming" },
  { value: "4.97 ★★★★★", label: "180 guest stays" },
];

const ARROW = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const CHECK_ICON = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Small line-icon set for the highlights band — keyed by the section's icon
 *  name (Lucide-style), with a generic dot fallback for anything unmapped. */
function featureIcon(name?: string | null): ReactNode {
  const common = {
    width: 26,
    height: 26,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch ((name || "").toLowerCase()) {
    case "sunrise":
      return (
        <svg {...common}>
          <path d="M12 2v6M4.2 10.2l1.4 1.4M1 18h22M6 18a6 6 0 0 1 12 0M18.4 11.6l1.4-1.4M22 18h0M8 6l4-4 4 4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.2-.5-4 1-6-1 4 4 5 4 9a4 4 0 1 1-8 0c0-1 .2-2 .5-2.5" />
        </svg>
      );
    case "footprints":
      return (
        <svg {...common}>
          <path d="M4 16c-1 0-2-1-2-3 0-2 1-3 1-5 0-1 1-2 2-2s1 2 1 3-.5 4-.5 5 0 2-1.5 2zM18 18c-1 0-2-1-2-3 0-2 1-3 1-5 0-1 1-2 2-2s1 2 1 3-.5 4-.5 5 0 2-1.5 2z" />
        </svg>
      );
    default:
      // An emoji or unmapped name → render the text as-is (emoji) or a dot.
      if (name && /\p{Emoji}/u.test(name))
        return <span style={{ fontSize: 24, lineHeight: 1 }}>{name}</span>;
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

/** Resolve a stored image_path → URL, falling back to the design's stock. */
function img(
  path: string | undefined,
  asset: SiteAssetResolver | undefined,
  fallback: string,
): string {
  if (!path) return fallback;
  const url = asset ? asset(path) : siteImageUrl(path);
  return url || fallback;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "★"
  );
}

function rand(price?: number | null, currency?: string | null): string {
  if (price == null) return "";
  const ccy = currency ?? "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `R${Number(price).toLocaleString("en-ZA")}`;
  }
}

/* ── HERO ───────────────────────────────────────────────────────────── */
export function SabelaHero({
  props,
  asset,
  ctx,
}: {
  props: P<"hero">;
  asset?: SiteAssetResolver;
  ctx?: SabelaCtx;
}) {
  const roomsHref = ctx?.roomsHref || "#rooms";
  const aboutHref = ctx?.aboutHref;

  // Compact "page header" banner for inner pages (About/Suites/Contact).
  if (props.compact) {
    return (
      <section className="page-head">
        <div className="wrap wrap-narrow">
          <div className="crumb">
            <a href={ctx?.homeHref || "#"}>Home</a>
            {props.eyebrow ? (
              <>
                <span>·</span>
                <span>{props.eyebrow}</span>
              </>
            ) : null}
          </div>
          <h1 style={{ marginTop: 16 }}>{props.headline || "About"}</h1>
          {props.subheadline ? (
            <p className="lead" style={{ marginTop: 16 }}>
              {props.subheadline}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  const showPrimary = props.show_cta !== false;
  const primaryLabel = props.cta_label || "Plan your safari";
  const primaryHref = props.cta_href?.trim() || roomsHref;
  const secondaryLabel =
    props.cta2_label?.trim() || (aboutHref ? "Our story" : "");
  const secondaryHref = props.cta2_href?.trim() || aboutHref || "#";
  const showSecondary = props.show_cta2 !== false && secondaryLabel;

  const heroImg = img(props.image_path, asset, IMG.hero);

  // Split hero (inner pages that opt for split_right) — copy beside an image.
  if (props.variant === "split_right" || props.variant === "split_left") {
    const reversed = props.variant === "split_left";
    return (
      <section className="hero hero-split" data-section="hero">
        <div className="hero-copy" style={reversed ? { order: 2 } : undefined}>
          {props.eyebrow ? (
            <span className="eyebrow">{props.eyebrow}</span>
          ) : null}
          <h1 style={{ marginTop: 14 }}>
            {props.headline || "A camp built to disappear into the bush"}
          </h1>
          {props.subheadline ? (
            <p className="hero-sub">{props.subheadline}</p>
          ) : null}
          {showPrimary || showSecondary ? (
            <div className="hero-cta-row">
              {showPrimary ? (
                <a href={primaryHref} className="btn btn-primary">
                  <span>{primaryLabel}</span>
                </a>
              ) : null}
              {showSecondary ? (
                <a href={secondaryHref} className="btn btn-ghost">
                  <span>{secondaryLabel}</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div
          className="hero-art"
          style={{ backgroundImage: `url(${heroImg})` }}
        />
      </section>
    );
  }

  // Default = full-bleed home hero (dark overlay).
  const stats =
    props.stats && props.stats.length
      ? props.stats.filter((s) => s.value?.trim())
      : STOCK_HERO_STATS;
  const showStats = props.show_stats !== false && stats.length > 0;
  const alignStyle: CSSProperties =
    props.align === "center"
      ? { textAlign: "center", alignItems: "center" }
      : props.align === "right"
        ? { textAlign: "right", alignItems: "flex-end" }
        : {};

  return (
    <section className="hero hero-full" data-section="hero">
      <div
        className="hero-img"
        style={{ backgroundImage: `url(${heroImg})` }}
      />
      <div className="wrap hero-content">
        <div
          style={{ display: "flex", flexDirection: "column", ...alignStyle }}
        >
          <span className="eyebrow">
            {props.eyebrow ||
              `${ctx?.brandName ? `${ctx.brandName} · ` : ""}Private Reserve`}
          </span>
          <h1 style={{ marginTop: 14 }}>
            {props.headline || "Where the wild still keeps its secrets"}
          </h1>
          <p className="hero-sub">
            {props.subheadline ||
              "An intimate, design-led safari lodge on a private reserve — eight suites, twice-daily game drives, and nothing between you and the bush."}
          </p>
          {showPrimary || showSecondary ? (
            <div className="hero-cta-row">
              {showPrimary ? (
                <a href={primaryHref} className="btn btn-primary">
                  <span>{primaryLabel}</span>
                </a>
              ) : null}
              {showSecondary ? (
                <a href={secondaryHref} className="btn btn-on-dark">
                  <span>{secondaryLabel}</span>
                </a>
              ) : null}
            </div>
          ) : null}
          {showStats ? (
            <div
              className="hero-stats"
              style={{
                display: "flex",
                gap: "clamp(28px,4vw,56px)",
                marginTop: 38,
                flexWrap: "wrap",
              }}
            >
              {stats.map((s, i) => (
                <div key={s.value + i} className="stat">
                  <span className="n" style={{ color: "#fff" }}>
                    {s.value}
                  </span>
                  {s.label ? (
                    <span
                      className="l"
                      style={{ color: "rgba(255,255,255,.74)" }}
                    >
                      {s.label}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ── INTRO / STORY ──────────────────────────────────────────────────── */
export function SabelaIntro({
  props,
  asset,
  ctx,
}: {
  props: P<"intro">;
  asset?: SiteAssetResolver;
  ctx?: SabelaCtx;
}) {
  const eyebrow = props.eyebrow;
  const heading = props.heading || "A safari measured in moments";
  const body = props.body || "";

  // Centred variant — a narrow lead band with no image (used on index pages).
  if (props.variant === "centered") {
    return (
      <section className="section" data-section="intro">
        <div className="wrap wrap-narrow" style={{ textAlign: "center" }}>
          {eyebrow ? (
            <span className="eyebrow center no-rule">{eyebrow}</span>
          ) : null}
          <h2 style={{ marginTop: 14 }}>{heading}</h2>
          {body ? (
            <p
              className="muted"
              style={{
                marginTop: 18,
                maxWidth: "60ch",
                marginInline: "auto",
                whiteSpace: "pre-line",
              }}
            >
              {body}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="section" data-section="intro">
      <div className="wrap">
        <div className="split">
          <div className="split-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(props.image_path, asset, IMG.intro)} alt="" />
          </div>
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h2 style={{ marginTop: 14 }}>{heading}</h2>
            {body ? (
              <p
                className="lead"
                style={{
                  marginTop: 20,
                  color: "var(--site-ink)",
                  whiteSpace: "pre-line",
                }}
              >
                {body}
              </p>
            ) : null}
            {props.badge_value ? (
              <div className="stat-row" style={{ marginTop: 30 }}>
                <div className="stat">
                  <span className="n">{props.badge_value}</span>
                  {props.badge_label ? (
                    <span className="l">{props.badge_label}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {ctx?.aboutHref && props.variant === "lead" ? (
              <a
                href={ctx.aboutHref}
                className="link-arrow"
                style={{ marginTop: 26, display: "inline-flex" }}
              >
                Read our story {ARROW}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── HIGHLIGHTS / EXPERIENCES ───────────────────────────────────────── */
export function SabelaHighlights({ props }: { props: P<"highlights"> }) {
  const items =
    props.items && props.items.length
      ? props.items.map((it, i) => ({
          icon: it.icon,
          title: it.title || STOCK_EXP[i]?.title || "",
          body: it.body || STOCK_EXP[i]?.body || "",
        }))
      : STOCK_EXP.map((e) => ({ icon: undefined, ...e }));
  return (
    <section className="section" data-section="highlights">
      <div className="wrap">
        <div className="sec-head">
          {props.eyebrow ? (
            <span className="eyebrow">{props.eyebrow}</span>
          ) : null}
          <h2 style={{ marginTop: 14 }}>
            {props.heading || "The reserve, unhurried"}
          </h2>
        </div>
        <div className="feature-grid">
          {items.map((e, i) => (
            <div key={e.title + i} className="feature">
              <div className="f-ic">{featureIcon(e.icon)}</div>
              <h3>{e.title}</h3>
              <p>{e.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── STATS band ─────────────────────────────────────────────────────── */
export function SabelaStats({ props }: { props: P<"stats"> }) {
  const items = (props.items ?? []).filter((s) => s.value?.trim());
  if (!items.length) return null;
  return (
    <section
      className="section-sm soft-bg"
      data-section="stats"
      data-live="true"
    >
      <div className="wrap">
        <div
          className="stat-row"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
            gap: "clamp(20px,3vw,40px)",
          }}
        >
          {items.map((s, i) => (
            <div key={s.value + i} className="stat">
              <span className="n">{s.value}</span>
              {s.label ? <span className="l">{s.label}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── SUITES (rooms_preview → real rooms) ────────────────────────────── */
export function SabelaSuites({
  props,
  data,
  ctx,
}: {
  props: P<"rooms_preview">;
  data?: RoomsPreviewData;
  ctx?: SabelaCtx;
}) {
  const roomsHref = ctx?.roomsHref || "#rooms";
  const reserveHref = ctx?.reserveHref || roomsHref;
  const real = data?.rooms ?? [];

  // "showcase" = the Suites page: full-width alternating rows.
  if (props.display === "showcase") {
    const max = props.max ?? 8;
    const list = real.length
      ? real.slice(0, max).map((r, i) => ({
          tag: r.badge || r.facts?.[0] || STOCK_SUITES[i % 3]?.tag || "",
          name: r.name,
          desc: r.description || STOCK_SUITES[i % 3]?.desc || "",
          facts: (r.facts && r.facts.length
            ? r.facts
            : (STOCK_SUITES[i % 3]?.meta ?? [])
          ).slice(0, 4),
          price:
            r.price != null
              ? `R${Number(r.price).toLocaleString("en-ZA")}`
              : (STOCK_SUITES[i % 3]?.price ?? ""),
          img: r.imageUrl || STOCK_SUITES[i % 3]?.img || IMG.suite1,
          detailHref: r.detailHref || r.bookHref || roomsHref,
          bookHref: r.bookHref || reserveHref,
        }))
      : STOCK_SUITES.map((s) => ({
          tag: s.tag,
          name: s.name,
          desc: s.desc,
          facts: s.meta,
          price: s.price,
          img: s.img,
          detailHref: roomsHref,
          bookHref: reserveHref,
        }));
    return (
      <section
        className="section"
        data-section="rooms_preview"
        data-live="true"
      >
        <div className="wrap">
          {props.heading ? (
            <div className="sec-head" style={{ marginBottom: 8 }}>
              <span className="eyebrow">{props.eyebrow || "The suites"}</span>
              <h2 style={{ marginTop: 14 }}>{props.heading}</h2>
            </div>
          ) : null}
          <div className="room-rows">
            {list.map((s, i) => (
              <article key={s.name + i} className="room-row">
                <div className="rr-media">
                  {s.tag ? <span className="rc-tag">{s.tag}</span> : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.img} alt={s.name} />
                </div>
                <div className="rr-body">
                  <h3>{s.name}</h3>
                  {s.facts.length ? (
                    <div className="rr-meta">
                      {s.facts.map((f, j) => (
                        <span key={f + j} className="chip">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {s.desc ? <p>{s.desc}</p> : null}
                  <div className="rr-foot">
                    {s.price ? (
                      <div className="price">
                        {s.price}
                        <small> / night</small>
                      </div>
                    ) : null}
                    <a href={s.detailHref} className="btn btn-ghost">
                      <span>View suite</span>
                    </a>
                    <a href={s.bookHref} className="btn btn-primary">
                      <span>Reserve</span>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default = card grid (home / suites preview).
  const suites = real.length
    ? real.slice(0, props.max ?? 6).map((r, i) => ({
        tag: r.badge || r.facts?.[0] || STOCK_SUITES[i % 3]?.tag || "",
        name: r.name,
        meta: (r.facts ?? STOCK_SUITES[i % 3]?.meta ?? []).slice(0, 2),
        desc: r.description || STOCK_SUITES[i % 3]?.desc || "",
        price:
          r.price != null
            ? `R${Number(r.price).toLocaleString("en-ZA")}`
            : (STOCK_SUITES[i % 3]?.price ?? ""),
        img: r.imageUrl || STOCK_SUITES[i % 3]?.img || IMG.suite1,
        href: r.detailHref || r.bookHref || roomsHref,
      }))
    : STOCK_SUITES.map((s) => ({
        tag: s.tag,
        name: s.name,
        meta: s.meta,
        desc: s.desc,
        price: s.price,
        img: s.img,
        href: roomsHref,
      }));

  return (
    <section className="section" data-section="rooms_preview" data-live="true">
      <div className="wrap">
        <div
          className="sec-head"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            maxWidth: "none",
            gap: 28,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <span className="eyebrow">
              {props.eyebrow || "Where you'll stay"}
            </span>
            <h2 style={{ marginTop: 14 }}>
              {props.heading || "Eight suites along the riverbed"}
            </h2>
          </div>
          <a href={roomsHref} className="link-arrow">
            {props.ctaLabel || "All suites & rates"} {ARROW}
          </a>
        </div>
        <div className="rooms-grid">
          {suites.map((s, i) => (
            <a key={s.name + i} href={s.href} className="room-card">
              <div className="rc-img">
                {s.tag ? <span className="rc-tag">{s.tag}</span> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={s.name} />
              </div>
              <div className="rc-body">
                <h3>{s.name}</h3>
                <div className="rc-meta">
                  {s.meta.map((m, j) => (
                    <span key={m + j}>{m}</span>
                  ))}
                </div>
                {s.desc ? <p className="rc-desc">{s.desc}</p> : null}
                <div className="rc-foot">
                  {s.price ? (
                    <div className="price">
                      {s.price}
                      <small> / night</small>
                    </div>
                  ) : null}
                  <span className="link-arrow">View {ARROW}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── GALLERY (mosaic) ───────────────────────────────────────────────── */
export function SabelaGallery({
  props,
  data,
}: {
  props: P<"gallery">;
  data?: GalleryData;
}) {
  const imgs = data?.images?.length
    ? data.images.slice(0, 7).map((g) => g.url)
    : STOCK_GALLERY;
  // Mosaic: first tile 2×2, sixth spans 2 wide (mirrors the design).
  const cls = ["g span2 row2", "g", "g", "g", "g", "g span2", "g"];
  return (
    <section
      className="section-sm soft-bg"
      data-section="gallery"
      data-live="true"
    >
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow center no-rule">
            {props.eyebrow || "A look around"}
          </span>
          <h2 style={{ marginTop: 14 }}>
            {props.heading || "The reserve, in fragments"}
          </h2>
        </div>
        <div className="gallery">
          {imgs.map((src, i) => (
            <div key={src + i} className={cls[i] ?? "g"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── REVIEWS ────────────────────────────────────────────────────────── */
export function SabelaReviews({
  props,
  data,
}: {
  props: P<"reviews">;
  data?: ReviewsData;
}) {
  const real = data?.items ?? [];
  const reviews = real.length
    ? real.slice(0, 3).map((r) => ({
        quote: r.body ?? "",
        initials: initialsOf(r.author ?? "Guest"),
        name: r.author ?? "Guest",
        date: r.date ?? "",
      }))
    : STOCK_REVIEWS;
  const avg = data?.average != null ? data.average.toFixed(2) : "4.97";
  const count = data?.count != null ? data.count : 180;
  return (
    <section className="section" data-section="reviews" data-live="true">
      <div className="wrap">
        <div className="rating-hero">
          <div className="score">
            {avg}
            <small>out of 5</small>
          </div>
          <div style={{ maxWidth: 460 }}>
            <div className="rating-inline">
              <span className="stars">★★★★★</span>
            </div>
            <h2 style={{ marginTop: 14 }}>
              {props.heading || "Guests arrive curious. They leave changed."}
            </h2>
            <p className="muted" style={{ marginTop: 14 }}>
              {props.subheading || `${count} verified guest stays`}
            </p>
          </div>
        </div>
        <div className="reviews-grid">
          {reviews.map((r, i) => (
            <div key={r.initials + i} className="review">
              <div className="stars">★★★★★</div>
              <p>{r.quote}</p>
              <div className="who">
                <span className="avatar">{r.initials}</span>
                <div>
                  <div className="nm">{r.name}</div>
                  <div className="dt">{r.date}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── LOCATION (split + map) ─────────────────────────────────────────── */
export function SabelaLocation({
  props,
  ctx,
}: {
  props: P<"location">;
  ctx?: SabelaCtx;
}) {
  const tag = props.heading?.trim() || "Find us";
  return (
    <section
      className="section soft-bg"
      data-section="location"
      data-live="true"
    >
      <div className="wrap">
        <div className="loc">
          <div>
            <span className="eyebrow">{props.eyebrow || "Getting here"}</span>
            <h2 style={{ marginTop: 14 }}>
              {props.heading || "Closer than you think"}
            </h2>
            <p className="muted" style={{ marginTop: 20, maxWidth: "48ch" }}>
              {props.body ||
                "A malaria-free reserve, a short charter from the city, or forty-five minutes by light aircraft to our private airstrip. Full directions follow your booking."}
            </p>
            {ctx?.contactHref ? (
              <a
                href={ctx.contactHref}
                className="link-arrow"
                style={{ marginTop: 28, display: "inline-flex" }}
              >
                Directions &amp; transfers {ARROW}
              </a>
            ) : null}
          </div>
          <div className="map-ph">
            <span className="map-pin" />
            <div
              style={{
                position: "absolute",
                left: 16,
                bottom: 16,
                fontSize: 13,
                color: "var(--site-ink)",
                background: "var(--site-surface)",
                border: "1px solid var(--site-line)",
                padding: "8px 12px",
                borderRadius: "var(--site-radius-sm, 4px)",
              }}
            >
              📍 {tag}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── MAP ────────────────────────────────────────────────────────────── */
export function SabelaMap({ props }: { props: P<"map"> }) {
  const tag = props.caption?.trim() || props.address?.trim() || "Find us";
  return (
    <section
      className="section-sm"
      data-section="map"
      style={{ paddingTop: 0 }}
    >
      <div className="wrap">
        <div className="map-ph">
          <span className="map-pin" />
          <div
            style={{
              position: "absolute",
              left: 16,
              bottom: 16,
              fontSize: 13,
              color: "var(--site-ink)",
              background: "var(--site-surface)",
              border: "1px solid var(--site-line)",
              padding: "8px 12px",
              borderRadius: "var(--site-radius-sm, 4px)",
            }}
          >
            📍 {tag}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── CTA (band) ─────────────────────────────────────────────────────── */
export function SabelaCta({
  props,
  ctx,
}: {
  props: P<"cta">;
  ctx?: SabelaCtx;
}) {
  const reserve =
    props.button_href?.trim() || ctx?.reserveHref || ctx?.roomsHref || "#rooms";

  if (props.newsletter) {
    return (
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band">
            <span className="glow" />
            <h2>{props.heading || "Field notes, twice a season"}</h2>
            <p>
              {props.body ||
                "Sightings, open dates and the occasional recipe — no noise, just the reserve in your inbox."}
            </p>
            <form
              className="foot-news"
              style={{ maxWidth: 420, margin: "26px auto 0" }}
            >
              <input
                type="email"
                placeholder="you@email.com"
                aria-label="Email"
              />
              <button className="btn btn-light btn-sm" type="button">
                <span>{props.button_label || "Subscribe"}</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section-sm" data-section="cta">
      <div className="wrap">
        <div className="cta-band">
          <span className="glow" />
          <h2>{props.heading || "Your safari begins with a single message"}</h2>
          <p>
            {props.body ||
              "Reserve straight with the lodge — no agents, no booking fees, no commission. Just your stay, arranged by the people who'll greet you at the airstrip."}
          </p>
          <div className="hero-cta-row" style={{ justifyContent: "center" }}>
            <a href={reserve} className="btn btn-light btn-lg">
              <span>{props.button_label || "Plan your safari"}</span>
            </a>
            {ctx?.contactHref ? (
              <a href={ctx.contactHref} className="btn btn-on-dark btn-lg">
                <span>Ask us anything</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── HOST BIO ───────────────────────────────────────────────────────── */
export function SabelaHostBio({
  props,
  asset,
}: {
  props: P<"host_bio">;
  asset?: SiteAssetResolver;
}) {
  const reversed = props.reverse === true;
  return (
    <section className="section soft-bg" data-section="host_bio">
      <div className="wrap">
        <div className="host">
          <div className="host-img" style={reversed ? { order: 2 } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(props.photo_path, asset, IMG.host)} alt="" />
          </div>
          <div>
            <span className="eyebrow">{props.heading || "Your hosts"}</span>
            {props.name ? (
              <h2 style={{ marginTop: 14 }}>{props.name}</h2>
            ) : null}
            {props.body ? (
              <p
                className="muted"
                style={{ marginTop: 18, whiteSpace: "pre-line" }}
              >
                {props.body}
              </p>
            ) : null}
            {props.points && props.points.length ? (
              <div className="amenities" style={{ marginTop: 24 }}>
                {props.points.map((p, i) =>
                  p.text?.trim() ? (
                    <div key={p.text + i} className="amenity">
                      {CHECK_ICON}
                      {p.text}
                    </div>
                  ) : null,
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── VALUES ─────────────────────────────────────────────────────────── */
export function SabelaValues({ props }: { props: P<"values"> }) {
  const items = (props.items ?? []).filter((v) => v.title?.trim());
  if (!items.length) return null;
  return (
    <section className="section" data-section="values">
      <div className="wrap">
        <div className="sec-head">
          <h2>{props.heading || "What we stand for"}</h2>
        </div>
        <div className="values">
          {items.map((v, i) => (
            <div key={v.title + i} className="value">
              <span className="vn">{`0${i + 1}`}</span>
              <h3>{v.title}</h3>
              {v.body ? <p>{v.body}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ (accordion) ────────────────────────────────────────────────── */
export function SabelaFaq({ props }: { props: P<"faq"> }) {
  const items = (props.items ?? []).filter((f) => f.q?.trim());
  if (!items.length) return null;
  return (
    <section className="section soft-bg" data-section="faq">
      <div className="wrap wrap-narrow">
        <div className="sec-head center">
          <span className="eyebrow center no-rule">
            {props.eyebrow || "Questions"}
          </span>
          <h2 style={{ marginTop: 14 }}>{props.heading || "Good to know"}</h2>
        </div>
        <div className="faq">
          {items.map((f, i) => (
            <details key={f.q + i} className="faq-item" open={i === 0}>
              <summary>
                {f.q}
                <span className="faq-ic" aria-hidden="true" />
              </summary>
              {f.a ? <p className="faq-a">{f.a}</p> : null}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── AMENITIES ──────────────────────────────────────────────────────── */
export function SabelaAmenities({ props }: { props: P<"amenities"> }) {
  const items = (props.items ?? []).filter((a) => a.label?.trim());
  if (!items.length) return null;
  const inline = props.variant === "inline";
  return (
    <section
      className={inline ? "section-sm" : "section"}
      data-section="amenities"
    >
      <div className="wrap">
        {props.heading ? (
          <h2 style={{ fontSize: "1.7rem", marginBottom: 4 }}>
            {props.heading}
          </h2>
        ) : null}
        <div className={inline ? "amenities inline" : "amenities"}>
          {items.map((a, i) => (
            <div key={a.label + i} className="amenity">
              {a.icon?.trim() ? (
                <span style={{ fontSize: 18, lineHeight: 1 }}>{a.icon}</span>
              ) : (
                CHECK_ICON
              )}
              {a.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── PRICING / RATES ────────────────────────────────────────────────── */
export function SabelaPricing({ props }: { props: P<"pricing"> }) {
  const items = (props.items ?? []).filter((r) => r.label?.trim());
  return (
    <section className="section" data-section="pricing">
      <div className="wrap wrap-narrow">
        {props.heading ? (
          <div className="sec-head center">
            <h2>{props.heading}</h2>
          </div>
        ) : null}
        <div
          style={{
            marginTop: 28,
            border: "1px solid var(--site-line)",
            borderRadius: "var(--site-radius-lg, 14px)",
            overflow: "hidden",
          }}
        >
          {items.map((r, i) => (
            <div
              key={r.label + i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 16,
                padding: "20px 24px",
                borderTop: i ? "1px solid var(--site-line)" : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 16, color: "var(--site-ink)" }}>
                  {r.label}
                </div>
                {r.note ? (
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                    {r.note}
                  </div>
                ) : null}
              </div>
              <div className="price" style={{ whiteSpace: "nowrap" }}>
                {r.price}
              </div>
            </div>
          ))}
        </div>
        {props.footnote ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
            {props.footnote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ── BLOG PREVIEW ───────────────────────────────────────────────────── */
export function SabelaBlogPreview({
  props,
  data,
}: {
  props: P<"blog_preview">;
  data?: BlogPreviewData;
}) {
  const real = data?.posts ?? [];

  if (props.display === "journal") {
    const all = real.length ? real : STOCK_POSTS;
    const featured = all[0];
    const rest = all.slice(1, (props.max ?? 6) + 1);
    return (
      <>
        {featured ? (
          <section
            className="section"
            data-section="blog_preview"
            data-live="true"
            style={{ paddingBottom: "clamp(40px,5vw,64px)" }}
          >
            <div className="wrap">
              <a href={featured.href || "#"} className="post-feature">
                <div className="pf-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featured.coverUrl || STOCK_GALLERY[0]}
                    alt={featured.title}
                  />
                </div>
                <div>
                  <span className="pc-cat">Featured</span>
                  <h2 style={{ margin: "14px 0 16px" }}>{featured.title}</h2>
                  {featured.excerpt ? (
                    <p className="muted">{featured.excerpt}</p>
                  ) : null}
                  {featured.date ? (
                    <div className="pc-meta">
                      <span>{featured.date}</span>
                    </div>
                  ) : null}
                  <span
                    className="link-arrow"
                    style={{ marginTop: 18, display: "inline-flex" }}
                  >
                    Read the story {ARROW}
                  </span>
                </div>
              </a>
            </div>
          </section>
        ) : null}
        {rest.length > 0 ? (
          <section
            className="section"
            style={{ paddingTop: "clamp(20px,3vw,40px)" }}
          >
            <div className="wrap">
              <div className="blog-grid">
                {rest.map((post, i) => (
                  <a
                    key={post.href + i}
                    href={post.href || "#"}
                    className="post-card"
                  >
                    <div className="pc-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          post.coverUrl ||
                          STOCK_GALLERY[(i + 1) % STOCK_GALLERY.length]
                        }
                        alt={post.title}
                      />
                    </div>
                    <div className="pc-body">
                      <span className="pc-cat">Journal</span>
                      <h3 style={{ margin: "12px 0 10px" }}>{post.title}</h3>
                      {post.excerpt ? (
                        <p className="pc-ex">{post.excerpt}</p>
                      ) : null}
                      {post.date ? (
                        <div className="pc-meta">
                          <span>{post.date}</span>
                        </div>
                      ) : null}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </>
    );
  }

  const posts = (real.length ? real : STOCK_POSTS).slice(0, props.max ?? 3);
  return (
    <section className="section" data-section="blog_preview" data-live="true">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow center no-rule">
            {props.eyebrow || "The journal"}
          </span>
          <h2 style={{ marginTop: 14 }}>
            {props.heading || "Latest from the journal"}
          </h2>
        </div>
        <div className="blog-grid">
          {posts.map((post, i) => (
            <a
              key={post.href + i}
              href={post.href || "#"}
              className="post-card"
            >
              <div className="pc-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.coverUrl || STOCK_GALLERY[i % STOCK_GALLERY.length]}
                  alt={post.title}
                />
              </div>
              <div className="pc-body">
                <span className="pc-cat">Journal</span>
                <h3 style={{ margin: "12px 0 10px" }}>{post.title}</h3>
                {post.excerpt ? <p className="pc-ex">{post.excerpt}</p> : null}
                {post.date ? (
                  <div className="pc-meta">
                    <span>{post.date}</span>
                  </div>
                ) : null}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── ROOM DETAIL bands (bind to the single room in scope) ───────────── */
function SabelaRoomPlaceholder({ label }: { label: string }) {
  return (
    <section className="section">
      <div className="wrap">
        <div
          style={{
            border: "1px dashed var(--site-line)",
            borderRadius: "var(--site-radius, 4px)",
            padding: 40,
            textAlign: "center",
            color: "var(--site-mute)",
            fontSize: 14,
          }}
        >
          {label}
        </div>
      </div>
    </section>
  );
}

export function SabelaRoomGallery({
  props,
  data,
}: {
  props: P<"room_gallery">;
  data?: RoomDetail;
}) {
  const images = (data?.images ?? []).slice(0, props.max ?? 12);
  if (!images.length)
    return <SabelaRoomPlaceholder label="This room's photos appear here." />;
  const five = images.slice(0, 5);
  return (
    <section
      className="section-sm"
      data-section="room_gallery"
      data-live="true"
      style={{ paddingBottom: 0 }}
    >
      <div className="wrap">
        <div className="rd-gallery">
          {five.map((im, i) => (
            <div key={im.url + i} className="g">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt={im.alt || data?.name || ""} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SabelaRoomOverview({
  props,
  data,
}: {
  props: P<"room_overview">;
  data?: RoomDetail;
}) {
  if (!data)
    return (
      <SabelaRoomPlaceholder label="The room's name and details appear here." />
    );
  const title = props.heading?.trim() || data.name;
  const facts = props.show_facts !== false ? data.facts : [];
  const price =
    props.show_price !== false ? rand(data.price, data.currency) : "";
  return (
    <section className="section" data-section="room_overview" data-live="true">
      <div className="wrap">
        <div className="crumb">
          <a href="../rooms">Suites</a>
          <span>·</span>
          <span>{data.name}</span>
        </div>
        <h1 style={{ marginTop: 14, fontSize: "clamp(2.2rem,4vw,3.6rem)" }}>
          {title}
        </h1>
        <div className="rd-grid">
          <div>
            {facts.length ? (
              <div
                className="rr-meta"
                style={{ marginTop: 4, marginBottom: 8 }}
              >
                {facts.map((f, i) => (
                  <span key={f + i} className="chip">
                    {f}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="rd-sec">
              <h2>The suite</h2>
              {data.description ? (
                <p style={{ whiteSpace: "pre-line" }}>{data.description}</p>
              ) : (
                <p>
                  A quiet, design-led suite opening onto the reserve, with space
                  to slow right down between drives.
                </p>
              )}
            </div>
          </div>
          <aside className="book-widget sticky">
            {price ? (
              <div className="bw-price">
                <span className="price">{price}</span>
                <span className="muted"> / night</span>
              </div>
            ) : null}
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Full-board, including twice-daily game drives.
            </p>
            <a
              href={data.bookHref}
              className="btn btn-primary btn-block btn-lg"
            >
              <span>Check availability</span>
            </a>
            <div className="bw-note">{CHECK_ICON} Book direct · 0% fees</div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function SabelaRoomAmenities({
  props,
  data,
}: {
  props: P<"room_amenities">;
  data?: RoomDetail;
}) {
  const amenities = data?.amenities ?? [];
  if (!amenities.length)
    return <SabelaRoomPlaceholder label="This room's amenities appear here." />;
  return (
    <section className="section soft-bg" data-section="room_amenities">
      <div className="wrap">
        <h2 style={{ fontSize: "1.7rem", marginBottom: 4 }}>
          {props.heading || "In the suite"}
        </h2>
        <div
          className="amenities"
          style={
            props.variant === "list"
              ? { gridTemplateColumns: "1fr" }
              : undefined
          }
        >
          {amenities.map((a, i) => (
            <div key={a.label + i} className="amenity">
              {CHECK_ICON}
              {a.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SabelaRoomRate({
  props,
  data,
}: {
  props: P<"room_rate">;
  data?: RoomDetail;
}) {
  if (!data)
    return (
      <SabelaRoomPlaceholder label="The room's rate and booking button appear here." />
    );
  const price = rand(data.price, data.currency);
  return (
    <section className="section-sm" data-section="room_rate">
      <div className="wrap wrap-narrow">
        <div
          style={{
            border: "1px solid var(--site-line)",
            borderRadius: "var(--site-radius-lg, 14px)",
            padding: "clamp(28px,4vw,40px)",
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--site-surface)",
          }}
        >
          <div>
            {props.heading ? (
              <h3 style={{ fontSize: "1.4rem" }}>{props.heading}</h3>
            ) : null}
            {price ? (
              <div
                className="price"
                style={{
                  fontSize: "2rem",
                  marginTop: props.heading ? 6 : 0,
                }}
              >
                {price}
                <small className="muted" style={{ marginLeft: 8 }}>
                  {" "}
                  / night
                </small>
              </div>
            ) : null}
            {props.note ? (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {props.note}
              </p>
            ) : null}
          </div>
          <a href={data.bookHref} className="btn btn-primary btn-lg">
            <span>{props.cta_label?.trim() || "Book this room"}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── ROOM / PROPERTY POLICIES — "things to know" ────────────────────── */
function SabelaPolicyView({
  heading,
  policies,
}: {
  heading?: string;
  policies: RoomPolicies;
}) {
  const p = policies;
  const items: { label: string; value: string }[] = [];
  if (p.checkIn) items.push({ label: "Check-in", value: `From ${p.checkIn}` });
  if (p.checkOut)
    items.push({ label: "Check-out", value: `Until ${p.checkOut}` });
  if (p.cancellation)
    items.push({ label: "Cancellation", value: p.cancellation });
  if (p.children != null)
    items.push({
      label: "Children",
      value: p.children ? "Welcome" : "Not suitable",
    });
  if (p.pets != null)
    items.push({ label: "Pets", value: p.pets ? "Allowed" : "Not allowed" });
  const labelStyle: CSSProperties = {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: ".08em",
  };
  return (
    <section className="section-sm" data-section="room_policies">
      <div className="wrap wrap-narrow">
        <span className="eyebrow">Good to know</span>
        <h2 style={{ marginTop: 14, fontSize: "clamp(1.8rem,3.4vw,2.6rem)" }}>
          {heading || "Things to know"}
        </h2>
        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: "24px 40px",
          }}
        >
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                borderTop: "1px solid var(--site-line)",
                paddingTop: 14,
              }}
            >
              <div className="muted" style={labelStyle}>
                {it.label}
              </div>
              <div style={{ marginTop: 4, fontSize: 15 }}>{it.value}</div>
            </div>
          ))}
        </div>
        {p.houseRules ? (
          <div
            style={{
              marginTop: 28,
              borderTop: "1px solid var(--site-line)",
              paddingTop: 14,
            }}
          >
            <div className="muted" style={labelStyle}>
              House rules
            </div>
            <p style={{ marginTop: 6, fontSize: 15, whiteSpace: "pre-line" }}>
              {p.houseRules}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SabelaRoomPolicies({
  props,
  data,
}: {
  props: P<"room_policies">;
  data?: RoomDetail;
}) {
  const p = data?.policies;
  if (!p)
    return (
      <SabelaRoomPlaceholder label="This room's cancellation policy and house rules appear here." />
    );
  return <SabelaPolicyView heading={props.heading} policies={p} />;
}

export function SabelaPolicies({
  props,
  data,
}: {
  props: P<"policies">;
  data?: RoomPolicies;
}) {
  if (!data) return null;
  return <SabelaPolicyView heading={props.heading} policies={data} />;
}

/* ── RATE TABLE (live nightly rates, display-only) ──────────────────── */
export function SabelaRateTable({
  props,
  data,
}: {
  props: P<"rate_table">;
  data?: RateTableData;
}) {
  const rows = data?.rows ?? [];
  if (!rows.length) return null;
  return (
    <section className="section" data-section="rate_table" data-live="true">
      <div className="wrap wrap-narrow">
        {props.heading ? (
          <div className="sec-head center">
            <h2>{props.heading}</h2>
          </div>
        ) : null}
        <div
          style={{
            marginTop: 28,
            border: "1px solid var(--site-line)",
            borderRadius: "var(--site-radius-lg, 14px)",
            overflow: "hidden",
          }}
        >
          {rows.map((r, i) => (
            <div
              key={r.roomId + i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                padding: "18px 24px",
                borderTop: i ? "1px solid var(--site-line)" : "none",
              }}
            >
              <div>
                <div style={{ fontSize: 16, color: "var(--site-ink)" }}>
                  {r.name}
                </div>
                {r.propertyName ? (
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                    {r.propertyName}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span className="price" style={{ whiteSpace: "nowrap" }}>
                  {r.nightlyFrom != null
                    ? rand(r.nightlyFrom, r.currency)
                    : "—"}
                  <small className="muted"> / night</small>
                </span>
                <a href={r.bookHref} className="btn btn-primary btn-sm">
                  <span>Book</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── GENERIC FALLBACK ───────────────────────────────────────────────── */
/** Render free elements + containers + data-driven blocks that have no bespoke
 *  Sabela band, via the shared generic components. No `--site-*` bridge needed:
 *  sabela.css already declares every `--site-*` token under `.wielo-sabela`, so
 *  the shared components inherit the Sabela palette + type scale directly. */
function renderSabelaGenericFallback(
  section: WebsiteSection,
  opts: { data?: SiteData; asset?: SiteAssetResolver; interactive?: boolean },
): ReactNode | undefined {
  const { data, asset, interactive } = opts;
  switch (section.type) {
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
    case "rich_text":
      return <RichTextSection props={section.props} />;
    case "video":
      return <VideoSection props={section.props} />;
    case "columns":
      return <ColumnsSection props={section.props} asset={asset} />;
    case "flex":
      return <FlexSection props={section.props} asset={asset} />;
    case "logos":
      return <LogosSection props={section.props} asset={asset} />;
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
    default:
      return undefined;
  }
}

export function renderSabelaSection(
  section: WebsiteSection,
  opts: {
    data?: SiteData;
    asset?: SiteAssetResolver;
    ctx?: SabelaCtx;
    websiteId?: string;
    interactive?: boolean;
  },
): ReactNode | undefined {
  const { data, asset, ctx, websiteId, interactive } = opts;
  switch (section.type) {
    case "hero":
      return <SabelaHero props={section.props} asset={asset} ctx={ctx} />;
    case "intro":
      return <SabelaIntro props={section.props} asset={asset} ctx={ctx} />;
    case "highlights":
      return <SabelaHighlights props={section.props} />;
    case "rooms_preview":
      return (
        <SabelaSuites
          props={section.props}
          data={dataFor(data, section.id, "rooms_preview")}
          ctx={ctx}
        />
      );
    case "gallery":
      return (
        <SabelaGallery
          props={section.props}
          data={dataFor(data, section.id, "gallery")}
        />
      );
    case "reviews":
      return (
        <SabelaReviews
          props={section.props}
          data={dataFor(data, section.id, "reviews")}
        />
      );
    case "location":
      return <SabelaLocation props={section.props} ctx={ctx} />;
    case "cta":
      return <SabelaCta props={section.props} ctx={ctx} />;
    case "host_bio":
      return <SabelaHostBio props={section.props} asset={asset} />;
    case "stats":
      return <SabelaStats props={section.props} />;
    case "values":
      return <SabelaValues props={section.props} />;
    case "map":
      return <SabelaMap props={section.props} />;
    case "contact_form":
      return (
        <SabelaContactForm
          props={section.props}
          ctx={ctx}
          websiteId={websiteId}
          interactive={interactive}
        />
      );
    case "form":
      // Host-built form block — reuse the shared FormSection engine inside a
      // Sabela section shell. `--site-*` are already correct under .wielo-sabela.
      return (
        <section className="section" data-section="form">
          <div className="wrap wrap-narrow">
            <FormSection
              props={section.props}
              data={dataFor(data, section.id, "form")}
              websiteId={websiteId}
              interactive={interactive}
            />
          </div>
        </section>
      );
    case "faq":
      return <SabelaFaq props={section.props} />;
    case "amenities":
      return <SabelaAmenities props={section.props} />;
    case "pricing":
      return <SabelaPricing props={section.props} />;
    case "blog_preview":
      return (
        <SabelaBlogPreview
          props={section.props}
          data={dataFor(data, section.id, "blog_preview")}
        />
      );
    case "room_gallery":
      return (
        <SabelaRoomGallery
          props={section.props}
          data={dataFor(data, section.id, "room_gallery")}
        />
      );
    case "room_overview":
      return (
        <SabelaRoomOverview
          props={section.props}
          data={dataFor(data, section.id, "room_overview")}
        />
      );
    case "room_amenities":
      return (
        <SabelaRoomAmenities
          props={section.props}
          data={dataFor(data, section.id, "room_amenities")}
        />
      );
    case "room_rate":
      return (
        <SabelaRoomRate
          props={section.props}
          data={dataFor(data, section.id, "room_rate")}
        />
      );
    case "room_policies":
      return (
        <SabelaRoomPolicies
          props={section.props}
          data={dataFor(data, section.id, "room_policies")}
        />
      );
    case "policies":
      return (
        <SabelaPolicies
          props={section.props}
          data={dataFor(data, section.id, "policies")}
        />
      );
    case "rate_table":
      return (
        <SabelaRateTable
          props={section.props}
          data={dataFor(data, section.id, "rate_table")}
        />
      );
    default:
      return undefined;
  }
}

/** True when a per-device override actually changes something (vs an empty bag). */
function hasOverrideProps(o?: { props?: Record<string, unknown> }): boolean {
  return !!o?.props && Object.keys(o.props).length > 0;
}

/** A section with a partial props override merged over its desktop props. */
function withProps(
  s: WebsiteSection,
  override?: Record<string, unknown>,
): WebsiteSection {
  if (!override || Object.keys(override).length === 0) return s;
  return { ...s, props: { ...s.props, ...override } } as WebsiteSection;
}

/**
 * Renders an ordered list of sections in the Sabela design — the public-site
 * counterpart to the builder canvas, so live === builder. Section types without
 * a Sabela band fall back to the shared generic components (themed via the
 * `.wielo-sabela` `--site-*` tokens), so every block type renders.
 */
export function SabelaSectionList({
  sections,
  data,
  asset,
  ctx,
  websiteId,
  interactive,
}: {
  sections: WebsiteSection[];
  data?: SiteData;
  asset?: SiteAssetResolver;
  ctx?: SabelaCtx;
  websiteId?: string;
  interactive?: boolean;
}) {
  const render = (s: WebsiteSection) => {
    const sabela = renderSabelaSection(s, {
      data,
      asset,
      ctx,
      websiteId,
      interactive,
    });
    if (sabela !== undefined) return sabela;
    return renderSabelaGenericFallback(s, { data, asset, interactive });
  };
  return (
    <>
      {sections
        .filter((s) => s.enabled)
        .map((s) => {
          const lap = s.responsive?.laptop;
          const mob = s.responsive?.mobile;
          const lapProps = hasOverrideProps(lap);
          const mobProps = hasOverrideProps(mob);

          if (!lapProps && !mobProps) {
            const el = render(s);
            if (el === undefined) return null;
            const cls = [
              "wielo-rwrap",
              lap?.hidden ? "rh-laptop" : "",
              mob?.hidden ? "rh-mobile" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={s.id} className={cls}>
                {el}
              </div>
            );
          }

          const laptopProps = lapProps
            ? { ...(s.props as Record<string, unknown>), ...lap!.props }
            : undefined;
          const mobileBase =
            laptopProps ?? (s.props as Record<string, unknown>);
          const mobileProps = mobProps
            ? { ...mobileBase, ...mob!.props }
            : undefined;
          const desktopEl = render(s);
          if (desktopEl === undefined) return null;
          const laptopEl = lap?.hidden
            ? null
            : render(withProps(s, laptopProps));
          const mobileEl = mob?.hidden
            ? null
            : render(withProps(s, mobileProps));
          return (
            <Fragment key={s.id}>
              <div className="wielo-rdup wielo-rdup-desktop">{desktopEl}</div>
              {laptopEl ? (
                <div className="wielo-rdup wielo-rdup-laptop">{laptopEl}</div>
              ) : null}
              {mobileEl ? (
                <div className="wielo-rdup wielo-rdup-mobile">{mobileEl}</div>
              ) : null}
            </Fragment>
          );
        })}
    </>
  );
}
