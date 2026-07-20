"use client";

import "./siteNearby.css";

import { useState } from "react";

import { siteImageUrl } from "@/lib/site/image";
import {
  NEARBY_GROUPS,
  NEARBY_PLACEHOLDER,
  nearbyStars,
  type NearbyPlace,
} from "@/lib/site/nearby";

/**
 * Nearby experiences — "things to do around the host's property", shown as a
 * responsive card grid with a category filter. SHARED + token-driven: every
 * colour/font/shape comes from the active theme's `--site-*` tokens (scoped
 * `.site-nearby`), so it reads on-brand on each theme without a bespoke copy —
 * like the shared contact form and gallery lightbox. Placeholder-first: renders
 * NEARBY_PLACEHOLDER until the Google Places fetch is wired (see lib/site/nearby),
 * and flags itself as a sample so nothing reads as a verified claim.
 * Mobile-first: 3 → 2 → 1 columns; the filter row scrolls horizontally on phones.
 */
export function SiteNearbyExperiences({
  eyebrow = "Around you",
  title = "Worth the short drive",
  intro,
  places = NEARBY_PLACEHOLDER,
  isPlaceholder = places === NEARBY_PLACEHOLDER,
}: {
  eyebrow?: string;
  title?: string;
  intro?: string | null;
  places?: NearbyPlace[];
  isPlaceholder?: boolean;
}) {
  const [group, setGroup] = useState<NearbyPlace["group"] | "all">("all");

  const list = places.filter((p) => p.name);
  if (list.length === 0) return null;

  const shown = group === "all" ? list : list.filter((p) => p.group === group);
  // Only offer filters that actually have places behind them.
  const groups = NEARBY_GROUPS.filter(
    (g) => g.key === "all" || list.some((p) => p.group === g.key),
  );

  const sub =
    intro?.trim() ||
    "Hand-picked places nearby — food, nature, viewpoints and things to do, with distances from the door. Tap through for directions.";

  return (
    <section className="site-nearby" aria-labelledby="site-nearby-title">
      <div className="site-nearby-wrap">
        <header className="site-nearby-head">
          <span className="site-nearby-eyebrow">{eyebrow}</span>
          <h2 className="site-nearby-title" id="site-nearby-title">
            {title}
          </h2>
          <p className="site-nearby-intro">{sub}</p>
        </header>

        {groups.length > 1 ? (
          <div
            className="site-nearby-filters"
            role="tablist"
            aria-label="Filter nearby places"
          >
            {groups.map((g) => {
              const active = g.key === group;
              return (
                <button
                  key={g.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={
                    active ? "site-nearby-chip is-active" : "site-nearby-chip"
                  }
                  onClick={() => setGroup(g.key)}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <ul className="site-nearby-grid">
          {shown.map((p, i) => {
            const stars = nearbyStars(p.rating);
            const directions =
              p.mapsUri ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                p.name,
              )}`;
            return (
              <li className="site-nearby-card" key={`${p.name}-${i}`}>
                <div className="site-nearby-fig">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl(p.imageUrl, { width: 800 })}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="site-nearby-ph" aria-hidden>
                      {(p.name[0] ?? "•").toUpperCase()}
                    </span>
                  )}
                  <span className="site-nearby-cat">{p.category}</span>
                  <span className="site-nearby-dist">{p.distance}</span>
                </div>
                <div className="site-nearby-body">
                  <div className="site-nearby-top">
                    <h3 className="site-nearby-name">{p.name}</h3>
                    {p.price ? (
                      <span className="site-nearby-price">{p.price}</span>
                    ) : null}
                  </div>
                  <div className="site-nearby-rating">
                    <span className="site-nearby-stars" aria-hidden>
                      {"★★★★★".slice(0, stars)}
                      {"☆☆☆☆☆".slice(0, 5 - stars)}
                    </span>
                    <b>{p.rating.toFixed(1)}</b>
                    <span className="site-nearby-count">
                      ({p.reviews.toLocaleString()})
                    </span>
                  </div>
                  {p.blurb ? (
                    <p className="site-nearby-blurb">{p.blurb}</p>
                  ) : null}
                  <div className="site-nearby-foot">
                    {p.openNow != null ? (
                      <span
                        className={
                          p.openNow
                            ? "site-nearby-open"
                            : "site-nearby-open is-closed"
                        }
                      >
                        {p.openNow ? "Open now" : "Closed now"}
                      </span>
                    ) : (
                      <span />
                    )}
                    <a
                      className="site-nearby-link"
                      href={directions}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Directions
                      <svg
                        width="15"
                        height="15"
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
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {isPlaceholder ? (
          <p className="site-nearby-note">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="12" cy="10" r="3" />
              <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" />
            </svg>
            Sample selection — the final list is generated from real places near
            this property.
          </p>
        ) : null}
      </div>
    </section>
  );
}
