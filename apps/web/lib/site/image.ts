// Supabase image-transform helpers for the public tenant site (Phase 7c).
//
// Every `website-assets` object can be served through Supabase's on-the-fly
// image transformer (`/render/image/...`), which resizes to the requested width
// and negotiates a modern format (WebP/AVIF) from the browser's Accept header.
// That gives device-sized, lazily-loaded, modern-format images WITHOUT depending
// on Next's image optimizer — important because tenant sites render on their own
// custom domains where `/_next/image` is not the right origin.
//
// `siteImageUrl` rewrites a public object URL to its transformed variant. It is a
// no-op for anything we can't transform: non-project URLs (sample/preview data,
// already-absolute externals) and SVGs (vector — nothing to resize, and the
// transformer rejects them). Safe on client + server (reads only NEXT_PUBLIC_*).

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ?? "";
const OBJECT_MARK = "/storage/v1/object/public/";
const RENDER_MARK = "/storage/v1/render/image/public/";
const OBJECT_PREFIX = SUPA ? `${SUPA}${OBJECT_MARK}` : "";

/** A project-hosted, raster (non-SVG) public object — the only thing we resize. */
function transformable(url: string): boolean {
  if (!OBJECT_PREFIX) return false;
  if (!url.startsWith(OBJECT_PREFIX)) return false;
  if (/\.svg(\?|#|$)/i.test(url)) return false;
  return true;
}

export type SiteImageOpts = {
  /** Target render width in CSS px (the transformer scales proportionally). */
  width?: number;
  /** Optional explicit height (only set with a `resize` mode for a hard crop). */
  height?: number;
  /** Crop behaviour when both width + height are set. */
  resize?: "cover" | "contain" | "fill";
  /** 20–100; lower = smaller file. Default 72 (a good photo sweet-spot). */
  quality?: number;
};

/**
 * Resolve a public asset URL to a transformed (resized + modern-format) URL.
 * Returns the input unchanged when it isn't a transformable project object.
 */
export function siteImageUrl(
  url: string | null | undefined,
  opts: SiteImageOpts = {},
): string {
  if (!url) return "";
  if (!transformable(url)) return url;
  const tail = url.slice(OBJECT_PREFIX.length); // "website-assets/<path>"
  const q = new URLSearchParams();
  if (opts.width) q.set("width", String(Math.round(opts.width)));
  if (opts.height) q.set("height", String(Math.round(opts.height)));
  if (opts.resize) q.set("resize", opts.resize);
  q.set("quality", String(opts.quality ?? 72));
  return `${SUPA}${RENDER_MARK}${tail}?${q.toString()}`;
}

/** Default candidate widths for a responsive `srcset`. */
export const SITE_IMAGE_WIDTHS = [
  320, 480, 640, 768, 1024, 1280, 1600,
] as const;

/**
 * Build a `srcset` of transformed variants. Empty string when the URL can't be
 * transformed (so the caller falls back to a plain `src` with no srcset).
 */
export function siteImageSrcSet(
  url: string | null | undefined,
  widths: readonly number[] = SITE_IMAGE_WIDTHS,
  quality?: number,
): string {
  if (!url || !transformable(url)) return "";
  return widths
    .map((w) => `${siteImageUrl(url, { width: w, quality })} ${w}w`)
    .join(", ");
}
