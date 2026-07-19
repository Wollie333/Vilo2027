"use client";

import { useEffect, useState } from "react";
import type { SiteSocials } from "@/lib/site/types";

/**
 * SiteSocialRail — a slim, floating vertical social bar fixed to the LEFT edge
 * of the viewport, vertically centred. It holds round social icon buttons and a
 * chevron tab that collapses/expands the rail (sliding it mostly off-screen so
 * only the tab peeks). Shared across ALL host-site themes: every colour is
 * driven by `--site-*` tokens, so it reads correctly on light (Marmalade cream)
 * and dark (Sabela ebony) skins with the same CSS.
 *
 * It floats OVER page content (never pushes layout) and renders nothing when no
 * socials are set.
 */

type SocialKey = keyof SiteSocials;

const ORDER: SocialKey[] = [
  "youtube",
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "website",
];

const LABELS: Record<SocialKey, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
  website: "Website",
};

function Icon({ name }: { name: SocialKey }) {
  switch (name) {
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M23.5 6.9a3 3 0 0 0-2.1-2.1C19.5 4.3 12 4.3 12 4.3s-7.5 0-9.4.5A3 3 0 0 0 .5 6.9 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.1 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.1ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z"
          />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5.1 21H2l7.3-8.3L2.4 3h6.4l4.4 5.9L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z"
          />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M20.4 3H3.6A.6.6 0 0 0 3 3.6v16.8a.6.6 0 0 0 .6.6h16.8a.6.6 0 0 0 .6-.6V3.6a.6.6 0 0 0-.6-.6ZM8.3 18.3H5.6V9.7h2.7v8.6ZM7 8.5a1.6 1.6 0 1 1 0-3.1 1.6 1.6 0 0 1 0 3.1Zm11.3 9.8h-2.7v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3h-2.7V9.7h2.6v1.2h.1a2.9 2.9 0 0 1 2.6-1.4c2.8 0 3.3 1.8 3.3 4.2v4.6Z"
          />
        </svg>
      );
    case "website":
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3Z" />
        </svg>
      );
  }
}

export function SiteSocialRail({ socials }: { socials?: SiteSocials | null }) {
  const [collapsed, setCollapsed] = useState(false);

  // Start collapsed on narrow screens so the rail never sits over content on
  // first paint. Runs once after mount (SSR-safe); the user can toggle after.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 640px)").matches) setCollapsed(true);
  }, []);

  const links = ORDER.map((key) => ({
    key,
    url: socials?.[key]?.trim() ?? "",
  })).filter((item) => item.url.length > 0);

  if (links.length === 0) return null;

  const socialLinks = links.filter((item) => item.key !== "website");
  const websiteLink = links.find((item) => item.key === "website");

  return (
    <div
      className="site-social-rail"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="ssr-rail" aria-hidden={collapsed ? "true" : "false"}>
        {socialLinks.map((item) => (
          <a
            key={item.key}
            className="ssr-btn"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={LABELS[item.key]}
            tabIndex={collapsed ? -1 : 0}
          >
            <Icon name={item.key} />
          </a>
        ))}
        {websiteLink ? (
          <>
            {socialLinks.length > 0 ? <span className="ssr-divider" /> : null}
            <a
              className="ssr-btn"
              href={websiteLink.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={LABELS.website}
              tabIndex={collapsed ? -1 : 0}
            >
              <Icon name="website" />
            </a>
          </>
        ) : null}
      </div>

      <button
        type="button"
        className="ssr-tab"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={collapsed ? "false" : "true"}
        aria-label={collapsed ? "Show social links" : "Hide social links"}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      <style>{`
        .site-social-rail {
          position: fixed;
          left: 0;
          top: 50%;
          z-index: 60;
          display: flex;
          align-items: stretch;
          padding-left: env(safe-area-inset-left, 0px);
          transform: translateY(-50%);
          transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
          --ssr-rail-w: 52px;
        }
        .site-social-rail[data-collapsed="true"] {
          transform: translate(calc(-1 * var(--ssr-rail-w)), -50%);
        }
        .site-social-rail > * {
          pointer-events: auto;
        }

        .ssr-rail {
          width: var(--ssr-rail-w);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 8px 6px;
          background: var(--site-surface, #fff);
          border: 1px solid var(--site-line, rgba(0, 0, 0, 0.1));
          border-left: none;
          border-radius: 0 var(--site-radius, 14px) var(--site-radius, 14px) 0;
          box-shadow: 0 8px 30px -12px rgba(0, 0, 0, 0.45);
        }

        .ssr-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          color: var(--site-ink, #1a1a1a);
          text-decoration: none;
          transition:
            color 0.18s ease,
            background-color 0.18s ease,
            transform 0.18s ease;
        }
        .ssr-btn svg {
          width: 18px;
          height: 18px;
          display: block;
        }
        .ssr-btn:hover,
        .ssr-btn:focus-visible {
          color: var(--site-accent, #c65a2e);
          background: color-mix(
            in srgb,
            var(--site-accent, #c65a2e) 14%,
            transparent
          );
          transform: translateY(-1px);
          outline: none;
        }
        .ssr-btn:focus-visible {
          box-shadow: 0 0 0 2px var(--site-accent, #c65a2e);
        }

        .ssr-divider {
          width: 20px;
          height: 1px;
          margin: 2px 0;
          background: var(--site-line, rgba(0, 0, 0, 0.12));
        }

        .ssr-tab {
          align-self: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 46px;
          margin: 0;
          padding: 0;
          border: 1px solid var(--site-line, rgba(0, 0, 0, 0.1));
          border-left: none;
          border-radius: 0 var(--site-radius, 14px) var(--site-radius, 14px) 0;
          background: var(--site-accent, #c65a2e);
          color: var(--site-accent-ink, #fff);
          cursor: pointer;
          box-shadow: 0 8px 30px -12px rgba(0, 0, 0, 0.45);
          transition: filter 0.18s ease;
        }
        .ssr-tab:hover,
        .ssr-tab:focus-visible {
          filter: brightness(1.06);
          outline: none;
        }
        .ssr-tab:focus-visible {
          box-shadow: 0 0 0 2px var(--site-accent, #c65a2e);
        }
        .ssr-tab svg {
          width: 15px;
          height: 15px;
          display: block;
          transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .site-social-rail[data-collapsed="true"] .ssr-tab svg {
          transform: rotate(180deg);
        }

        @media (max-width: 640px) {
          .site-social-rail {
            --ssr-rail-w: 46px;
          }
          .ssr-btn {
            width: 40px;
            height: 40px;
          }
          .ssr-rail {
            gap: 4px;
            padding: 6px 3px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .site-social-rail,
          .ssr-tab svg,
          .ssr-btn {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
