import type { Metadata } from "next";

import { resolveSiteRef, loadSiteMeta } from "./loadSitePage";

// Shared `generateMetadata` for the public micro-site routes (W14). Reads the
// site host header / `?site` param, resolves the SEO config (page override →
// site SEO → brand fallback), and builds the Next Metadata — title/description,
// Open Graph/Twitter cards, the robots index flag and the Google Search Console
// verification token.

export async function siteMetadata(args: {
  host?: string | null;
  siteParam?: string | null;
  pathSlug?: string[];
  postSlug?: string;
  preview?: boolean;
}): Promise<Metadata> {
  const ref = resolveSiteRef({ host: args.host, siteParam: args.siteParam });
  if (!ref) return {};

  const meta = await loadSiteMeta(ref, args.pathSlug ?? [], {
    preview: args.preview,
    postSlug: args.postSlug,
  });
  if (!meta) return {};

  // Never let an unpublished preview leak into a search index.
  const index = meta.robotsIndex && !args.preview;
  const ogImages = meta.ogImageUrl ? [{ url: meta.ogImageUrl }] : undefined;

  return {
    title: meta.title,
    description: meta.description,
    icons:
      meta.faviconUrl || meta.appleIconUrl
        ? {
            icon: meta.faviconUrl || undefined,
            apple: meta.appleIconUrl || undefined,
          }
        : undefined,
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: meta.title,
      description: meta.description,
      images: ogImages,
      type: "website",
    },
    twitter: {
      card: ogImages ? "summary_large_image" : "summary",
      title: meta.title,
      description: meta.description,
      images: meta.ogImageUrl ? [meta.ogImageUrl] : undefined,
    },
    verification: meta.gscToken ? { google: meta.gscToken } : undefined,
  };
}
