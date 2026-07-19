import "./marmaladeGallery.css";

import type { GalleryImage } from "@/lib/site/types";

/**
 * Marmalade House GALLERY page — the founder's bespoke "Postcards" reference design
 * (docs/themes/marmalade/pages/Gallery.html), wired to the host's LIVE photo
 * library. A plain page head that clears the floating nav, then the reference's
 * taped-photo album (the `.gal/.g/.im` postcard look reused from the home page,
 * with occasional wide/tall tiles for rhythm) and a closing CTA banner. Empty
 * library → a tasteful "photos coming soon" postcard rather than fabricated
 * images. The reference's category-filter chips are omitted — there is no category
 * metadata on the photo library, so they would be dead UI. Scoped under
 * `.mmgallery`.
 */
export function MarmaladeGallery({
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

  const ctaImg =
    shots[shots.length - 1]?.url ||
    "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=2000&q=80";

  const title = heading?.trim() || "The album";
  const sub =
    intro?.trim() ||
    "The rooms, the garden, the table and the village beyond. A look around before you arrive.";

  return (
    <div className="mmgallery">
      {/* PAGE HEAD — plain, clears the floating nav */}
      <section className="phead-plain">
        <div className="wrap-tight">
          <span className="hand">in pictures</span>
          <h1>{title}</h1>
          <p className="lead mx">{sub}</p>
        </div>
      </section>

      {/* TAPED ALBUM — live photo library */}
      <section
        className="section"
        style={{ paddingTop: "clamp(24px,3vw,44px)" }}
      >
        <div className="wrap">
          {shots.length === 0 ? (
            <div className="empty">
              <span className="stamp">✿</span>
              <h2>Photos coming soon</h2>
              <p className="muted">
                {brandName} is putting the album together. New photos land here
                the moment they&apos;re added.
              </p>
              <div className="pcta">
                <a href={roomsHref} className="btn btn-accent btn-lg">
                  See the rooms
                </a>
                <a href={contactHref} className="btn btn-ghost btn-lg">
                  Say hello
                </a>
              </div>
            </div>
          ) : (
            <div className="gal">
              {shots.map((g, i) => {
                const rhythm =
                  i % 8 === 0 ? "g wide" : i % 8 === 3 ? "g tall" : "g";
                return (
                  <div className={rhythm} key={i}>
                    <div className="im">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.url}
                        alt={g.caption || brandName}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    {g.caption ? <div className="cap">{g.caption}</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA (banner) */}
      <section className="section soft">
        <div className="wrap">
          <div className="banner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctaImg} alt={brandName} loading="lazy" decoding="async" />
            <div className="banner-in">
              <span className="hand lg" style={{ color: "var(--site-note)" }}>
                better in person
              </span>
              <h2 style={{ marginTop: 6 }}>It&apos;s better in person</h2>
              <p>
                Pictures only get you so far. Come see the house for yourself —
                booked direct, the price you see is the price you pay.
              </p>
              <div className="pcta">
                <a href={roomsHref} className="btn btn-accent btn-lg">
                  See the rooms
                </a>
                <a href={contactHref} className="btn btn-light btn-lg">
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
