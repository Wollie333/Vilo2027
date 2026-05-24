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
];

export function sanitiseListingHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    allowedSchemes: [],
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
