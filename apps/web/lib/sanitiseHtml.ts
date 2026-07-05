import "server-only";

import sanitizeHtml from "sanitize-html";

// Allowed tags + attributes for listing descriptions. Tiptap StarterKit
// produces a subset of these — anything outside this allowlist is stripped
// before render, defending the public listing page against XSS even if
// someone bypasses the editor and writes HTML straight into the DB.
//
// Uses `sanitize-html` (htmlparser2-based) rather than DOMPurify so we
// don't pull jsdom into the RSC bundle — that combination broke the Next
// build (phantom /browser stylesheet during page data collection).

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  // Blog post bodies can embed uploaded images (Phase 8). `src` is restricted to
  // http(s) below, so no javascript:/data: vectors slip through. Listing
  // descriptions never produce <img> (no image button), so this is additive.
  "img",
  // Links: the page-builder rich_text editor + blog editor can insert <a>.
  // Schemes are restricted to http(s)/mailto/tel below (relative + #anchor URLs
  // are allowed by sanitize-html's default relative-URL handling), and every
  // surviving link is forced to rel="noopener noreferrer nofollow" — so no
  // javascript: vector and no reverse-tabnabbing/SEO-leak through user links.
  "a",
];

export function sanitiseListingHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // `title` kept alongside `alt` so blog images keep their SEO/tooltip text.
      img: ["src", "alt", "title"],
      a: ["href", "target", "rel"],
    },
    disallowedTagsMode: "discard",
    allowedSchemes: [],
    allowedSchemesByTag: {
      img: ["http", "https"],
      a: ["http", "https", "mailto", "tel"],
    },
    transformTags: {
      // Harden every link the user inserts: external links open safely, and we
      // never pass link equity to arbitrary user-supplied destinations.
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  });
}

// Strip every tag → plain text. Used for SEO meta descriptions and any
// surface that can't render HTML (push notifications, email subject lines).
export function stripHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}
