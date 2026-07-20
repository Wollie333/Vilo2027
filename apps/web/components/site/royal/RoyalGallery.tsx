import "./royalGallery.css";

import { siteImageUrl } from "@/lib/site/image";

import { OceansMosaicGallery } from "../oceansview/OceansMosaicGallery";

/**
 * Royal Hotel GALLERY page (preset `royal`) — its own component + stylesheet
 * (`.rgallery` / royalGallery.css): the formal grand-hotel treatment (Archivo
 * display, a centred champagne-ruled page head, a refined charcoal/champagne
 * mosaic + full-screen lightbox slider, a closing CTA banner) — distinct from
 * the OceansView resort gallery. The mosaic + lightbox markup is rendered
 * verbatim by the shared <OceansMosaicGallery> so every photo stays
 * clickable/zoomable; only the grid + lightbox chrome are re-skinned via CSS.
 * Empty library → a tasteful "photos coming soon" state rather than fabricated
 * images. Phase C (theme differentiation — subpages).
 */
export function RoyalGallery({
  brandName,
  heading,
  intro,
  images,
  roomsHref = "/rooms",
  contactHref = "/contact",
  asset,
}: {
  brandName: string;
  heading?: string | null;
  intro?: string | null;
  images: { url: string; caption?: string | null }[];
  roomsHref?: string;
  contactHref?: string;
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const shots = (images ?? [])
    .filter((i) => i.url)
    .map((i) => ({ url: asset(i.url) ?? i.url, caption: i.caption }));

  const headImg =
    shots[0]?.url ||
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=2560&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=2000&q=80";

  const title = heading?.trim() || "Gallery";
  const sub =
    intro?.trim() ||
    "The rooms, the suites, the quiet corners and the address beyond. Tap any image to open it full-screen.";

  return (
    <div className="rgallery">
      {/* PAGE HEAD — centred, champagne-ruled */}
      <section className="phead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={siteImageUrl(headImg, { width: 2560 })}
          alt={`${brandName} in pictures`}
        />
        <div className="wrap" data-reveal>
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Gallery</span>
          </div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* MOSAIC — live photo library, feeding the shared lightbox */}
      <section className="section">
        <div className="wrap">
          {shots.length === 0 ? (
            <div className="rg-empty" data-reveal>
              <span className="tag" style={{ justifyContent: "center" }}>
                In the making
              </span>
              <h2 className="lg" style={{ marginTop: 16 }}>
                Photos coming soon
              </h2>
              <p className="muted" style={{ marginTop: 16 }}>
                {brandName} is putting the gallery together. New photos appear
                here the moment they&apos;re added.
              </p>
              <div className="rg-empty-cta">
                <a href={roomsHref} className="btn btn-coral btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Say hello
                </a>
              </div>
            </div>
          ) : (
            <div className="rg-grid">
              {/* NB: no data-reveal on this wrapper — the reveal primitive sets
                  the independent `translate` property, which (like `transform`)
                  establishes a containing block and would break the shared
                  lightbox's position:fixed overlay rendered inside here. */}
              <OceansMosaicGallery
                images={shots}
                brandName={brandName}
                limit={shots.length}
              />
            </div>
          )}
        </div>
      </section>

      {/* CTA — closing banner */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="banner" data-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={siteImageUrl(ctaImg, { width: 1600 })}
              alt={brandName}
              loading="lazy"
              decoding="async"
            />
            <div className="banner-in">
              <h2>It&apos;s better in person</h2>
              <p>
                Pictures only get you so far. Come see the address for yourself
                — booked direct, the price you see is the price you pay.
              </p>
              <div className="rg-cta-row">
                <a href={roomsHref} className="btn btn-white btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-on-img btn-lg">
                  Get in touch
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
