import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "br",
  "hr",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "code",
  "pre",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  // Layout primitives for rich, design-system-styled articles. Safe to allow:
  // they carry no script vector. `class` is whitelisted below so articles can
  // opt into the scoped `.help-article .hc-*` components; `style` stays banned.
  "div",
  "span",
];

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    // `class` on any tag drives the scoped `.hc-*` styling. `style` is never
    // allowed, so this stays XSS-safe (no CSS-based exfil / expression vector).
    "*": ["class"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height", "loading"],
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "noopener noreferrer",
        target: attribs.href?.startsWith("http") ? "_blank" : "_self",
      },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: attribs.loading ?? "lazy" },
    }),
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
};

export function sanitizeHelpHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, sanitizeOptions);
}
