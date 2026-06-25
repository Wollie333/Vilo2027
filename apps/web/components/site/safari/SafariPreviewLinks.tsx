"use client";

import { useEffect } from "react";

/**
 * Keeps the theme PREVIEW navigable. The theme gallery opens the Safari design at
 * `/{locale}/site?site=<sub>&preview=1&theme=safari`, but the design's internal
 * links are tenant-relative (`/rooms`, `/about`) — on the app domain those would
 * break out of the preview. While previewing, this intercepts clicks on internal
 * links and rewrites them to keep the `/{locale}/site` prefix + the
 * site/preview/theme params, so the host can click through every page and keep
 * seeing the design. On a live (activated) site there are no preview params, so
 * it does nothing and links behave normally.
 */
export function SafariPreviewLinks() {
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("preview") !== "1") return;

    // Params to carry across navigations.
    const keep = new URLSearchParams();
    for (const k of ["site", "preview", "theme"]) {
      const v = sp.get(k);
      if (v) keep.set(k, v);
    }

    // The site prefix the preview is served under — with or without a locale
    // segment (next-intl omits the default locale, so it can be `/site` or
    // `/en/site`).
    const m = window.location.pathname.match(/^(\/(?:[^/]+\/)?site)(?:\/|$)/);
    const prefix = m ? m[1] : "";

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey)
        return;
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a");
      if (!a) return;
      const raw = a.getAttribute("href") || "";
      // Internal paths only — skip external, hash and protocol-relative links.
      if (!raw.startsWith("/") || raw.startsWith("//")) return;

      const [pathAndQuery, hash] = raw.split("#");
      const [rawPath, rawQuery] = pathAndQuery.split("?");
      // Don't double-prefix links that are ALREADY a site path — with or without
      // a locale segment (e.g. the book CTA emits `/en/site/book` while the page
      // is served at `/site`). Only bare tenant paths (`/rooms`) get the prefix.
      const isSitePath = /^\/(?:[^/]+\/)?site(?:\/|$)/.test(rawPath);
      const path = isSitePath
        ? rawPath
        : `${prefix}${rawPath === "/" ? "" : rawPath}`;

      const merged = new URLSearchParams(rawQuery || "");
      for (const [k, v] of keep) merged.set(k, v);

      e.preventDefault();
      window.location.assign(
        `${path || "/"}?${merged.toString()}${hash ? `#${hash}` : ""}`,
      );
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
