import "./safariGallery.css";

import { siteImageUrl } from "@/lib/site/image";

import { OceansMosaicGallery } from "../oceansview/OceansMosaicGallery";

const Arrow = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/**
 * Safari (NenGama Lodge) GALLERY page (preset `safari`) — its own component +
 * stylesheet (`.sfgallery` / safariGallery.css): the warm, airy, editorial lodge
 * treatment (Fraunces display, hairline crumbs, a full-bleed left-aligned page
 * head, a daylight editorial mosaic) — distinct from the OceansView resort
 * gallery. The mosaic + full-screen lightbox slider are reused verbatim from the
 * shared <OceansMosaicGallery> so every photo stays clickable/zoomable; only the
 * grid + lightbox chrome are re-skinned via CSS. Empty library → a tasteful
 * "photos coming soon" state rather than fabricated images. Phase B (theme
 * differentiation — subpages).
 */
export function SafariGallery({
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
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=2560&q=80";
  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?w=2000&q=80";

  const title = heading?.trim() || "Gallery";
  const sub =
    intro?.trim() ||
    "The rooms, the light, the plain beyond — a look around before you come to stay. Tap any image to open it full-screen.";

  return (
    <div className="sfgallery">
      {/* PAGE HEAD — full-bleed photo, left-aligned editorial */}
      <section className="sf-phead">
        <div className="sf-phead-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(headImg, { width: 2560 })}
            alt={`${brandName} in pictures`}
          />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-phead-in" data-reveal>
          <nav className="sf-crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <span>Gallery</span>
          </nav>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
      </section>

      {/* MOSAIC — live photo library, feeding the shared lightbox */}
      <section className="sf-sec">
        <div className="wrap">
          {shots.length === 0 ? (
            <div className="sf-empty" data-reveal>
              <span className="sf-eyebrow">In the making</span>
              <h2 className="sf-h2">Photos coming soon</h2>
              <p className="sf-lead">
                {brandName} is putting the gallery together. New photos appear
                here the moment they&apos;re added.
              </p>
              <div className="sf-empty-cta">
                <a href={roomsHref} className="sf-btn sf-btn-solid sf-btn-lg">
                  View the rooms
                </a>
                <a href={contactHref} className="sf-btn sf-btn-line sf-btn-lg">
                  Say hello {Arrow}
                </a>
              </div>
            </div>
          ) : (
            <div className="sf-gallery-grid">
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

      {/* CTA — full-bleed closing banner */}
      <section className="sf-cta">
        <div className="sf-cta-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteImageUrl(ctaImg, { width: 2000 })}
            alt={brandName}
            loading="lazy"
            decoding="async"
          />
          <span className="sf-scrim" aria-hidden />
        </div>
        <div className="wrap sf-cta-in" data-reveal>
          <span className="sf-eyebrow on-dark">It&apos;s better in person</span>
          <h2>Come see the plain wake up</h2>
          <p>
            Pictures only get you so far. Booked direct, the price you see is
            the price you pay — no agents, no surprises.
          </p>
          <div className="sf-cta-row">
            <a href={roomsHref} className="sf-btn sf-btn-solid sf-btn-lg">
              View the rooms
            </a>
            <a href={contactHref} className="sf-btn sf-btn-line sf-btn-lg">
              Get in touch {Arrow}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
