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
  roomSlug?: string;
  preview?: boolean;
}): Promise<Metadata> {
  const ref = resolveSiteRef({ host: args.host, siteParam: args.siteParam });
  if (!ref) return {};

  const meta = await loadSiteMeta(ref, args.pathSlug ?? [], {
    preview: args.preview,
    postSlug: args.postSlug,
    roomSlug: args.roomSlug,
  });
  if (!meta) return {};

  // Never let an unpublished preview leak into a search index.
  const index = meta.robotsIndex && !args.preview;
  const ogImages = meta.ogImageUrl ? [{ url: meta.ogImageUrl }] : undefined;

  // Canonical URL from the tenant host + path (skip preview and ?site= testing).
  const host = args.host?.trim().toLowerCase();
  let canonical: string | undefined;
  if (host && !args.preview) {
    const scheme =
      host.startsWith("localhost") || host.startsWith("127.")
        ? "http"
        : "https";
    const path = args.roomSlug
      ? `/rooms/${args.roomSlug}`
      : args.postSlug
        ? `/blog/${args.postSlug}`
        : args.pathSlug && args.pathSlug.length
          ? `/${args.pathSlug.join("/")}`
          : "";
    canonical = `${scheme}://${host}${path}`;
  }

  return {
    title: meta.title,
    description: meta.description,
    alternates: canonical ? { canonical } : undefined,
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
