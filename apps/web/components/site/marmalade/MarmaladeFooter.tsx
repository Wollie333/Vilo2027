import "./marmaladeChrome.css";

import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from "lucide-react";

import { siteImageUrl } from "@/lib/site/image";
import { buildNavHref, hrefToPageKey } from "@/lib/site/navHref";
import type { SiteBrand, SiteMenuItem } from "@/lib/site/types";

type Preview = { subdomain: string; themeSlug?: string };

const SOCIAL_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  website: Globe,
} as const;

const WieloMark = (
  <svg width="15" height="15" viewBox="0 0 100 100" fill="none" aria-hidden>
    <rect width="100" height="100" rx="24" fill="#10B981" />
    <path
      d="M20 30 L36 72 L50 44 L64 72 L80 30"
      fill="none"
      stroke="#fff"
      strokeWidth="12"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Marmalade House bespoke FOOTER — the founder's reference footer ported class-
 * by-class (scoped `.mmchrome`). A warm dark band: brand (monogram + wordmark) +
 * blurb, an "Explore" link column from the live menu, a "Stay" column (book +
 * contact), a "Notes from the kitchen" keep-in-touch column (heading + blurb +
 * a real CTA to /contact — no dead email input), then a legal row with a
 * Powered-by-Wielo mark and social icons. Wired to the site's live brand + menu.
 * Pure presentational (server).
 */
export function MarmaladeFooter({
  brand,
  menu,
  bookHref,
  bookLabel,
  preview,
  copyright,
  showPoweredBy = true,
  blurb,
}: {
  brand: SiteBrand;
  menu: SiteMenuItem[];
  bookHref?: string;
  bookLabel?: string;
  preview?: Preview;
  copyright?: string | null;
  showPoweredBy?: boolean;
  /** Short description under the brand; omitted when absent. */
  blurb?: string | null;
}) {
  const initial =
    brand.monogram?.trim().slice(0, 2).toUpperCase() ||
    (brand.name || "·").trim().charAt(0).toUpperCase();
  const homeHref = buildNavHref("/", preview);
  const contactHref = buildNavHref("/contact", preview);
  const socialKeys = (
    Object.keys(SOCIAL_ICONS) as Array<keyof typeof SOCIAL_ICONS>
  ).filter((k) => brand.socials?.[k]);

  return (
    <div className="mmchrome">
      <footer className="footer">
        <div className="wrap">
          <div className="foot-top">
            <div>
              <a href={homeHref} className="brand" data-nav-page="home">
                <span className="bmark">
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl(brand.logoUrl, {
                        width: 120,
                        quality: 85,
                      })}
                      alt={brand.name}
                    />
                  ) : (
                    initial
                  )}
                </span>
                <span className="brand-name">{brand.name}</span>
              </a>
              {blurb ? <p className="foot-blurb">{blurb}</p> : null}
            </div>

            {menu.length > 0 ? (
              <div>
                <div className="foot-h">Explore</div>
                <div className="foot-col">
                  {menu.map((item) => (
                    <a
                      key={item.id}
                      href={buildNavHref(item.href, preview)}
                      target={item.newTab ? "_blank" : undefined}
                      rel={item.newTab ? "noopener noreferrer" : undefined}
                      data-nav-page={
                        item.href.startsWith("http")
                          ? undefined
                          : hrefToPageKey(item.href)
                      }
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="foot-h">Stay</div>
              <div className="foot-col">
                {bookHref ? (
                  <a href={bookHref}>{bookLabel?.trim() || "Book a room"}</a>
                ) : null}
                <a href={contactHref} data-nav-page="contact">
                  Contact
                </a>
              </div>
            </div>

            <div>
              <div className="foot-h">Notes from the kitchen</div>
              <p className="foot-blurb" style={{ marginTop: 0 }}>
                Open dates and the odd recipe. Once a month, never more.
              </p>
              <a
                href={contactHref}
                className="btn btn-accent btn-sm foot-cta"
                data-nav-page="contact"
              >
                Get in touch
              </a>
            </div>
          </div>

          <div className="foot-bottom">
            <span>{copyright?.trim() || `© ${brand.name}`}</span>
            {showPoweredBy ? (
              <span className="foot-vilo">
                {WieloMark}
                Powered by Wielo · 0% booking fees
              </span>
            ) : null}
            {socialKeys.length > 0 ? (
              <div className="foot-soc">
                {socialKeys.map((key) => {
                  const url = brand.socials?.[key];
                  if (!url) return null;
                  const Icon = SOCIAL_ICONS[key];
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer me"
                      aria-label={key}
                    >
                      <Icon width={17} height={17} strokeWidth={1.7} />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
