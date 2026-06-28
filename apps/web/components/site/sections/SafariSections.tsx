import { Fragment, type CSSProperties, type ReactNode } from "react";

import { siteImageUrl } from "@/lib/site/image";
import {
  dataFor,
  type RoomsPreviewData,
  type GalleryData,
  type ReviewsData,
  type BlogPreviewData,
  type RoomDetail,
  type RateTableData,
  type SiteAssetResolver,
  type SiteData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { FormSection } from "./FormSection";
import { SafariContactForm } from "./SafariContactForm";
import { ColumnsSection, FlexSection } from "./ColumnsSection";
import {
  ElButtonSection,
  ElDividerSection,
  ElHeadingSection,
  ElImageSection,
  ElSpacerSection,
  ElTextSection,
} from "./Elements";

/**
 * The NenGama Lodge ("safari" theme) home page, broken into per-section,
 * host-editable components — the SAME flat sections the builder already knows,
 * rendered in the bespoke Safari design instead of the generic look. The
 * SectionRenderer dispatches here (via `renderSafariSection`) when the active
 * theme is safari, so the builder canvas and the public site render identically
 * (true WYSIWYG) and every band is editable + reorderable like any other block.
 *
 * Content comes from the host's section props; imagery falls back to the
 * design's stock so a fresh Safari site looks exactly like the example out of
 * the box, and the suites grid binds to the host's REAL rooms when present.
 */

type P<T extends WebsiteSection["type"]> = Extract<
  WebsiteSection,
  { type: T }
>["props"];

/** Per-device responsive overrides (Desktop/Laptop/Mobile tabs), shared by every
 *  section via the schema's sectionBase. */
export type SectionResponsive = WebsiteSection["responsive"];

/** Cross-page links + brand used by the bands (hero/intro/cta/location). The
 *  builder canvas renders sections in isolation (links inert), so every field
 *  is optional with a sensible fallback. */
export interface SafariCtx {
  brandName?: string;
  homeHref?: string;
  roomsHref?: string;
  aboutHref?: string;
  contactHref?: string;
  reserveHref?: string;
  /** Host contact details for the contact band's detail card (real, not stock). */
  contactEmail?: string | null;
  contactPhone?: string | null;
}

const IMG = {
  hero: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2400&q=80",
  intro:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80",
  exp1: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=1200&q=80",
  exp2: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1000&q=80",
  exp3: "https://images.unsplash.com/photo-1504675099198-7023dd85f5a3?w=1000&q=80",
  suite1:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80",
  suite2:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80",
  suite3:
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&q=80",
  g1: "https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=1200&q=80",
  g2: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=700&q=80",
  g3: "https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=700&q=80",
  g4: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=700&q=80",
  g5: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700&q=80",
  g6: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
  g7: "https://images.unsplash.com/photo-1502920514313-52581002a659?w=700&q=80",
  location:
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1100&q=80",
  cta: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=2000&q=80",
};

const STOCK_EXP = [
  {
    n: "01",
    title: "Game drives",
    body: "Twice daily in open Land Cruisers, tracking lion, elephant, leopard and the wide cast of the bushveld with rangers who grew up reading this land.",
    img: IMG.exp1,
  },
  {
    n: "02",
    title: "Walking safaris",
    body: "Step down from the vehicle and into the detail — tracks, scent, the small architecture of the bush — with an armed guide at your shoulder.",
    img: IMG.exp2,
  },
  {
    n: "03",
    title: "Boma dining",
    body: "Long tables, open coals and Limpopo wines under a sky thick with stars. Dinner here can run well past the last log.",
    img: IMG.exp3,
  },
];

const STOCK_SUITES = [
  {
    tag: "Sleeps 2 · Flagship",
    name: "Marula Suite",
    meta: ["Private plunge pool", "Waterhole deck"],
    desc: "The flagship — a glass-walled retreat above the waterhole with an outdoor bath and a deck made for doing nothing at all.",
    price: "R14,500",
    img: IMG.suite1,
  },
  {
    tag: "Sleeps 4 · Family",
    name: "Tamboti Suite",
    meta: ["Two bedrooms", "Private guide"],
    desc: "Two connected rooms under a single thatch, with a shaded family deck and a dedicated ranger for your stay.",
    price: "R18,900",
    img: IMG.suite2,
  },
  {
    tag: "Sleeps 2 · Tented",
    name: "Leadwood Tent",
    meta: ["Canvas & teak", "Star bed"],
    desc: "A canvas-and-teak tented suite set apart on the ridge, with a roll-back roof and a star bed for clear Waterberg nights.",
    price: "R11,500",
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
      "The Marula Suite ruins you for ordinary hotels. Bath open to the bush, elephants at the waterhole over breakfast. Faultless.",
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

// Default hero stat row — shown until the host edits/hides it.
const STOCK_HERO_STATS = [
  { value: "12,000", label: "Hectares" },
  { value: "Big Five", label: "Free-roaming" },
  { value: "4.98 ★★★★★", label: "214 guest stays" },
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

/* ── HERO ───────────────────────────────────────────────────────────── */
export function SafariHero({
  props,
  asset,
  ctx,
}: {
  props: P<"hero">;
  asset?: SiteAssetResolver;
  ctx?: SafariCtx;
}) {
  const roomsHref = ctx?.roomsHref || "#suites";
  const aboutHref = ctx?.aboutHref;

  // Compact "page header" banner for inner pages (About/Rooms/Contact) — a short
  // image band with a breadcrumb + title, instead of the full-screen home hero.
  if (props.compact) {
    return (
      <section className="page-head">
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
          <h1>{props.headline || "About us"}</h1>
          {props.subheadline ? <p>{props.subheadline}</p> : null}
        </div>
      </section>
    );
  }

  // Primary CTA — shown unless explicitly hidden; label falls back to the design.
  const showPrimary = props.show_cta !== false;
  const primaryLabel = props.cta_label || "Explore the suites";
  const primaryHref = props.cta_href?.trim() || roomsHref;

  // Secondary CTA — host-set label/href, or the legacy "Our story" → About link
  // for sites that haven't configured one yet. Hidden when show_cta2 === false.
  const secondaryLabel =
    props.cta2_label?.trim() || (aboutHref ? "Our story" : "");
  const secondaryHref = props.cta2_href?.trim() || aboutHref || "#";
  const showSecondary = props.show_cta2 !== false && secondaryLabel;

  // Stat row — host-editable; falls back to the design's stock stats. Hidden
  // entirely when show_stats === false.
  const stats =
    props.stats && props.stats.length
      ? props.stats.filter((s) => s.value?.trim())
      : STOCK_HERO_STATS;
  const showStats = props.show_stats !== false && stats.length > 0;

  // Alignment + button stacking. All per-device variation comes from the
  // responsive props override (the whole hero is re-rendered per breakpoint), so
  // the band just reads its own props.
  const alignClass =
    props.align === "center"
      ? " hero--center"
      : props.align === "right"
        ? " hero--right"
        : "";
  const stackClass = props.cta_stack ? " hero--stack" : "";

  return (
    <section className={`hero${alignClass}${stackClass}`}>
      <div className="hero-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img(props.image_path, asset, IMG.hero)} alt="" />
      </div>
      <div className="hero-inner">
        <div className="wrap">
          <span className="eyebrow">
            {props.eyebrow ||
              `${ctx?.brandName ? `${ctx.brandName} · ` : ""}Private Reserve`}
          </span>
          <h1>{props.headline || "Where the wild keeps its silence"}</h1>
          <p className="hero-sub">
            {props.subheadline ||
              "A luxury retreat set on twelve thousand unfenced hectares of bushveld. A handful of suites, a handful of guests, and a horizon that belongs to no one."}
          </p>
          {showPrimary || showSecondary ? (
            <div className="hero-cta">
              {showPrimary ? (
                <a href={primaryHref} className="btn btn-primary btn-lg">
                  <span>{primaryLabel}</span>
                </a>
              ) : null}
              {showSecondary ? (
                <a href={secondaryHref} className="btn btn-on-dark btn-lg">
                  <span>{secondaryLabel}</span>
                </a>
              ) : null}
            </div>
          ) : null}
          {showStats ? (
            <div className="hero-meta">
              {stats.map((s, i) => (
                <Fragment key={s.value + i}>
                  {i > 0 ? <div className="div" /> : null}
                  <div className="hm">
                    <b>{s.value}</b>
                    {s.label ? <span>{s.label}</span> : null}
                  </div>
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ── INTRO (split wide-img) ─────────────────────────────────────────── */
export function SafariIntro({
  props,
  asset,
  ctx,
}: {
  props: P<"intro">;
  asset?: SiteAssetResolver;
  ctx?: SafariCtx;
}) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="split wide-img">
          <div>
            <span className="eyebrow">
              {props.eyebrow || "An unfenced wilderness"}
            </span>
            <h2
              className="display"
              style={{ marginTop: 24, fontSize: "clamp(2.2rem,4.4vw,3.6rem)" }}
            >
              {props.heading || "A house at the heart of the bush"}
            </h2>
            <p className="lead" style={{ marginTop: 26 }}>
              {props.body ||
                "The lodge sits where the plateau folds into open grassland — no fences, no neighbours, no schedule but the light. Built by hand from local stone and leadwood, low against the land so the wilderness reaches right up to the door."}
            </p>
            {ctx?.aboutHref ? (
              <div style={{ marginTop: 38 }}>
                <a href={ctx.aboutHref} className="link-u">
                  Read our story {ARROW}
                </a>
              </div>
            ) : null}
          </div>
          <div className="split-media">
            <div className="frame-img img-tall">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(props.image_path, asset, IMG.intro)} alt="" />
            </div>
            {props.show_badge !== false ? (
              <div className="stat-badge" style={{ right: -12, bottom: -24 }}>
                <b>{props.badge_value || "2009"}</b>
                <span>{props.badge_label || "Family-run since"}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── HIGHLIGHTS (experiences, dark band) ────────────────────────────── */
export function SafariHighlights({
  props,
  asset,
}: {
  props: P<"highlights">;
  asset?: SiteAssetResolver;
}) {
  const items =
    props.items && props.items.length
      ? props.items.map((it, i) => ({
          n: STOCK_EXP[i]?.n ?? `0${i + 1}`,
          title: it.title || STOCK_EXP[i]?.title || "",
          body: it.body || STOCK_EXP[i]?.body || "",
          img: img(it.image_path, asset, STOCK_EXP[i]?.img ?? IMG.exp1),
        }))
      : STOCK_EXP;
  return (
    <section className="section bg-dark">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{props.eyebrow || "Days here"}</span>
          <h2 className="display">
            {props.heading || "The reserve, unhurried"}
          </h2>
          <p className="lead">
            {props.subheading ||
              "Everything is included, and nothing is compulsory. Your ranger shapes each day around the weather, the wildlife and exactly how far you feel like going."}
          </p>
        </div>
        <div className="exp-grid">
          {items.map((e, i) => (
            <div key={e.title + i} className={i === 0 ? "exp tall" : "exp"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.img} alt="" />
              <div className="exp-body">
                <span className="n">{e.n}</span>
                <h3>{e.title}</h3>
                <p>{e.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── SUITES (rooms_preview → real rooms) ────────────────────────────── */
export function SafariSuites({
  props,
  data,
  ctx,
}: {
  props: P<"rooms_preview">;
  data?: RoomsPreviewData;
  ctx?: SafariCtx;
}) {
  const roomsHref = ctx?.roomsHref || "#suites";
  const reserveHref = ctx?.reserveHref || roomsHref;
  const real = data?.rooms ?? [];

  // "showcase" = the Suites page: each suite a full-width alternating split with
  // a price badge, an amenity grid (from the room's facts) and View/Reserve CTAs.
  if (props.display === "showcase") {
    const max = props.max ?? 6;
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
      <>
        {list.map((s, i) => {
          const reversed = i % 2 === 1;
          return (
            <section
              key={s.name + i}
              className={`section${reversed ? "bg-2" : ""}`}
              id={i === 0 ? "suites" : undefined}
            >
              <div className="wrap">
                <div className={`split wide-img${reversed ? "reverse" : ""}`}>
                  <div className="split-media">
                    <div className="frame-img img-wide">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.img} alt={s.name} />
                    </div>
                    {s.price ? (
                      <div
                        className="stat-badge"
                        style={
                          reversed
                            ? { left: "-12px", bottom: "-22px" }
                            : { right: "-12px", bottom: "-22px" }
                        }
                      >
                        <b>{s.price}</b>
                        <span>Per night, inclusive</span>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    {s.tag ? <span className="eyebrow">{s.tag}</span> : null}
                    <h2
                      className="display"
                      style={{
                        marginTop: 20,
                        fontSize: "clamp(2rem,4vw,3.2rem)",
                      }}
                    >
                      {s.name}
                    </h2>
                    {s.desc ? (
                      <p
                        className="muted"
                        style={{ marginTop: 22, maxWidth: "52ch" }}
                      >
                        {s.desc}
                      </p>
                    ) : null}
                    {s.facts.length ? (
                      <div className="amenity-grid" style={{ marginTop: 30 }}>
                        {s.facts.map((f, j) => (
                          <div key={f + j} className="amenity">
                            {CHECK_ICON}
                            {f}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div
                      style={{
                        marginTop: 36,
                        display: "flex",
                        gap: 14,
                        flexWrap: "wrap",
                      }}
                    >
                      <a href={s.detailHref} className="btn btn-ghost">
                        <span>View suite</span>
                      </a>
                      <a href={s.bookHref} className="btn btn-primary">
                        <span>
                          {s.price ? `Reserve · ${s.price}` : "Reserve"}
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </>
    );
  }

  const suites = real.length
    ? real.slice(0, 3).map((r, i) => ({
        tag: r.facts?.[0] || STOCK_SUITES[i]?.tag || "",
        name: r.name,
        meta: (r.facts ?? STOCK_SUITES[i]?.meta ?? []).slice(0, 2),
        desc: STOCK_SUITES[i]?.desc ?? "",
        price:
          r.price != null
            ? `R${Number(r.price).toLocaleString("en-ZA")}`
            : (STOCK_SUITES[i]?.price ?? ""),
        img: r.imageUrl || STOCK_SUITES[i]?.img || IMG.suite1,
        href: r.detailHref || r.bookHref || roomsHref,
      }))
    : STOCK_SUITES.map((s) => ({ ...s, href: roomsHref }));

  return (
    <section className="section" id="suites">
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
            marginBottom: 48,
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <span className="eyebrow">
              {props.eyebrow || "Where you'll rest"}
            </span>
            <h2
              className="display"
              style={{ marginTop: 22, fontSize: "clamp(2.2rem,4.4vw,3.6rem)" }}
            >
              {props.heading || "Three suites, one horizon"}
            </h2>
          </div>
          <a href={roomsHref} className="link-u">
            {props.ctaLabel || "All suites & rates"} {ARROW}
          </a>
        </div>
        <div className="suites-grid">
          {suites.map((s, i) => (
            <a key={s.name + i} href={s.href} className="suite-card">
              <div className="sc-media">
                {s.tag ? <span className="sc-tag">{s.tag}</span> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={s.name} />
              </div>
              <div className="sc-body">
                <h3>{s.name}</h3>
                <div className="sc-meta">
                  {s.meta.map((m, j) => (
                    <span key={m + j}>{m}</span>
                  ))}
                </div>
                {s.desc ? <p className="sc-desc">{s.desc}</p> : null}
                <div className="sc-foot">
                  <div className="price">
                    {s.price}
                    <small>/ night</small>
                  </div>
                  <span className="link-u">View</span>
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
export function SafariGallery({
  props,
  data,
}: {
  props: P<"gallery">;
  data?: GalleryData;
}) {
  const imgs = data?.images?.length
    ? data.images.slice(0, 7).map((g) => g.url)
    : STOCK_GALLERY;
  // Layout classes mirror the design's mosaic (first tile 2×2, sixth wide).
  const cls = ["g w2 h2", "g", "g", "g", "g", "g w2", "g"];
  return (
    <section className="section">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow center no-rule">
            {props.eyebrow || "A look around"}
          </span>
          <h2
            className="display"
            style={{ marginTop: 18, fontSize: "clamp(2.2rem,4.4vw,3.4rem)" }}
          >
            {props.heading || "Moments from the reserve"}
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

/* ── REVIEWS (dark band) ────────────────────────────────────────────── */
export function SafariReviews({
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
  const avg = data?.average != null ? data.average.toFixed(2) : "4.98";
  const count = data?.count != null ? data.count : 214;
  return (
    <section className="section bg-dark">
      <div className="wrap">
        <div
          className="split"
          style={{ alignItems: "center", marginBottom: 56 }}
        >
          <div>
            <span className="eyebrow">{props.eyebrow || "Guest stays"}</span>
            <h2
              className="display"
              style={{ marginTop: 22, fontSize: "clamp(2.2rem,4.4vw,3.4rem)" }}
            >
              {props.heading || "Quiet that you can feel"}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(3.4rem,7vw,5rem)",
                fontWeight: 500,
                color: "var(--gold)",
                lineHeight: 1,
              }}
            >
              {avg}
            </div>
            <div>
              <div className="stars" style={{ fontSize: 18 }}>
                ★★★★★
              </div>
              <p className="muted" style={{ marginTop: 8 }}>
                {props.subheading || `${count} verified guest stays`}
              </p>
            </div>
          </div>
        </div>
        <div className="reviews">
          {reviews.map((r, i) => (
            <div key={r.initials + i} className="review">
              <span className="stars">★★★★★</span>
              <p>{r.quote}</p>
              <div className="who">
                <span className="av">{r.initials}</span>
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

/* ── LOCATION (split) ───────────────────────────────────────────────── */
export function SafariLocation({
  props,
  asset,
  ctx,
}: {
  props: P<"location">;
  asset?: SiteAssetResolver;
  ctx?: SafariCtx;
}) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="split">
          <div>
            <span className="eyebrow">{props.eyebrow || "Finding us"}</span>
            <h2
              className="display"
              style={{ marginTop: 22, fontSize: "clamp(2rem,4vw,3.2rem)" }}
            >
              {props.heading || "Deep in the wild"}
            </h2>
            <p className="muted" style={{ marginTop: 24, maxWidth: "52ch" }}>
              {props.body ||
                "A malaria-free reserve a few hours from the city, or forty-five minutes by light aircraft to our private airstrip. Full directions follow your booking."}
            </p>
            {ctx?.contactHref ? (
              <div style={{ marginTop: 36 }}>
                <a href={ctx.contactHref} className="btn btn-ghost">
                  <span>Directions &amp; transfers</span>
                </a>
              </div>
            ) : null}
          </div>
          <div>
            <div
              className="frame-img img-sq"
              style={{ height: "100%", minHeight: 380 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img(props.image_path, asset, IMG.location)}
                alt=""
                style={{ height: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── MAP (placeholder pin — the Contact page) ───────────────────────── */
export function SafariMap({ props }: { props: P<"map"> }) {
  const tag = props.caption?.trim() || props.address?.trim() || "Find us";
  return (
    <section className="section-sm" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="map-ph">
          <span className="map-pin" />
          <div className="map-tag">📍 {tag}</div>
        </div>
      </div>
    </section>
  );
}

/* ── CTA (band) ─────────────────────────────────────────────────────── */
export function SafariCta({
  props,
  asset,
  ctx,
}: {
  props: P<"cta">;
  asset?: SiteAssetResolver;
  ctx?: SafariCtx;
}) {
  const reserve = ctx?.reserveHref || ctx?.roomsHref || "#suites";

  // Newsletter sign-up band (the Journal page): a heading + blurb + email field,
  // no booking buttons or eyebrow pill.
  if (props.newsletter) {
    return (
      <section className="section-sm" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div
            className="cta-band"
            style={{
              paddingTop: "clamp(48px,6vw,84px)",
              paddingBottom: "clamp(48px,6vw,84px)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(props.image_path, asset, IMG.cta)} alt="" />
            <div className="cta-inner">
              <h2>{props.heading || "Field notes, twice a season"}</h2>
              <p>
                {props.body ||
                  "Sightings, open dates and the occasional recipe — no noise, just the lodge in your inbox."}
              </p>
              <form
                className="foot-news"
                style={{ maxWidth: 420, margin: "26px auto 0" }}
              >
                <input
                  type="email"
                  placeholder="you@email.com"
                  aria-label="Email"
                  style={{
                    background: "rgba(255,255,255,.14)",
                    borderColor: "rgba(255,255,255,.3)",
                    color: "#fff",
                  }}
                />
                <button className="btn btn-light btn-sm" type="button">
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
    <section className="section-sm">
      <div className="wrap">
        <div className="cta-band">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(props.image_path, asset, IMG.cta)} alt="" />
          <div className="cta-inner">
            <span className="tag-pill">
              {props.eyebrow ||
                "Book direct · the price you see is the price you pay"}
            </span>
            <h2 style={{ marginTop: 22 }}>
              {props.heading || "Your dates, under wide skies"}
            </h2>
            <p>
              {props.body ||
                "Reserve straight with the lodge — no agents, no booking fees, no commission. Just your stay, arranged by the people who'll greet you at the gate."}
            </p>
            <div className="hero-cta">
              <a href={reserve} className="btn btn-light btn-lg">
                <span>{props.button_label || "Check availability"}</span>
              </a>
              {ctx?.contactHref ? (
                <a href={ctx.contactHref} className="btn btn-on-dark btn-lg">
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

/* ── HOST BIO (the people, split w/ photo) ──────────────────────────── */
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

export function SafariHostBio({
  props,
  asset,
}: {
  props: P<"host_bio">;
  asset?: SiteAssetResolver;
}) {
  // "centered" variant = a founder-note / quote block (no photo): eyebrow +
  // a large serif quote + the author's name.
  if (props.variant === "centered") {
    return (
      <section className="section bg-2">
        <div className="wrap-narrow center">
          <span className="eyebrow center no-rule">
            {props.heading || "A note from us"}
          </span>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(1.6rem,3.2vw,2.5rem)",
              lineHeight: 1.32,
              marginTop: 28,
              color: "var(--ink)",
            }}
          >
            {props.body}
          </p>
          {props.name ? (
            <div
              style={{
                marginTop: 34,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontFamily: "var(--serif)", fontSize: "1.5rem" }}>
                {props.name}
              </span>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  // Split (image + heading/name/body), with an optional check-list (the About
  // "conservation" block) and an optional reversed/wide image layout.
  const points =
    props.points?.map((p) => p.text).filter((t) => t?.trim()) ?? [];
  return (
    <section className="section bg-2">
      <div className="wrap">
        <div className={`split${props.reverse ? "reverse" : ""}`}>
          <div className="split-media">
            <div
              className={`frame-img ${props.reverse ? "img-wide" : "img-tall"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(props.photo_path, asset, IMG.intro)} alt="" />
            </div>
          </div>
          <div>
            <span className="eyebrow">{props.heading || "Your hosts"}</span>
            {props.name ? (
              <h2
                className="display"
                style={{ marginTop: 24, fontSize: "clamp(2rem,4vw,3.2rem)" }}
              >
                {props.name}
              </h2>
            ) : null}
            <p
              className="lead"
              style={{ marginTop: props.name ? 24 : 28, maxWidth: "54ch" }}
            >
              {props.body ||
                "A few warm lines about the people who'll share the bush with you — what they love about hosting, and the touches guests remember."}
            </p>
            {points.length ? (
              <div
                className="amenity-grid"
                style={{ marginTop: 34, gridTemplateColumns: "1fr" }}
              >
                {points.map((p, i) => (
                  <div key={p + i} className="amenity">
                    {CHECK_ICON}
                    {p}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── CONTACT FORM (enquiry grid: form + detail card) ────────────────── */
const PLUS_ICON = (
  <span className="pm">
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  </span>
);

/* ── FAQ (accordion) ────────────────────────────────────────────────── */
const STOCK_FAQ = [
  {
    q: "How do we get there?",
    a: "We're a scenic drive from the nearest town, with a fly-in option to a private strip. Full directions follow your booking.",
  },
  {
    q: "What's included?",
    a: "Rates are full-board with daily guided activities. Replace this with your own inclusions.",
  },
  {
    q: "What's your cancellation policy?",
    a: "Book direct and there are no agency fees — tell guests your own terms here.",
  },
];

export function SafariFaq({ props }: { props: P<"faq"> }) {
  const items = props.items && props.items.length ? props.items : STOCK_FAQ;
  return (
    <section className="section bg-2">
      <div className="wrap-narrow">
        <div className="sec-head center" style={{ marginBottom: 40 }}>
          <span className="eyebrow center no-rule">
            {props.eyebrow || "Good to know"}
          </span>
          <h2
            className="display"
            style={{ marginTop: 18, fontSize: "clamp(2rem,4vw,3rem)" }}
          >
            {props.heading || "Frequently asked"}
          </h2>
        </div>
        <div>
          {items.map((it, i) => (
            <details key={it.q + i} className="faq-item" open={i === 0}>
              <summary>
                {it.q}
                {PLUS_ICON}
              </summary>
              <p>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── AMENITIES (at the lodge, icon grid) ────────────────────────────── */
const STOCK_AMENITIES = [
  { icon: "🔥", label: "Boma & fire pit" },
  { icon: "🏊", label: "Rock pool" },
  { icon: "🍷", label: "Sundowners" },
  { icon: "🦓", label: "Daily game drives" },
  { icon: "🍽️", label: "All meals" },
  { icon: "📶", label: "Wi-Fi at the main house" },
];

export function SafariAmenities({ props }: { props: P<"amenities"> }) {
  const items =
    props.items && props.items.length ? props.items : STOCK_AMENITIES;

  // "inline" = the Suites page "what's included" bar: a centred row of pills.
  if (props.variant === "inline") {
    return (
      <section className="section-sm bg-2">
        <div className="wrap">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(20px,4vw,56px)",
              flexWrap: "wrap",
              textAlign: "center",
            }}
          >
            {items.map((it, i) => (
              <span key={it.label + i} className="tag-pill">
                {it.icon ? (
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{it.icon}</span>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {it.label}
              </span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section bg-2">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow center no-rule">
            {props.eyebrow || "At the lodge"}
          </span>
          <h2 className="display" style={{ marginTop: 18 }}>
            {props.heading || "Everything, included"}
          </h2>
        </div>
        <div
          className="amenity-grid"
          style={{
            marginTop: 44,
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          }}
        >
          {items.map((it, i) => (
            <div key={it.label + i} className="amenity">
              {it.icon ? (
                <span style={{ fontSize: 20, lineHeight: 1 }}>{it.icon}</span>
              ) : null}
              {it.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── PRICING (display-only rates) ───────────────────────────────────── */
const STOCK_PRICING = [
  { label: "Suite, full-board", price: "R6 500", note: "per person / night" },
  { label: "Sole-use (whole lodge)", price: "On request", note: "" },
];

export function SafariPricing({ props }: { props: P<"pricing"> }) {
  const items = props.items && props.items.length ? props.items : STOCK_PRICING;
  return (
    <section className="section">
      <div className="wrap-narrow">
        <div className="sec-head center" style={{ marginBottom: 40 }}>
          <span className="eyebrow center no-rule">
            {props.eyebrow || "Rates"}
          </span>
          <h2 className="display" style={{ marginTop: 18 }}>
            {props.heading || "What it costs"}
          </h2>
        </div>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {items.map((it, i) => (
            <div
              key={it.label + i}
              className="rate-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 24,
                padding: "22px 26px",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
              }}
            >
              <div>
                <div style={{ fontFamily: "var(--serif)", fontSize: "1.3rem" }}>
                  {it.label}
                </div>
                {it.note ? (
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {it.note}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "1.5rem",
                  color: "var(--gold)",
                  whiteSpace: "nowrap",
                }}
              >
                {it.price}
              </div>
            </div>
          ))}
        </div>
        {props.footnote ? (
          <p
            className="muted"
            style={{ marginTop: 20, fontSize: 13, textAlign: "center" }}
          >
            {props.footnote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ── BLOG PREVIEW (journal teaser, real posts) ──────────────────────── */
const STOCK_POSTS = [
  {
    title: "Tracking the herd at first light",
    excerpt:
      "Notes from a cold morning drive — and the elephants that made it worth it.",
    href: "#",
    coverUrl: IMG.g1,
    date: null as string | null,
  },
  {
    title: "Why we took the fences down",
    excerpt: "The slow work of letting a piece of land become wild again.",
    href: "#",
    coverUrl: IMG.g3,
    date: null,
  },
  {
    title: "A season of new arrivals",
    excerpt: "Foals, calves and the first leopard cubs of the year.",
    href: "#",
    coverUrl: IMG.g5,
    date: null,
  },
];

export function SafariBlogPreview({
  props,
  data,
}: {
  props: P<"blog_preview">;
  data?: BlogPreviewData;
}) {
  const real = data?.posts ?? [];

  // "journal" = the blog index page: a large featured post (the first/featured
  // one) then a grid of the rest, with no section heading (the page-head is the
  // hero). Falls back to stock so the builder canvas isn't empty.
  if (props.display === "journal") {
    const all = real.length ? real : STOCK_POSTS;
    const featured = all[0];
    const rest = all.slice(1, (props.max ?? 6) + 1);
    return (
      <>
        {featured ? (
          <section
            className="section"
            style={{ paddingBottom: "clamp(40px,5vw,64px)" }}
          >
            <div className="wrap">
              <a href={featured.href || "#"} className="featured-post">
                <div className="fp-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featured.coverUrl || STOCK_GALLERY[0]}
                    alt={featured.title}
                  />
                </div>
                <div>
                  <span className="post-cat">Featured</span>
                  <h2
                    className="display"
                    style={{
                      marginTop: 16,
                      fontSize: "clamp(2rem,4vw,3.2rem)",
                    }}
                  >
                    {featured.title}
                  </h2>
                  {featured.excerpt ? (
                    <p className="lead" style={{ marginTop: 20 }}>
                      {featured.excerpt}
                    </p>
                  ) : null}
                  {featured.date ? (
                    <div className="post-meta">
                      <span>{featured.date}</span>
                    </div>
                  ) : null}
                  <div style={{ marginTop: 26 }}>
                    <span className="link-u">Read the story {ARROW}</span>
                  </div>
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
              <div className="post-grid">
                {rest.map((post, i) => (
                  <a
                    key={post.href + i}
                    href={post.href || "#"}
                    className="post-card"
                  >
                    <div className="pc-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          post.coverUrl ||
                          STOCK_GALLERY[(i + 1) % STOCK_GALLERY.length]
                        }
                        alt={post.title}
                      />
                    </div>
                    <h3 style={{ marginTop: 18 }}>{post.title}</h3>
                    {post.excerpt ? <p>{post.excerpt}</p> : null}
                    {post.date ? (
                      <div className="post-meta">
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
    <section className="section">
      <div className="wrap">
        <div className="sec-head center" style={{ marginBottom: 44 }}>
          <span className="eyebrow center no-rule">
            {props.eyebrow || "From the field journal"}
          </span>
          <h2 className="display" style={{ marginTop: 18 }}>
            {props.heading || "Latest from the journal"}
          </h2>
        </div>
        <div className="post-grid">
          {posts.map((post, i) => (
            <a
              key={post.href + i}
              href={post.href || "#"}
              className="post-card"
            >
              <div className="pc-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.coverUrl || STOCK_GALLERY[i % STOCK_GALLERY.length]}
                  alt={post.title}
                />
              </div>
              <h3 style={{ marginTop: 18 }}>{post.title}</h3>
              {post.excerpt ? <p>{post.excerpt}</p> : null}
              {post.date ? (
                <div className="post-meta">
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

/* ── ROOM DETAIL bands (bind to the single room in scope) ───────────── */
// Shown in the builder canvas (no room in scope) so the band isn't invisible.
function SafariRoomPlaceholder({ label }: { label: string }) {
  return (
    <section className="section">
      <div className="wrap">
        <div
          style={{
            border: "1px dashed var(--line)",
            borderRadius: 4,
            padding: 40,
            textAlign: "center",
            color: "var(--ink-soft)",
            fontSize: 14,
          }}
        >
          {label}
        </div>
      </div>
    </section>
  );
}

function roomPrice(price?: number | null, currency?: string | null): string {
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

export function SafariRoomGallery({
  props,
  data,
}: {
  props: P<"room_gallery">;
  data?: RoomDetail;
}) {
  const images = (data?.images ?? []).slice(0, props.max ?? 12);
  if (!images.length)
    return <SafariRoomPlaceholder label="This room's photos appear here." />;
  const [main, ...rest] = images;
  return (
    <section className="wrap">
      <div className="suite-hero">
        <div className="sh main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.url}
            data-lb-src={main.url}
            alt={main.alt || data?.name || ""}
          />
        </div>
        {rest.slice(0, 2).map((im, i) => (
          <div key={im.url + i} className="sh">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} data-lb-src={im.url} alt={im.alt || ""} />
          </div>
        ))}
        {images.length > 1 ? (
          <button type="button" className="sh-count" data-lb-open>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="15" rx="2" />
              <circle cx="12" cy="12.5" r="3.2" />
              <path d="M8 5l1.5-2h5L16 5" />
            </svg>
            <span data-lb-count>View photos</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function SafariRoomOverview({
  props,
  data,
}: {
  props: P<"room_overview">;
  data?: RoomDetail;
}) {
  if (!data)
    return (
      <SafariRoomPlaceholder label="The room's name and details appear here." />
    );
  const title = props.heading?.trim() || data.name;
  const facts = props.show_facts !== false ? data.facts : [];
  const price =
    props.show_price !== false ? roomPrice(data.price, data.currency) : "";
  return (
    <section className="section" style={{ paddingTop: "clamp(48px,6vw,72px)" }}>
      <div className="wrap">
        <span className="eyebrow no-rule">The suite</span>
        <h1
          className="display"
          style={{ marginTop: 16, fontSize: "clamp(2.4rem,5vw,4rem)" }}
        >
          {title}
        </h1>
        {facts.length ? (
          <div
            style={{
              marginTop: 22,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {facts.map((f, i) => (
              <span
                key={f + i}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 999,
                  padding: "7px 16px",
                  fontSize: 13,
                  color: "var(--ink-soft)",
                }}
              >
                {f}
              </span>
            ))}
          </div>
        ) : null}
        {data.description ? (
          <p
            className="lead"
            style={{ marginTop: 26, maxWidth: "62ch", whiteSpace: "pre-line" }}
          >
            {data.description}
          </p>
        ) : null}
        {price ? (
          <p className="muted" style={{ marginTop: 22 }}>
            From{" "}
            <b style={{ color: "var(--gold)", fontFamily: "var(--serif)" }}>
              {price}
            </b>{" "}
            / night
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function SafariRoomAmenities({
  props,
  data,
}: {
  props: P<"room_amenities">;
  data?: RoomDetail;
}) {
  const amenities = data?.amenities ?? [];
  if (!amenities.length)
    return <SafariRoomPlaceholder label="This room's amenities appear here." />;
  return (
    <section className="section bg-2">
      <div className="wrap">
        <span className="eyebrow">In the suite</span>
        <h2
          className="display"
          style={{ marginTop: 18, fontSize: "clamp(1.8rem,3.4vw,2.6rem)" }}
        >
          {props.heading || "Everything, thought of"}
        </h2>
        <div
          className="amenity-grid"
          style={{
            marginTop: 28,
            gridTemplateColumns:
              props.variant === "list"
                ? "1fr"
                : "repeat(auto-fit,minmax(220px,1fr))",
          }}
        >
          {amenities.map((a, i) => (
            <div key={a.label + i} className="amenity">
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
              {a.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SafariRoomRate({
  props,
  data,
}: {
  props: P<"room_rate">;
  data?: RoomDetail;
}) {
  if (!data)
    return (
      <SafariRoomPlaceholder label="The room's rate and booking button appear here." />
    );
  const price = roomPrice(data.price, data.currency);
  return (
    <section className="section-sm">
      <div className="wrap-narrow">
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 4,
            padding: "clamp(28px,4vw,40px)",
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            {props.heading ? (
              <h3 style={{ fontSize: "1.4rem" }}>{props.heading}</h3>
            ) : null}
            {price ? (
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "2rem",
                  color: "var(--gold)",
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
          <a href={data.bookHref} className="btn btn-primary btn-lg">
            <span>{props.cta_label?.trim() || "Book this room"}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── RATE TABLE (live nightly rates, display-only) ──────────────────── */
export function SafariRateTable({
  props,
  data,
}: {
  props: P<"rate_table">;
  data?: RateTableData;
}) {
  const rows = data?.rows ?? [];
  const cta = props.ctaLabel?.trim() || "Book";
  return (
    <section className="section">
      <div className="wrap-narrow">
        <div className="sec-head center" style={{ marginBottom: 40 }}>
          <span className="eyebrow center no-rule">
            {props.eyebrow || "Rates"}
          </span>
          <h2 className="display" style={{ marginTop: 18 }}>
            {props.heading || "Nightly rates"}
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="muted" style={{ textAlign: "center" }}>
            Your room rates appear here.
          </p>
        ) : (
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {rows.map((row, i) => (
              <div
                key={row.roomId}
                className="rate-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 20,
                  padding: "20px 26px",
                  borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{ fontFamily: "var(--serif)", fontSize: "1.3rem" }}
                  >
                    {row.name}
                  </div>
                  {row.maxGuests ? (
                    <div
                      className="muted"
                      style={{ fontSize: 13, marginTop: 4 }}
                    >
                      Sleeps {row.maxGuests}
                      {row.minNights ? ` · min ${row.minNights} nights` : ""}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: "1.4rem",
                        color: "var(--gold)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {roomPrice(row.nightlyFrom, row.currency) || "—"}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      from / night
                    </div>
                  </div>
                  <a href={row.bookHref} className="btn btn-primary">
                    <span>{cta}</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
        {props.note ? (
          <p
            className="muted"
            style={{ marginTop: 20, fontSize: 13, textAlign: "center" }}
          >
            {props.note}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ── STATS (dark band of big numbers — the About design) ────────────── */
const STOCK_STATS = [
  { value: "15", label: "Years rewilding" },
  { value: "3", label: "Suites only" },
  { value: "340+", label: "Species recorded" },
  { value: "0", label: "Internal fences" },
];

export function SafariStats({ props }: { props: P<"stats"> }) {
  const items = props.items && props.items.length ? props.items : STOCK_STATS;
  return (
    <section className="section-sm bg-dark">
      <div className="wrap">
        {props.heading ? (
          <div className="sec-head center" style={{ marginBottom: 34 }}>
            <h2 className="display">{props.heading}</h2>
          </div>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
            gap: 32,
            textAlign: "center",
          }}
        >
          {items.map((s, i) => (
            <div key={s.label + i}>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: "clamp(2.6rem,5vw,4rem)",
                  color: "var(--gold)",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                className="muted"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginTop: 10,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── VALUES (numbered "promises" — the About design) ────────────────── */
const STOCK_VALUES = [
  {
    title: "Space, not crowds",
    body: "Never more than six guests in the vehicle, and often it's just you and your ranger under the whole sky.",
  },
  {
    title: "Honest pricing",
    body: "One inclusive rate, booked direct. No agents, no booking fees, no commission — the price you're quoted is the price you pay.",
  },
  {
    title: "People of this place",
    body: "Our guides, trackers and cooks were raised here. Their knowledge isn't trained — it's inherited.",
  },
];

export function SafariValues({ props }: { props: P<"values"> }) {
  const items = props.items && props.items.length ? props.items : STOCK_VALUES;
  return (
    <section className="section">
      <div className="wrap">
        <div className="sec-head center">
          <span className="eyebrow center no-rule">How we host</span>
          <h2 className="display" style={{ marginTop: 18 }}>
            {props.heading || "Three quiet promises"}
          </h2>
        </div>
        <div className="feat-row">
          {items.map((v, i) => (
            <div key={v.title + i} className="feat">
              <span className="kicker-num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3>{v.title}</h3>
              {v.body ? <p>{v.body}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Dispatch a section to its Safari-styled band. Returns `undefined` for section
 * types that have no Safari variant yet, so the caller falls back to the generic
 * renderer (the section still shows, just in the neutral style).
 */
/** Bridges the generic FormSection's `--site-*` design tokens onto the Safari
 *  palette so a host-built `form` block reads as part of the NenGama design. */
const SAFARI_FORM_VARS = {
  "--site-bg": "#fff",
  "--site-surface": "var(--bg-2)",
  "--site-line": "var(--line)",
  "--site-ink": "var(--ink)",
  "--site-mute": "var(--ink-soft)",
  // Accent drives the consent/T&Cs link colour + the checkbox/radio tick, so it
  // must map to the Safari ochre (it isn't inherited inside the form scope).
  "--site-accent": "var(--accent)",
  "--site-accent-ink": "#fff",
  "--site-radius": "4px",
  "--site-btn-primary-bg": "var(--accent)",
  "--site-btn-primary-color": "#fff",
  "--site-btn-primary-border": "none",
  "--site-btn-primary-radius": "4px",
} as CSSProperties;

/** Bridges the generic free-element / container `--site-*` tokens onto the Safari
 *  palette + type scale, so a host-built Section / Columns / heading / text /
 *  image / button / spacer / divider renders ON-THEME on the live Safari site
 *  (these types have no bespoke Safari band; without this they'd be skipped). */
const SAFARI_ELEMENT_VARS = {
  ...SAFARI_FORM_VARS,
  "--site-secondary": "var(--accent-deep)",
  "--site-font-heading": "var(--serif)",
  "--site-weight-heading": "600",
  "--site-h1": "3rem",
  "--site-h2": "2.25rem",
  "--site-h3": "1.6rem",
  "--site-h4": "1.3rem",
  "--site-leading-heading": "1.15",
  "--site-tracking-heading": "-0.01em",
  "--site-leading-body": "1.7",
  "--site-text-base": "1.05rem",
} as CSSProperties;

/** Render the free elements + containers (which have no bespoke Safari band) via
 *  the shared generic components, themed onto Safari. Returns undefined for types
 *  that genuinely have no Safari rendering, so the caller still skips those. */
function renderSafariGenericFallback(
  section: WebsiteSection,
  opts: { asset?: SiteAssetResolver; interactive?: boolean },
): ReactNode | undefined {
  let el: ReactNode;
  switch (section.type) {
    case "el_heading":
      el = <ElHeadingSection props={section.props} />;
      break;
    case "el_text":
      el = <ElTextSection props={section.props} />;
      break;
    case "el_image":
      el = (
        <ElImageSection
          props={section.props}
          asset={opts.asset}
          interactive={opts.interactive}
        />
      );
      break;
    case "el_button":
      el = <ElButtonSection props={section.props} />;
      break;
    case "el_spacer":
      el = <ElSpacerSection props={section.props} />;
      break;
    case "el_divider":
      el = <ElDividerSection props={section.props} />;
      break;
    case "columns":
      el = <ColumnsSection props={section.props} asset={opts.asset} />;
      break;
    case "flex":
      el = <FlexSection props={section.props} asset={opts.asset} />;
      break;
    default:
      return undefined;
  }
  return <div style={SAFARI_ELEMENT_VARS}>{el}</div>;
}

export function renderSafariSection(
  section: WebsiteSection,
  opts: {
    data?: SiteData;
    asset?: SiteAssetResolver;
    ctx?: SafariCtx;
    /** Live website id + interactivity for the form bands (submit + redirect). */
    websiteId?: string;
    interactive?: boolean;
  },
): ReactNode | undefined {
  const { data, asset, ctx, websiteId, interactive } = opts;
  switch (section.type) {
    case "hero":
      return <SafariHero props={section.props} asset={asset} ctx={ctx} />;
    case "intro":
      return <SafariIntro props={section.props} asset={asset} ctx={ctx} />;
    case "highlights":
      return <SafariHighlights props={section.props} asset={asset} />;
    case "rooms_preview":
      return (
        <SafariSuites
          props={section.props}
          data={dataFor(data, section.id, "rooms_preview")}
          ctx={ctx}
        />
      );
    case "gallery":
      return (
        <SafariGallery
          props={section.props}
          data={dataFor(data, section.id, "gallery")}
        />
      );
    case "reviews":
      return (
        <SafariReviews
          props={section.props}
          data={dataFor(data, section.id, "reviews")}
        />
      );
    case "location":
      return <SafariLocation props={section.props} asset={asset} ctx={ctx} />;
    case "cta":
      return <SafariCta props={section.props} asset={asset} ctx={ctx} />;
    case "host_bio":
      return <SafariHostBio props={section.props} asset={asset} />;
    case "stats":
      return <SafariStats props={section.props} />;
    case "values":
      return <SafariValues props={section.props} />;
    case "map":
      return <SafariMap props={section.props} />;
    case "contact_form":
      return (
        <SafariContactForm
          props={section.props}
          ctx={ctx}
          websiteId={websiteId}
          interactive={interactive}
        />
      );
    case "form":
      // Host-built form block — reuse the shared FormSection engine (full
      // goal→thank-you loop) inside a Safari section shell. The `--site-*`
      // bridge maps the generic field/button vars onto the Safari palette so it
      // reads as part of the design without re-implementing every field type.
      return (
        <section className="section">
          <div className="wrap" style={SAFARI_FORM_VARS}>
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
      return <SafariFaq props={section.props} />;
    case "amenities":
      return <SafariAmenities props={section.props} />;
    case "pricing":
      return <SafariPricing props={section.props} />;
    case "blog_preview":
      return (
        <SafariBlogPreview
          props={section.props}
          data={dataFor(data, section.id, "blog_preview")}
        />
      );
    case "room_gallery":
      return (
        <SafariRoomGallery
          props={section.props}
          data={dataFor(data, section.id, "room_gallery")}
        />
      );
    case "room_overview":
      return (
        <SafariRoomOverview
          props={section.props}
          data={dataFor(data, section.id, "room_overview")}
        />
      );
    case "room_amenities":
      return (
        <SafariRoomAmenities
          props={section.props}
          data={dataFor(data, section.id, "room_amenities")}
        />
      );
    case "room_rate":
      return (
        <SafariRoomRate
          props={section.props}
          data={dataFor(data, section.id, "room_rate")}
        />
      );
    case "rate_table":
      return (
        <SafariRateTable
          props={section.props}
          data={dataFor(data, section.id, "rate_table")}
        />
      );
    default:
      return undefined;
  }
}

/**
 * Renders an ordered list of sections in the Safari design — the public-site
 * counterpart to the builder canvas, so live === builder. Section types without
 * a Safari band are skipped (the home template only uses mapped types).
 */
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

export function SafariSectionList({
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
  ctx?: SafariCtx;
  /** Threaded to the form bands so they submit + redirect on the live site. */
  websiteId?: string;
  interactive?: boolean;
}) {
  const render = (s: WebsiteSection) => {
    const safari = renderSafariSection(s, {
      data,
      asset,
      ctx,
      websiteId,
      interactive,
    });
    if (safari !== undefined) return safari;
    // No bespoke Safari band → render free elements + containers via the shared
    // generic components (themed onto Safari) so builder === live for those too.
    return renderSafariGenericFallback(s, { asset, interactive });
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

          // No per-device CONTENT override → render once. A per-device HIDE still
          // works via the lightweight `.vilo-rwrap` wrapper (display:contents →
          // none at the breakpoint), so we avoid duplicating the section's markup.
          if (!lapProps && !mobProps) {
            const el = render(s);
            if (el === undefined) return null;
            const cls = [
              "vilo-rwrap",
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

          // Per-device CONTENT override → render the whole band once per screen
          // size (each with its merged props) and let the responsive CSS show the
          // one that matches. Laptop inherits desktop, mobile inherits laptop.
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
              <div className="vilo-rdup vilo-rdup-desktop">{desktopEl}</div>
              {laptopEl ? (
                <div className="vilo-rdup vilo-rdup-laptop">{laptopEl}</div>
              ) : null}
              {mobileEl ? (
                <div className="vilo-rdup vilo-rdup-mobile">{mobileEl}</div>
              ) : null}
            </Fragment>
          );
        })}
    </>
  );
}
