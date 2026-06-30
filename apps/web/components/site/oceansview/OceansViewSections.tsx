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
  type SpecialsPreviewData,
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
import { OceansViewContactForm } from "./OceansViewContactForm";

/**
 * The Oceans View ("oceansview" theme) bands — the SAME flat sections the
 * builder knows, rendered in the bright Mediterranean beach-resort design. The
 * SectionRenderer dispatches here (via `renderOceansViewSection`) when the active
 * theme is oceansview, so the builder canvas and the public site render
 * identically. Content comes from the host's props; imagery falls back to the
 * design's stock; suites/reviews/gallery/blog/room bands bind to live data.
 * Every selector lives in oceansview.css under `.wielo-oceansview` (--site-*).
 */

type P<T extends WebsiteSection["type"]> = Extract<
  WebsiteSection,
  { type: T }
>["props"];

export type SectionResponsive = WebsiteSection["responsive"];

/** Cross-page links + brand + contact for the bands. All optional with a
 *  sensible fallback so the builder canvas (links inert) still renders. */
export interface OceansViewCtx {
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
  hero: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=2400&q=80",
  intro:
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
  room1:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80",
  room2:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80",
  room3:
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=900&q=80",
  g1: "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1200&q=80",
  g2: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=700&q=80",
  g3: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=700&q=80",
  g4: "https://images.unsplash.com/photo-1535262412227-85541e910204?w=700&q=80",
  g5: "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=700&q=80",
  g6: "https://images.unsplash.com/photo-1468413253725-0d5181091126?w=1200&q=80",
  g7: "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=700&q=80",
  host: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&q=80",
};

const STOCK_TILES = [
  {
    title: "Three pools & the sea",
    body: "Two heated pools, a lap pool and a private path straight onto the sand.",
  },
  {
    title: "Tables by the water",
    body: "Sea-to-table menus and sundowners with the best view on the bay.",
  },
  {
    title: "Spa & wellness",
    body: "Ocean-air treatments, a sauna, and morning yoga on the deck.",
  },
];

const STOCK_ROOMS = [
  {
    tag: "Sea view",
    name: "Sea-view room",
    meta: ["Sleeps 2", "Balcony", "King bed"],
    desc: "A bright room with a private balcony over the bay and the sound of the surf at night.",
    price: "R2,950",
    img: IMG.room1,
  },
  {
    tag: "Suite",
    name: "Ocean suite",
    meta: ["Sleeps 3", "Lounge", "Sea view"],
    desc: "A spacious suite with a separate lounge, deep tub and an uninterrupted view of the water.",
    price: "R4,500",
    img: IMG.room2,
  },
  {
    tag: "Family",
    name: "Family loft",
    meta: ["Sleeps 4", "Two rooms", "Pool side"],
    desc: "Two connected rooms by the pool, made for easy family days and barefoot evenings.",
    price: "R5,200",
    img: IMG.room3,
  },
];

const STOCK_REVIEWS = [
  {
    quote:
      "We woke to the sound of the sea every morning. The pools, the breakfast, the welcome — faultless from start to finish.",
    initials: "AM",
    name: "Anna & Marc",
    loc: "May 2026 · London",
  },
  {
    quote:
      "The ocean suite is worth every cent. Balcony over the water, the best breakfast on the bay, and the warmest team.",
    initials: "TZ",
    name: "Thandi Z.",
    loc: "Apr 2026 · Johannesburg",
  },
  {
    quote:
      "Booked direct, paid exactly what they quoted, and got an upgrade on arrival. We are already planning next summer.",
    initials: "JS",
    name: "James S.",
    loc: "Mar 2026 · Cape Town",
  },
];

const STOCK_GALLERY = [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6, IMG.g7];

const STOCK_POSTS = [
  {
    title: "Sea to table: a day with our chef",
    href: "#",
    excerpt:
      "Where the morning's catch becomes the evening's menu — and why it tastes better by the water.",
    coverUrl: IMG.g1,
    date: "May 2026",
  },
  {
    title: "48 hours in the bay",
    href: "#",
    excerpt: "How to spend a perfect weekend, from sunrise swims to sunset.",
    coverUrl: IMG.g3,
    date: "Apr 2026",
  },
  {
    title: "Cleaning up the bay",
    href: "#",
    excerpt: "Our monthly beach clean-up, and how guests can join in.",
    coverUrl: IMG.g5,
    date: "Mar 2026",
  },
];

const STOCK_HERO_STATS = [
  { value: "32", label: "Sea-view rooms" },
  { value: "3", label: "Pools" },
  { value: "4.9 ★★★★★", label: "900+ stays" },
];

