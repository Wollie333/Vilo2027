import "./sabelaGallery.css";

import type { GalleryImage } from "@/lib/site/types";

/**
 * Sabela Lodge GALLERY page — the founder's bespoke dark-editorial "Lodge"
 * reference design (docs/themes/sabela/pages/Gallery.html), wired to the host's
 * LIVE photo library. A plain page head that clears the floating nav, then the
 * reference's masonry (columns) grid of photos with a caption line only when one
 * is present, and a closing gold-glow CTA band. Empty library → a tasteful
 * "photos coming soon" state rather than fabricated images. The reference's
 * category-filter chips are omitted — there is no category metadata on the photo
 * library, so they would be dead UI. Static server render (no lightbox). Renders
 * inside the `.sbchrome` themed chrome (`hotel` preset). Scoped under `.sbgallery`.
 */
export function SabelaGallery({
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
  images: GalleryImage[];
  roomsHref?: string;
  contactHref?: string;
  asset: (p: string | null | undefined) => string | undefined;
}) {
  const shots = (images ?? [])
    .filter((i) => i.url)
    .map((i) => ({ url: asset(i.url) ?? i.url, caption: i.caption }));

  const brandInitial = (brandName.trim()[0] || "S").toUpperCase();

  const title = heading?.trim() || "The gallery";
  const sub =
    intro?.trim() ||
    "The reserve, the suites and the wildlife — a slow scroll through the moments that make " +
      brandName +
      ".";

  return (
    <div className="sbgallery">
      {/* PAGE HEAD — plain, clears the floating nav */}
      <section className="page-head" data-section="intro">
        <div className="wrap-narrow">
          <span className="eyebrow center">In pictures</span>
          <h1>{title}</h1>
          <p className="lead mx-auto">{sub}</p>
        </div>
      </section>

      {/* MASONRY — live photo library */}
      <section
        className="section"
        data-section="gallery"
        style={{ paddingTop: "clamp(24px,3vw,44px)" }}
      >
        <div className="wrap">
          {shots.length === 0 ? (
            <div className="empty">
              <span className="badge" aria-hidden>
                {brandInitial}
              </span>
              <h2>Photos coming soon</h2>
              <p className="muted">
                {brandName} is putting the gallery together. New photos land
                here the moment they&apos;re added.
              </p>
              <div className="ecta">
                <a href={roomsHref} className="btn btn-primary btn-lg">
                  Explore the suites
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Talk to us
                </a>
              </div>
            </div>
          ) : (
            <div className="masonry">
              {shots.map((g, i) => (
                <figure className="m" key={i}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.url}
                    alt={g.caption || brandName}
                    loading="lazy"
                    decoding="async"
                  />
                  {g.caption ? (
                    <figcaption className="cap">{g.caption}</figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA band */}
      <section className="section-sm" data-section="cta">
        <div className="wrap">
          <div className="cta-band">
            <span className="glow" />
            <h2>The photos don&apos;t do it justice</h2>
            <p>
              They never do. Come see it in person — booked direct, with the
              rate you see being the rate you pay.
            </p>
            <div className="hero-cta-row">
              <a href={roomsHref} className="btn btn-light btn-lg">
                Check availability
              </a>
              <a href={contactHref} className="btn btn-on-dark btn-lg">
                Talk to us
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
