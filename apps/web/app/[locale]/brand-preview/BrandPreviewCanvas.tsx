"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SectionRenderer } from "@/components/site/SectionRenderer";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import type { BrandPreview } from "@/lib/site/loadBrandPreview";
import { siteSurfaceIsDark, type SiteThemeConfig } from "@/lib/site/themes";
import type { SiteBrand, SiteNavItem } from "@/lib/site/types";
import { websiteAssetUrl } from "@/lib/website/assets";

const asset = (p: string | null | undefined) => websiteAssetUrl(p) ?? undefined;

type Override = { theme: SiteThemeConfig; brand: SiteBrand; page: string };

/**
 * The Brand Studio live-preview canvas — runs inside the studio's preview
 * <iframe>. It renders the host's REAL pages through the public
 * `components/site/*` renderer, and overlays the studio's *draft* brand + theme
 * (pushed live via postMessage) so theming updates instantly while content stays
 * real. A real iframe gives a true responsive viewport for the device toggle.
 */
export function BrandPreviewCanvas({ preview }: { preview: BrandPreview }) {
  const [override, setOverride] = useState<Override | null>(null);

  const nav: SiteNavItem[] = useMemo(
    () => preview.pages.map((p) => ({ label: p.label, href: p.path })),
    [preview.pages],
  );

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: string } & Partial<Override>;
      if (d?.source === "vilo-brand-studio" && d.theme && d.brand) {
        setOverride({ theme: d.theme, brand: d.brand, page: d.page ?? "home" });
      }
    }
    window.addEventListener("message", onMsg);
    // Announce readiness + the page list so the studio can render its tabs.
    window.parent?.postMessage(
      {
        source: "vilo-brand-preview",
        type: "ready",
        pages: preview.pages.map((p) => ({
          key: p.key,
          label: p.label,
          path: p.path,
        })),
      },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMsg);
  }, [preview.pages]);

  const theme = override?.theme ?? preview.theme;
  const brand = override?.brand ?? preview.brand;
  const pageKey = override?.page;
  const page = preview.pages.find((p) => p.key === pageKey) ?? preview.pages[0];
  const containerRef = useRef<HTMLDivElement>(null);

  // Use event delegation to intercept nav link clicks and send them to the
  // parent Brand Studio instead of navigating — keeps the iframe on the same
  // URL while the studio switches pages.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest(
        "a[data-nav-page]",
      ) as HTMLAnchorElement | null;
      if (link) {
        e.preventDefault();
        const targetPage = link.dataset.navPage;
        if (targetPage) {
          window.parent?.postMessage(
            {
              source: "vilo-brand-preview",
              type: "navigate",
              page: targetPage,
            },
            window.location.origin,
          );
        }
      }
    }

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  if (!page) return <div className="min-h-screen bg-white" />;

  return (
    <div ref={containerRef}>
      <SiteThemeRoot theme={theme}>
        <SiteChrome
          brand={brand}
          nav={nav}
          bookHref="#"
          darkChrome={siteSurfaceIsDark(theme)}
          header={theme.header}
          footer={theme.footer}
        >
          <SectionRenderer
            sections={page.sections}
            data={page.data}
            asset={asset}
          />
        </SiteChrome>
      </SiteThemeRoot>
    </div>
  );
}
