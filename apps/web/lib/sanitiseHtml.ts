import "server-only";

import DOMPurify from "isomorphic-dompurify";

// Allowed tags + attributes for listing descriptions. Tiptap StarterKit
// produces a subset of these — anything outside this allowlist is stripped
// before render, defending the public listing page against XSS even if
// someone bypasses the editor and writes HTML straight into the DB.
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
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

// Strip every tag → plain text. Used for SEO meta descriptions and any
// surface that can't render HTML (push notifications, email subject lines).
export function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, " ")
    .trim();
}
