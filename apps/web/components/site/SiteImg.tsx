import type { CSSProperties } from "react";

import {
  SITE_IMAGE_WIDTHS,
  siteImageSrcSet,
  siteImageUrl,
} from "@/lib/site/image";

/**
 * The one `<img>` for the public tenant site (Phase 7c). Serves a responsive,
 * modern-format, device-sized image through Supabase transforms (see
 * `lib/site/image`), lazy by default. Non-transformable sources (externals,
 * SVGs) fall back to a plain `<img>` automatically.
 *
 * No "use client"/"server-only" directive — it's a pure presentational `<img>`
 * with no hooks, so it renders inside both the server sections AND the client
 * gallery lightbox. Pass `sizes` so the browser can pick the right srcset entry;
 * pass `priority` for above-the-fold images (eager + high fetch priority).
 */
export function SiteImg({
  src,
  alt,
  title,
  className,
  style,
  sizes = "100vw",
  widths = SITE_IMAGE_WIDTHS,
  width,
  height,
  quality,
  priority = false,
}: {
  src?: string | null;
  alt: string;
  /** Optional `title` attribute (tooltip / extra SEO hint). */
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** Responsive `sizes` hint (CSS lengths) — drives srcset selection. */
  sizes?: string;
  /** Candidate widths for the generated srcset. */
  widths?: readonly number[];
  /** Intrinsic width/height attributes — set when known to reserve space (CLS). */
  width?: number;
  height?: number;
  quality?: number;
  priority?: boolean;
}) {
  if (!src) return null;
  const maxWidth = widths[widths.length - 1];
  const resolved = siteImageUrl(src, { width: maxWidth, quality });
  const srcSet = siteImageSrcSet(src, widths, quality);
  // `fetchpriority` (lowercase) is passed through to the DOM verbatim — React
  // doesn't know the camelCase variant, so use the HTML attribute name.
  const extra: Record<string, string> = priority
    ? { fetchpriority: "high" }
    : {};
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      title={title || undefined}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
      {...extra}
    />
  );
}
