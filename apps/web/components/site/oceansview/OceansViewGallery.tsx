import "./oceansGallery.css";

import { OceansMosaicGallery } from "./OceansMosaicGallery";

/**
 * Oceans View GALLERY page — the founder's bespoke reference design
 * (docs/themes/oceansview/pages/Gallery.html), wired to the host's LIVE photo
 * library. A page-head hero, the reference masonry mosaic + full-screen
 * lightbox slider (reused from the home page via <OceansMosaicGallery>), and a
 * closing CTA banner. Empty library → a tasteful "photos coming soon" section
 * rather than fabricated images. Scoped under `.ovgallery`.
 */
export function OceansViewGallery({
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
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=2200&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=2000&q=80";

  const title = heading?.trim() || "Gallery";
  const sub =
    intro?.trim() ||
    "The rooms, the pools, the food and the bay beyond. Tap any image to open it full-screen.";

  return (
    <div className="ovgallery">
      {/* PAGE HEAD */}
      <section className="phead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={headImg} alt={`${brandName} in pictures`} />
        <div className="wrap">
          <div className="crumbs">
            <a href="/">Home</a>
            <span>·</span>
            <span>Gallery</span>
          </div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* MOSAIC — live photo library */}
      <section className="section">
        <div className="wrap">
          {shots.length === 0 ? (
            <div className="empty">
              <h2 className="lg">Photos coming soon</h2>
              <p className="muted" style={{ marginTop: 14 }}>
                {brandName} is putting the gallery together. New photos appear
                here the moment they&apos;re added.
              </p>
              <div className="hero-cta" style={{ justifyContent: "center" }}>
                <a href={roomsHref} className="btn btn-primary btn-lg">
                  View rooms
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Say hello
                </a>
              </div>
            </div>
          ) : (
            <OceansMosaicGallery images={shots} brandName={brandName} />
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctaImg} alt={brandName} />
            <div className="banner-in">
              <h2>It&apos;s better in person</h2>
              <p>
                Pictures only get you so far. Come see the bay for yourself —
                booked direct, the price you see is the price you pay.
              </p>
              <div className="hero-cta">
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