const ARROW = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const CHECK = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Small icon set for the feature tiles, keyed by the section's icon name. */
function tileIcon(name?: string | null): ReactNode {
  const c = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch ((name || "").toLowerCase()) {
    case "waves":
      return (
        <svg {...c}>
          <path d="M2 6c2 0 2 1.5 4 1.5S8 6 10 6s2 1.5 4 1.5S16 6 18 6s2 1.5 4 1.5M2 12c2 0 2 1.5 4 1.5s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M2 18c2 0 2 1.5 4 1.5s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5" />
        </svg>
      );
    case "utensils":
      return (
        <svg {...c}>
          <path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M21 15V2a5 5 0 0 0-3 5v6a2 2 0 0 0 2 2h1zm0 0v7" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...c}>
          <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9zM19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
        </svg>
      );
    default:
      if (name && /\p{Emoji}/u.test(name))
        return <span style={{ fontSize: 22, lineHeight: 1 }}>{name}</span>;
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

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
export function OceansViewHero({
  props,
  asset,
  ctx,
}: {
  props: P<"hero">;
  asset?: SiteAssetResolver;
  ctx?: OceansViewCtx;
}) {
  const roomsHref = ctx?.roomsHref || "#rooms";
  const aboutHref = ctx?.aboutHref;

  // Compact / split heroes → the design's `.phead` image banner for inner pages.
  if (
    props.compact ||
    props.variant === "split_right" ||
    props.variant === "split_left"
  ) {
    return (
      <section className="phead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(props.image_path, asset, IMG.hero)} alt="" />
        <div className="wrap">
          <div className="crumbs">
            <a href={ctx?.homeHref || "#"}>Home</a>
            {props.eyebrow ? (
              <>
                <span>·</span>
                <span>{props.eyebrow}</span>
              </>
            ) : null}
          </div>
          <h1>{props.headline || "About"}</h1>
          {props.subheadline ? <p>{props.subheadline}</p> : null}
        </div>
      </section>
    );
  }

  const showPrimary = props.show_cta !== false;
  const primaryLabel = props.cta_label || "Book a room";
  const primaryHref = props.cta_href?.trim() || roomsHref;
  const secondaryLabel =
    props.cta2_label?.trim() || (aboutHref ? "Explore the resort" : "");
  const secondaryHref = props.cta2_href?.trim() || aboutHref || "#";
  const showSecondary = props.show_cta2 !== false && secondaryLabel;
  const stats =
    props.stats && props.stats.length
      ? props.stats.filter((s) => s.value?.trim())
      : STOCK_HERO_STATS;
  const showStats = props.show_stats !== false && stats.length > 0;

  return (
    <section className="hero" data-section="hero">
      <div className="hero-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(props.image_path, asset, IMG.hero)} alt="" />
      </div>
      <div className="hero-in">
        <div className="wrap">
          {props.eyebrow ? (
            <span className="hero-chip">{props.eyebrow}</span>
          ) : null}
          <h1>{props.headline || "Wake up to the ocean"}</h1>
          <p className="hero-sub">
            {props.subheadline ||
              "A bright beachfront resort where the Atlantic starts at your door — sea-view rooms, three pools, a spa, and tables that watch the sun go down."}
          </p>
          {showPrimary || showSecondary ? (
            <div className="hero-cta">
              {showPrimary ? (
                <a href={primaryHref} className="btn btn-coral btn-lg">
                  <span>{primaryLabel}</span>
                </a>
              ) : null}
              {showSecondary ? (
                <a href={secondaryHref} className="btn btn-on-img btn-lg">
                  <span>{secondaryLabel}</span>
                </a>
              ) : null}
            </div>
          ) : null}
          {showStats ? (
            <div
              className="stats"
              style={{
                display: "flex",
                gap: "clamp(28px,4vw,56px)",
                marginTop: 40,
                flexWrap: "wrap",
              }}
            >
              {stats.map((s, i) => (
                <div key={s.value + i} className="stat">
                  <b style={{ color: "#fff" }}>{s.value}</b>
                  {s.label ? (
                    <span style={{ color: "rgba(255,255,255,.78)" }}>
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
export function OceansViewIntro({
  props,
  asset,
  ctx,
}: {
  props: P<"intro">;
  asset?: SiteAssetResolver;
  ctx?: OceansViewCtx;
}) {
  const eyebrow = props.eyebrow;
  const heading = props.heading || "Barefoot luxury, on the bay";
  const body = props.body || "";

  if (props.variant === "centered") {
    return (
      <section className="section" data-section="intro">
        <div className="wrap wrap-read" style={{ textAlign: "center" }}>
          {eyebrow ? <span className="tag">{eyebrow}</span> : null}
          <h2 className="lg" style={{ marginTop: 12 }}>
            {heading}
          </h2>
          {body ? (
            <p
              className="muted"
              style={{
                marginTop: 16,
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
        <div className="split w-left">
          <div>
            {eyebrow ? <span className="tag">{eyebrow}</span> : null}
            <h2 className="lg" style={{ marginTop: 18 }}>
              {heading}
            </h2>
            {body ? (
              <p
                className="lead"
                style={{ marginTop: 22, whiteSpace: "pre-line" }}
              >
                {body}
              </p>
            ) : null}
            {ctx?.aboutHref && props.variant === "lead" ? (
              <a
                href={ctx.aboutHref}
                className="alink"
                style={{ marginTop: 30, display: "inline-flex" }}
              >
                Read our story {ARROW}
              </a>
            ) : null}
          </div>
          <div className="frame-wrap">
            <div className="frame ar-45">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(props.image_path, asset, IMG.intro)} alt="" />
            </div>
            {props.badge_value ? (
              <div className="float-badge">
                <b>{props.badge_value}</b>
                {props.badge_label ? <span>{props.badge_label}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── HIGHLIGHTS (icon tiles OR image experience cards) ──────────────── */
export function OceansViewHighlights({
  props,
  asset,
}: {
  props: P<"highlights">;
  asset?: SiteAssetResolver;
}) {
  const raw =
    props.items && props.items.length
      ? props.items
      : STOCK_TILES.map((t) => ({
          ...t,
          icon: undefined,
          image_path: undefined,
        }));
  // When the items carry images, render the design's big IMAGE experience cards
  // (.exps) — the Experiences page; otherwise the icon tiles (the home band).
  const hasImages = raw.some((it) => it.image_path?.trim());

  if (hasImages) {
    const cards = raw.map((it, i) => ({
      title: it.title || STOCK_TILES[i]?.title || "",
      body: it.body || STOCK_TILES[i]?.body || "",
      img: img(it.image_path, asset, STOCK_GALLERY[i % STOCK_GALLERY.length]),
    }));
    return (
      <section className="section sand" data-section="highlights">
        <div className="wrap">
          <div className="sec-head center">
            {props.eyebrow ? (
              <span className="tag">{props.eyebrow}</span>
            ) : null}
            <h2 className="lg">{props.heading || "Things to do"}</h2>
          </div>
          <div className="exps">
            {cards.map((e, i) => (
              <div key={e.title + i} className="exp">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.img} alt={e.title} />
                <div className="exp-b">
                  <h3>{e.title}</h3>
                  {e.body ? <p>{e.body}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const items = raw.map((it, i) => ({
    icon: it.icon,
    title: it.title || STOCK_TILES[i]?.title || "",
    body: it.body || STOCK_TILES[i]?.body || "",
  }));
  return (
    <section className="section sand" data-section="highlights">
      <div className="wrap">
        <div className="sec-head center">
          {props.eyebrow ? <span className="tag">{props.eyebrow}</span> : null}
          <h2 className="lg">{props.heading || "Everything taken care of"}</h2>
        </div>
        <div className="tiles">
          {items.map((e, i) => (
            <div key={e.title + i} className="tile">
              <div className="ic">{tileIcon(e.icon)}</div>
              <h3>{e.title}</h3>
              <p>{e.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── STATS ──────────────────────────────────────────────────────────── */
export function OceansViewStats({ props }: { props: P<"stats"> }) {
  const items = (props.items ?? []).filter((s) => s.value?.trim());
  if (!items.length) return null;
  return (
    <section className="section-sm sand" data-section="stats" data-live="true">
      <div className="wrap">
        <div className="stats">
          {items.map((s, i) => (
            <div key={s.value + i} className="stat">
              <b>{s.value}</b>
              {s.label ? <span>{s.label}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── ROOMS PREVIEW ──────────────────────────────────────────────────── */
export function OceansViewRooms({
  props,
  data,
  ctx,
}: {
  props: P<"rooms_preview">;
  data?: RoomsPreviewData;
  ctx?: OceansViewCtx;
}) {
  const roomsHref = ctx?.roomsHref || "#rooms";
  const real = data?.rooms ?? [];
  const max = props.max ?? (props.display === "showcase" ? 8 : 6);
  const rooms = real.length
    ? real.slice(0, max).map((r, i) => ({
        tag: r.badge || r.facts?.[0] || STOCK_ROOMS[i % 3]?.tag || "",
        name: r.name,
        meta: (r.facts ?? STOCK_ROOMS[i % 3]?.meta ?? []).slice(0, 3),
        desc: r.description || STOCK_ROOMS[i % 3]?.desc || "",
        price:
          r.price != null
            ? `R${Number(r.price).toLocaleString("en-ZA")}`
            : (STOCK_ROOMS[i % 3]?.price ?? ""),
        img: r.imageUrl || STOCK_ROOMS[i % 3]?.img || IMG.room1,
        href: r.detailHref || r.bookHref || roomsHref,
      }))
    : STOCK_ROOMS.map((s) => ({ ...s, href: roomsHref }));

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
            {props.eyebrow ? (
              <span className="tag">{props.eyebrow}</span>
            ) : null}
            <h2 className="lg" style={{ marginTop: 12 }}>
              {props.heading || "Rooms that face the water"}
            </h2>
          </div>
          <a href={roomsHref} className="alink">
            {props.ctaLabel || "All rooms & rates"} {ARROW}
          </a>
        </div>
        <div className="rooms">
          {rooms.map((s, i) => (
            <a key={s.name + i} href={s.href} className="room">
              <div className="room-img">
                {s.price ? (
                  <span className="room-price">
                    {s.price}
                    <small> / night</small>
                  </span>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={s.name} />
              </div>
              <div className="room-body">
                <h3>{s.name}</h3>
                {s.meta.length ? (
                  <div className="room-feat">
                    {s.meta.map((m, j) => (
                      <span key={m + j} className="chip">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : null}
                {s.desc ? <p>{s.desc}</p> : null}
                <div className="room-foot">
                  <span className="alink">View room {ARROW}</span>
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
export function OceansViewGallery({
  props,
  data,
}: {
  props: P<"gallery">;
  data?: GalleryData;
}) {
  const imgs = data?.images?.length
    ? data.images.slice(0, 7).map((g) => g.url)
    : STOCK_GALLERY;
  const cls = ["m w2 h2", "m", "m", "m", "m", "m w2", "m"];
  return (
    <section className="section sand" data-section="gallery" data-live="true">
      <div className="wrap">
        <div className="sec-head center">
          {props.eyebrow ? <span className="tag">{props.eyebrow}</span> : null}
          <h2 className="lg">{props.heading || "Postcards from the bay"}</h2>
        </div>
        <div className="mosaic">
          {imgs.map((src, i) => (
            <div key={src + i} className={cls[i] ?? "m"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── REVIEWS (navy band) ────────────────────────────────────────────── */
export function OceansViewReviews({
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
        loc: r.date ?? "",
      }))
    : STOCK_REVIEWS;
  const avg = data?.average != null ? data.average.toFixed(1) : "4.9";
  const count = data?.count != null ? data.count : 900;
  return (
    <section className="section navy" data-section="reviews" data-live="true">
      <div className="wrap">
        <div
          className="sec-head"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "none",
            gap: 28,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <span className="tag">{props.eyebrow || "Guest reviews"}</span>
            <h2 className="lg" style={{ marginTop: 12 }}>
              {props.heading || "The reviews say it best"}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                fontFamily: "var(--site-font-heading)",
                fontWeight: 800,
                fontSize: "clamp(2.8rem,6vw,4rem)",
                color: "var(--site-accent)",
                lineHeight: 1,
              }}
            >
              {avg}
            </div>
            <div>
              <div className="stars" style={{ fontSize: 16 }}>
                ★★★★★
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                {props.subheading || `${count}+ verified stays`}
              </p>
            </div>
          </div>
        </div>
        <div className="quotes">
          {reviews.map((r, i) => (
            <div key={r.initials + i} className="quote">
              <span className="qm">&ldquo;</span>
              <p>{r.quote}</p>
              <div className="who">
                <span className="av">{r.initials}</span>
                <div>
                  <div className="nm">{r.name}</div>
                  <div className="loc">{r.loc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── LOCATION (copy + map) ──────────────────────────────────────────── */
export function OceansViewLocation({
  props,
  ctx,
}: {
  props: P<"location">;
  ctx?: OceansViewCtx;
}) {
  const tag = props.heading?.trim() || "Find us";
  return (
    <section className="section" data-section="location" data-live="true">
      <div className="wrap">
        <div className="cgrid">
          <div>
            <span className="tag">{props.eyebrow || "Getting here"}</span>
            <h2 className="lg" style={{ marginTop: 12 }}>
              {props.heading || "Right on the bay"}
            </h2>
            <p className="muted" style={{ marginTop: 18, maxWidth: "46ch" }}>
              {props.body ||
                "We sit right on the beachfront, a short drive from the city. Full directions and parking details follow your booking."}
            </p>
            {ctx?.contactHref ? (
              <a
                href={ctx.contactHref}
                className="alink"
                style={{ marginTop: 26, display: "inline-flex" }}
              >
                Directions &amp; parking {ARROW}
              </a>
            ) : null}
          </div>
          <div className="mapph">
            <span className="mappin" />
            <div className="maptag">📍 {tag}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── MAP ────────────────────────────────────────────────────────────── */
export function OceansViewMap({ props }: { props: P<"map"> }) {
  const tag = props.caption?.trim() || props.address?.trim() || "Find us";
  return (
    <section className="section-sm" data-section="map">
      <div className="wrap">
        <div className="mapph">
          <span className="mappin" />
          <div className="maptag">📍 {tag}</div>
        </div>
      </div>
    </section>
  );
}

/* ── CTA (banner) ───────────────────────────────────────────────────── */
export function OceansViewCta({
  props,
  asset,
  ctx,
}: {
  props: P<"cta">;
  asset?: SiteAssetResolver;
  ctx?: OceansViewCtx;
}) {
  const reserve =
    props.button_href?.trim() || ctx?.reserveHref || ctx?.roomsHref || "#rooms";

  if (props.newsletter) {
    return (
      <section className="section" data-section="cta">
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(props.image_path, asset, IMG.hero)} alt="" />
            <div className="banner-in">
              <h2>{props.heading || "The bay, in your inbox"}</h2>
              <p>
                {props.body ||
                  "Open dates, recipes and the occasional secret spot — once a season, never more."}
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
                <button className="btn btn-white btn-sm" type="button">
                  <span>{props.button_label || "Subscribe"}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section" data-section="cta">
      <div className="wrap">
        <div className="banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(props.image_path, asset, IMG.hero)} alt="" />
          <div className="banner-in">
            <h2>{props.heading || "Your room by the sea is waiting"}</h2>
            <p>
              {props.body ||
                "Book direct for the best rate and a free upgrade when we can — we will take care of the rest."}
            </p>
            <div className="hero-cta" style={{ justifyContent: "center" }}>
              <a href={reserve} className="btn btn-white btn-lg">
                <span>{props.button_label || "Book a room"}</span>
              </a>
              {ctx?.contactHref ? (
                <a href={ctx.contactHref} className="btn btn-on-img btn-lg">
                  <span>Ask us anything</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── HOST BIO ───────────────────────────────────────────────────────── */
export function OceansViewHostBio({
  props,
  asset,
}: {
  props: P<"host_bio">;
  asset?: SiteAssetResolver;
}) {
  const reversed = props.reverse === true;
  return (
    <section className="section sand" data-section="host_bio">
      <div className="wrap">
        <div className="split w-left">
          <div style={reversed ? { order: 2 } : undefined}>
            <span className="tag">{props.heading || "Your hosts"}</span>
            {props.name ? (
              <h2 className="lg" style={{ marginTop: 12 }}>
                {props.name}
              </h2>
            ) : null}
            {props.body ? (
              <p
                className="lead"
                style={{ marginTop: 18, whiteSpace: "pre-line" }}
              >
                {props.body}
              </p>
            ) : null}
            {props.points && props.points.length ? (
              <div className="amen" style={{ marginTop: 24 }}>
                {props.points.map((p, i) =>
                  p.text?.trim() ? (
                    <div key={p.text + i} className="a">
                      {CHECK}
                      {p.text}
                    </div>
                  ) : null,
                )}
              </div>
            ) : null}
          </div>
          <div className="frame-wrap">
            <div className="frame ar-45">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(props.photo_path, asset, IMG.host)} alt="" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── VALUES ─────────────────────────────────────────────────────────── */
export function OceansViewValues({ props }: { props: P<"values"> }) {
  const items = (props.items ?? []).filter((v) => v.title?.trim());
  if (!items.length) return null;
  return (
    <section className="section" data-section="values">
      <div className="wrap">
        <div className="sec-head center">
          <h2 className="lg">{props.heading || "What we stand for"}</h2>
        </div>
        <div className="tiles">
          {items.map((v, i) => (
            <div key={v.title + i} className="tile">
              <div
                className="ic"
                style={{
                  fontFamily: "var(--site-font-heading)",
                  fontWeight: 800,
                }}
              >
                {`0${i + 1}`}
              </div>
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
export function OceansViewFaq({ props }: { props: P<"faq"> }) {
  const items = (props.items ?? []).filter((f) => f.q?.trim());
  if (!items.length) return null;
  return (
    <section className="section sand" data-section="faq">
      <div className="wrap wrap-read">
        <div className="sec-head center">
          {props.eyebrow ? <span className="tag">{props.eyebrow}</span> : null}
          <h2 className="lg">{props.heading || "Good to know"}</h2>
        </div>
        <div style={{ marginTop: 18 }}>
          {items.map((f, i) => (
            <details key={f.q + i} className="faq" open={i === 0}>
              <summary>
                {f.q}
                <span className="pm" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              {f.a ? <p>{f.a}</p> : null}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── AMENITIES ──────────────────────────────────────────────────────── */
export function OceansViewAmenities({ props }: { props: P<"amenities"> }) {
  const items = (props.items ?? []).filter((a) => a.label?.trim());
  if (!items.length) return null;

  // Inline "included" band — a simple row of ticked chips.
  if (props.variant === "inline") {
    return (
      <section className="section-sm" data-section="amenities">
        <div className="wrap">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px 28px",
              justifyContent: "center",
            }}
          >
            {items.map((a, i) => (
              <span
                key={a.label + i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  fontWeight: 600,
                  color: "var(--site-ink)",
                }}
              >
                <span style={{ color: "var(--site-accent)" }}>{CHECK}</span>
                {a.label}
              </span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section" data-section="amenities">
      <div className="wrap">
        {props.heading ? (
          <div className="sec-head center">
            <h2 className="lg">{props.heading}</h2>
          </div>
        ) : null}
        <div className="tiles">
          {items.map((a, i) => (
            <div key={a.label + i} className="tile">
              <div className="ic">
                {a.icon?.trim() ? (
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{a.icon}</span>
                ) : (
                  tileIcon(null)
                )}
              </div>
              <h3>{a.label}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── PRICING / RATES ────────────────────────────────────────────────── */
export function OceansViewPricing({ props }: { props: P<"pricing"> }) {
  const items = (props.items ?? []).filter((r) => r.label?.trim());
  return (
    <section className="section" data-section="pricing">
      <div className="wrap wrap-read">
        {props.heading ? (
          <div className="sec-head center">
            <h2 className="lg">{props.heading}</h2>
          </div>
        ) : null}
        <div
          style={{
            marginTop: 28,
            border: "1px solid var(--site-line)",
            borderRadius: "var(--site-radius-lg)",
            overflow: "hidden",
            background: "var(--site-surface)",
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
                <div style={{ fontWeight: 700, color: "var(--site-ink)" }}>
                  {r.label}
                </div>
                {r.note ? (
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                    {r.note}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  fontFamily: "var(--site-font-heading)",
                  fontWeight: 800,
                  fontSize: "1.4rem",
                  color: "var(--site-ink)",
                  whiteSpace: "nowrap",
                }}
              >
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

/* ── SPECIALS ───────────────────────────────────────────────────────── */
const STOCK_SPECIALS = [
  {
    badge: "Stay 4, pay 3",
    left: "4 rooms left",
    title: "The long weekend",
    desc: "Book four nights or more on a single stay and the fourth is on the house — any room, any season.",
    now: "R11,700",
    was: "R15,600",
    save: "1 night free",
    img: IMG.room1,
  },
  {
    badge: "Sun–Thu",
    left: "Any room",
    title: "Midweek by the sea",
    desc: "Arrive Sunday to Thursday and take 15% off the nightly rate, with a slow checkout until 2pm.",
    now: "R5,780",
    was: "R6,800",
    save: "Save 15%",
    img: IMG.room2,
  },
  {
    badge: "Last minute",
    left: "2 dates left",
    title: "Within-7-days rate",
    desc: "Plans came together late? Take 20% off any available room for arrivals inside the next week.",
    now: "R10,800",
    was: "R13,500",
    save: "Save 20%",
    img: IMG.room3,
  },
];

export function OceansViewSpecials({ data }: { data?: SpecialsPreviewData }) {
  const real = data?.specials ?? [];
  const cards = real.length
    ? real.map((s) => {
        const now = rand(s.price, s.currency);
        const was = s.wasPrice != null ? rand(s.wasPrice, s.currency) : "";
        const save =
          s.savingsPct != null
            ? `Save ${s.savingsPct}%`
            : s.savingsAmount != null
              ? `Save ${rand(s.savingsAmount, s.currency)}`
              : "";
        return {
          badge: s.badge || "Special",
          left:
            s.remaining != null && s.remaining > 0 ? `${s.remaining} left` : "",
          title: s.title,
          desc: s.description || "",
          now: now + (s.priceMode === "per_night" ? " /night" : ""),
          was,
          save,
          img: s.imageUrl || IMG.room1,
          href: s.bookHref,
        };
      })
    : STOCK_SPECIALS.map((s) => ({ ...s, href: "#book" }));

  return (
    <section
      className="section"
      data-section="specials_preview"
      data-live="true"
    >
      <div className="wrap">
        <div className="spx">
          {cards.map((s, i) => (
            <article key={s.title + i} className="spcard">
              <div className="spi">
                {s.badge ? <span className="sp-badge">{s.badge}</span> : null}
                {s.left ? <span className="sp-left">{s.left}</span> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={s.title} />
              </div>
              <div className="spb">
                <h3>{s.title}</h3>
                {s.desc ? <p className="spd">{s.desc}</p> : null}
                <div className="sp-px">
                  {s.now ? <span className="sp-now">{s.now}</span> : null}
                  {s.was ? <span className="sp-was">{s.was}</span> : null}
                  {s.save ? <span className="sp-save">{s.save}</span> : null}
                </div>
                <a href={s.href} className="btn btn-primary btn-block">
                  <span>Book this offer</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── BLOG PREVIEW ───────────────────────────────────────────────────── */
export function OceansViewBlogPreview({
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
            style={{ paddingBottom: "clamp(36px,5vw,56px)" }}
          >
            <div className="wrap">
              <a href={featured.href || "#"} className="feat-post">
                <div className="fp-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featured.coverUrl || STOCK_GALLERY[0]}
                    alt={featured.title}
                  />
                </div>
                <div>
                  <span className="pcat">Featured</span>
                  <h2 className="lg" style={{ marginTop: 14 }}>
                    {featured.title}
                  </h2>
                  {featured.excerpt ? (
                    <p className="lead" style={{ marginTop: 18 }}>
                      {featured.excerpt}
                    </p>
                  ) : null}
                  {featured.date ? (
                    <div className="pmeta">
                      <span>{featured.date}</span>
                    </div>
                  ) : null}
                  <span
                    className="alink"
                    style={{ marginTop: 24, display: "inline-flex" }}
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
            style={{ paddingTop: "clamp(16px,3vw,36px)" }}
          >
            <div className="wrap">
              <div className="posts">
                {rest.map((post, i) => (
                  <a
                    key={post.href + i}
                    href={post.href || "#"}
                    className="post"
                  >
                    <div className="p-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          post.coverUrl ||
                          STOCK_GALLERY[(i + 1) % STOCK_GALLERY.length]
                        }
                        alt={post.title}
                      />
                    </div>
                    <span className="pcat">Journal</span>
                    <h3>{post.title}</h3>
                    {post.excerpt ? <p>{post.excerpt}</p> : null}
                    {post.date ? (
                      <div className="pmeta">
                        <span>{post.date}</span>
                      </div>
                    ) : null}
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
          {props.eyebrow ? <span className="tag">{props.eyebrow}</span> : null}
          <h2 className="lg">{props.heading || "From the journal"}</h2>
        </div>
        <div className="posts">
          {posts.map((post, i) => (
            <a key={post.href + i} href={post.href || "#"} className="post">
              <div className="p-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.coverUrl || STOCK_GALLERY[i % STOCK_GALLERY.length]}
                  alt={post.title}
                />
              </div>
              <span className="pcat">Journal</span>
              <h3>{post.title}</h3>
              {post.excerpt ? <p>{post.excerpt}</p> : null}
              {post.date ? (
                <div className="pmeta">
                  <span>{post.date}</span>
                </div>
              ) : null}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── ROOM DETAIL bands ──────────────────────────────────────────────── */
function OceansViewRoomPlaceholder({ label }: { label: string }) {
  return (
    <section className="section">
      <div className="wrap">
        <div
          style={{
            border: "1px dashed var(--site-line)",
            borderRadius: "var(--site-radius-lg)",
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

export function OceansViewRoomGallery({
  props,
  data,
}: {
  props: P<"room_gallery">;
  data?: RoomDetail;
}) {
  const images = (data?.images ?? []).slice(0, props.max ?? 12);
  if (!images.length)
    return (
      <OceansViewRoomPlaceholder label="This room's photos appear here." />
    );
  const three = images.slice(0, 3);
  return (
    <section className="wrap" data-section="room_gallery" data-live="true">
      <div className="rgal">
        {three.map((im, i) => (
          <div key={im.url + i} className={i === 0 ? "g main" : "g"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={im.alt || data?.name || ""} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function OceansViewRoomOverview({
  props,
  data,
}: {
  props: P<"room_overview">;
  data?: RoomDetail;
}) {
  if (!data)
    return (
      <OceansViewRoomPlaceholder label="The room's name and details appear here." />
    );
  const title = props.heading?.trim() || data.name;
  const facts = props.show_facts !== false ? data.facts : [];
  const price =
    props.show_price !== false ? rand(data.price, data.currency) : "";
  return (
    <section
      className="section"
      data-section="room_overview"
      data-live="true"
      style={{ paddingTop: "clamp(44px,6vw,64px)" }}
    >
      <div className="wrap">
        <div className="rlayout">
          <div>
            {data.facts?.[0] ? (
              <span className="tag">{data.facts[0]}</span>
            ) : null}
            <h1 className="xl" style={{ marginTop: 10 }}>
              {title}
            </h1>
            {facts.length ? (
              <div className="specs">
                {facts.slice(0, 4).map((f, i) => (
                  <div key={f + i} className="spec">
                    <b>{f.split(/\s+/)[0]}</b>
                    <span>{f.split(/\s+/).slice(1).join(" ") || " "}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {data.description ? (
              <p
                className="lead"
                style={{ whiteSpace: "pre-line", maxWidth: "60ch" }}
              >
                {data.description}
              </p>
            ) : (
              <p className="lead" style={{ maxWidth: "60ch" }}>
                A bright room facing the water, with space to slow down between
                swims.
              </p>
            )}
          </div>
          <aside className="bkcard">
            {price ? (
              <div className="bkrate">
                <span className="amt">{price}</span>
                <span className="muted"> / night</span>
              </div>
            ) : null}
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Includes breakfast, pool &amp; beach access.
            </p>
            <a href={data.bookHref} className="btn btn-coral btn-lg btn-block">
              <span>Check availability</span>
            </a>
            <div
              className="nofee"
              style={{ justifyContent: "center", marginTop: 14 }}
            >
              {CHECK} Book direct · 0% fees
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function OceansViewRoomAmenities({
  props,
  data,
}: {
  props: P<"room_amenities">;
  data?: RoomDetail;
}) {
  const amenities = data?.amenities ?? [];
  if (!amenities.length)
    return (
      <OceansViewRoomPlaceholder label="This room's amenities appear here." />
    );
  return (
    <section className="section sand" data-section="room_amenities">
      <div className="wrap">
        <h2 className="lg">{props.heading || "In this room"}</h2>
        <div
          className="amen"
          style={
            props.variant === "list"
              ? { gridTemplateColumns: "1fr", marginTop: 24 }
              : { marginTop: 24 }
          }
        >
          {amenities.map((a, i) => (
            <div key={a.label + i} className="a">
              {CHECK}
              {a.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OceansViewRoomRate({
  props,
  data,
}: {
  props: P<"room_rate">;
  data?: RoomDetail;
}) {
  if (!data)
    return (
      <OceansViewRoomPlaceholder label="The room's rate and booking button appear here." />
    );
  const price = rand(data.price, data.currency);
  return (
    <section className="section-sm" data-section="room_rate">
      <div className="wrap wrap-read">
        <div
          style={{
            border: "1px solid var(--site-line)",
            borderRadius: "var(--site-radius-lg)",
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
                style={{
                  fontFamily: "var(--site-font-heading)",
                  fontWeight: 800,
                  fontSize: "2rem",
                  color: "var(--site-ink)",
                  marginTop: props.heading ? 6 : 0,
                }}
              >
                {price}
                <span className="muted" style={{ fontSize: 14, marginLeft: 8 }}>
                  / night
                </span>
              </div>
            ) : null}
            {props.note ? (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {props.note}
              </p>
            ) : null}
          </div>
          <a href={data.bookHref} className="btn btn-coral btn-lg">
            <span>{props.cta_label?.trim() || "Book this room"}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── ROOM / PROPERTY POLICIES ───────────────────────────────────────── */
function OceansViewPolicyView({
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
      <div className="wrap wrap-read">
        <span className="tag">Good to know</span>
        <h2 className="lg" style={{ marginTop: 12 }}>
          {heading || "Things to know"}
        </h2>
        <div
          style={{
            marginTop: 26,
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
              marginTop: 26,
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

export function OceansViewRoomPolicies({
  props,
  data,
}: {
  props: P<"room_policies">;
  data?: RoomDetail;
}) {
  const p = data?.policies;
  if (!p)
    return (
      <OceansViewRoomPlaceholder label="This room's cancellation policy and house rules appear here." />
    );
  return <OceansViewPolicyView heading={props.heading} policies={p} />;
}

export function OceansViewPolicies({
  props,
  data,
}: {
  props: P<"policies">;
  data?: RoomPolicies;
}) {
  if (!data) return null;
  return <OceansViewPolicyView heading={props.heading} policies={data} />;
}

/* ── RATE TABLE ─────────────────────────────────────────────────────── */
export function OceansViewRateTable({
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
      <div className="wrap wrap-read">
        {props.heading ? (
          <div className="sec-head center">
            <h2 className="lg">{props.heading}</h2>
          </div>
        ) : null}
        <div
          style={{
            marginTop: 28,
            border: "1px solid var(--site-line)",
            borderRadius: "var(--site-radius-lg)",
            overflow: "hidden",
            background: "var(--site-surface)",
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
                <div style={{ fontWeight: 700, color: "var(--site-ink)" }}>
                  {r.name}
                </div>
                {r.propertyName ? (
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                    {r.propertyName}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span
                  style={{
                    fontFamily: "var(--site-font-heading)",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.nightlyFrom != null
                    ? rand(r.nightlyFrom, r.currency)
                    : "—"}
                  <small className="muted"> / night</small>
                </span>
                <a href={r.bookHref} className="btn btn-coral btn-sm">
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
function renderOceansViewGenericFallback(
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

export function renderOceansViewSection(
  section: WebsiteSection,
  opts: {
    data?: SiteData;
    asset?: SiteAssetResolver;
    ctx?: OceansViewCtx;
    websiteId?: string;
    interactive?: boolean;
  },
): ReactNode | undefined {
  const { data, asset, ctx, websiteId, interactive } = opts;
  switch (section.type) {
    case "hero":
      return <OceansViewHero props={section.props} asset={asset} ctx={ctx} />;
    case "intro":
      return <OceansViewIntro props={section.props} asset={asset} ctx={ctx} />;
    case "highlights":
      return <OceansViewHighlights props={section.props} asset={asset} />;
    case "rooms_preview":
      return (
        <OceansViewRooms
          props={section.props}
          data={dataFor(data, section.id, "rooms_preview")}
          ctx={ctx}
        />
      );
    case "gallery":
      return (
        <OceansViewGallery
          props={section.props}
          data={dataFor(data, section.id, "gallery")}
        />
      );
    case "reviews":
      return (
        <OceansViewReviews
          props={section.props}
          data={dataFor(data, section.id, "reviews")}
        />
      );
    case "location":
      return <OceansViewLocation props={section.props} ctx={ctx} />;
    case "cta":
      return <OceansViewCta props={section.props} asset={asset} ctx={ctx} />;
    case "host_bio":
      return <OceansViewHostBio props={section.props} asset={asset} />;
    case "stats":
      return <OceansViewStats props={section.props} />;
    case "values":
      return <OceansViewValues props={section.props} />;
    case "map":
      return <OceansViewMap props={section.props} />;
    case "contact_form":
      return (
        <OceansViewContactForm
          props={section.props}
          ctx={ctx}
          websiteId={websiteId}
          interactive={interactive}
        />
      );
    case "form":
      return (
        <section className="section" data-section="form">
          <div className="wrap wrap-read">
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
      return <OceansViewFaq props={section.props} />;
    case "amenities":
      return <OceansViewAmenities props={section.props} />;
    case "pricing":
      return <OceansViewPricing props={section.props} />;
    case "blog_preview":
      return (
        <OceansViewBlogPreview
          props={section.props}
          data={dataFor(data, section.id, "blog_preview")}
        />
      );
    case "specials_preview":
      return (
        <OceansViewSpecials
          data={dataFor(data, section.id, "specials_preview")}
        />
      );
    case "room_gallery":
      return (
        <OceansViewRoomGallery
          props={section.props}
          data={dataFor(data, section.id, "room_gallery")}
        />
      );
    case "room_overview":
      return (
        <OceansViewRoomOverview
          props={section.props}
          data={dataFor(data, section.id, "room_overview")}
        />
      );
    case "room_amenities":
      return (
        <OceansViewRoomAmenities
          props={section.props}
          data={dataFor(data, section.id, "room_amenities")}
        />
      );
    case "room_rate":
      return (
        <OceansViewRoomRate
          props={section.props}
          data={dataFor(data, section.id, "room_rate")}
        />
      );
    case "room_policies":
      return (
        <OceansViewRoomPolicies
          props={section.props}
          data={dataFor(data, section.id, "room_policies")}
        />
      );
    case "policies":
      return (
        <OceansViewPolicies
          props={section.props}
          data={dataFor(data, section.id, "policies")}
        />
      );
    case "rate_table":
      return (
        <OceansViewRateTable
          props={section.props}
          data={dataFor(data, section.id, "rate_table")}
        />
      );
    default:
      return undefined;
  }
}

function hasOverrideProps(o?: { props?: Record<string, unknown> }): boolean {
  return !!o?.props && Object.keys(o.props).length > 0;
}

function withProps(
  s: WebsiteSection,
  override?: Record<string, unknown>,
): WebsiteSection {
  if (!override || Object.keys(override).length === 0) return s;
  return { ...s, props: { ...s.props, ...override } } as WebsiteSection;
}

export function OceansViewSectionList({
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
  ctx?: OceansViewCtx;
  websiteId?: string;
  interactive?: boolean;
}) {
  const render = (s: WebsiteSection) => {
    const ov = renderOceansViewSection(s, {
      data,
      asset,
      ctx,
      websiteId,
      interactive,
    });
    if (ov !== undefined) return ov;
    return renderOceansViewGenericFallback(s, { data, asset, interactive });
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
