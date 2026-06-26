import { Fragment, type ReactNode } from "react";

import { siteImageUrl } from "@/lib/site/image";
import {
  dataFor,
  type RoomsPreviewData,
  type GalleryData,
  type ReviewsData,
  type SiteAssetResolver,
  type SiteData,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

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

/** Cross-page links + brand used by the bands (hero/intro/cta/location). The
 *  builder canvas renders sections in isolation (links inert), so every field
 *  is optional with a sensible fallback. */
export interface SafariCtx {
  brandName?: string;
  roomsHref?: string;
  aboutHref?: string;
  contactHref?: string;
  reserveHref?: string;
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
  return (
    <section className="hero">
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
          <div className="hero-cta">
            <a href={roomsHref} className="btn btn-primary btn-lg">
              <span>{props.cta_label || "Explore the suites"}</span>
            </a>
            {aboutHref ? (
              <a href={aboutHref} className="btn btn-on-dark btn-lg">
                <span>Our story</span>
              </a>
            ) : null}
          </div>
          <div className="hero-meta">
            <div className="hm">
              <b>12,000</b>
              <span>Hectares</span>
            </div>
            <div className="div" />
            <div className="hm">
              <b>Big Five</b>
              <span>Free-roaming</span>
            </div>
            <div className="div" />
            <div className="hm">
              <b>
                4.98
                <span className="stars" style={{ fontSize: 11, marginLeft: 6 }}>
                  ★★★★★
                </span>
              </b>
              <span>214 guest stays</span>
            </div>
          </div>
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
            <div className="stat-badge" style={{ right: -12, bottom: -24 }}>
              <b>2009</b>
              <span>Family-run since</span>
            </div>
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
  data,
  ctx,
}: {
  props: P<"rooms_preview">;
  data?: RoomsPreviewData;
  ctx?: SafariCtx;
}) {
  const roomsHref = ctx?.roomsHref || "#suites";
  const real = data?.rooms ?? [];
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
            <span className="eyebrow">Where you&apos;ll rest</span>
            <h2
              className="display"
              style={{ marginTop: 22, fontSize: "clamp(2.2rem,4.4vw,3.6rem)" }}
            >
              Three suites, one horizon
            </h2>
          </div>
          <a href={roomsHref} className="link-u">
            All suites &amp; rates {ARROW}
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
          <span className="eyebrow center no-rule">A look around</span>
          <h2
            className="display"
            style={{ marginTop: 18, fontSize: "clamp(2.2rem,4.4vw,3.4rem)" }}
          >
            Moments from the reserve
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
            <span className="eyebrow">Guest stays</span>
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
                {count} verified guest stays across four seasons
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
export function SafariHostBio({
  props,
  asset,
}: {
  props: P<"host_bio">;
  asset?: SiteAssetResolver;
}) {
  return (
    <section className="section bg-2">
      <div className="wrap">
        <div className="split">
          <div className="split-media">
            <div className="frame-img img-tall">
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
          </div>
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
export function renderSafariSection(
  section: WebsiteSection,
  opts: {
    data?: SiteData;
    asset?: SiteAssetResolver;
    ctx?: SafariCtx;
  },
): ReactNode | undefined {
  const { data, asset, ctx } = opts;
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
    default:
      return undefined;
  }
}

/**
 * Renders an ordered list of sections in the Safari design — the public-site
 * counterpart to the builder canvas, so live === builder. Section types without
 * a Safari band are skipped (the home template only uses mapped types).
 */
export function SafariSectionList({
  sections,
  data,
  asset,
  ctx,
}: {
  sections: WebsiteSection[];
  data?: SiteData;
  asset?: SiteAssetResolver;
  ctx?: SafariCtx;
}) {
  return (
    <>
      {sections
        .filter((s) => s.enabled)
        .map((s) => {
          const el = renderSafariSection(s, { data, asset, ctx });
          return el === undefined ? null : <Fragment key={s.id}>{el}</Fragment>;
        })}
    </>
  );
}
