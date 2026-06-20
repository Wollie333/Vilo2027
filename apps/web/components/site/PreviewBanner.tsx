"use client";

import { Eye, X } from "lucide-react";
import { useCallback } from "react";

/**
 * Black preview banner shown at the top of the site when in preview mode.
 * Shows the host they're viewing a draft preview, with an exit button.
 * Also provides the buildPreviewHref helper for nav links to preserve params.
 */
export function PreviewBanner({
  themeSlug,
}: {
  subdomain: string;
  themeSlug?: string;
}) {
  // Build the exit URL — go to the dashboard website editor
  const exitHref = `/dashboard/website`;

  return (
    <div className="relative z-50 flex items-center justify-between gap-4 bg-[#0A0A0A] px-4 py-2.5 text-white">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
          <Eye className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium">
          Preview Mode
          {themeSlug ? (
            <span className="ml-1.5 text-white/60">
              — {themeSlug.charAt(0).toUpperCase() + themeSlug.slice(1)} theme
            </span>
          ) : null}
        </span>
      </div>
      <a
        href={exitHref}
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium transition hover:bg-white/20"
      >
        <X className="h-3.5 w-3.5" />
        Exit Preview
      </a>
    </div>
  );
}

/**
 * Hook to build preview-aware hrefs for navigation. Preserves preview and
 * theme query params when navigating between pages in preview mode.
 */
export function usePreviewNavigation(subdomain: string, themeSlug?: string) {
  const buildHref = useCallback(
    (path: string) => {
      // For external links, return as-is
      if (path.startsWith("http")) return path;

      // Build the preview URL with query params preserved
      const params = new URLSearchParams();
      params.set("site", subdomain);
      params.set("preview", "1");
      if (themeSlug) params.set("theme", themeSlug);

      // Normalize path
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      const basePath = cleanPath === "/" ? "/site" : `/site${cleanPath}`;

      return `${basePath}?${params.toString()}`;
    },
    [subdomain, themeSlug],
  );

  return { buildHref };
}
