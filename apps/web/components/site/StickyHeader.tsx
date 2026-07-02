"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Site header shell. Normally a solid (optionally sticky) bar. When
 * `transparent` (transparent-over-hero) is on it overlays the first section as a
 * fixed, transparent bar with light text, then fades to a solid dark bar on
 * scroll — so the header stays readable in both states without flipping the logo.
 * Client-only for the scroll listener; the header content is passed as children.
 */
export function StickyHeader({
  sticky,
  transparent,
  bgColor,
  scrolledBgColor,
  scrolledBorderColor,
  textColor,
  topOffset = 0,
  children,
}: {
  sticky: boolean;
  transparent: boolean;
  /** Solid header background; blank → theme surface. */
  bgColor?: string | null;
  /** Background once scrolled (transparent mode); blank → theme ink (dark). */
  scrolledBgColor?: string | null;
  /** Bottom-border colour of the solid/scrolled bar; blank → theme hairline. */
  scrolledBorderColor?: string | null;
  /** Header text/menu colour (the host's menu colour). Drives logo + menu so it
   *  stays legible on a custom/transparent background. Blank → sensible default. */
  textColor?: string | null;
  /** Push the sticky/fixed header down by N px (the theme-preview bar height). */
  topOffset?: number;
  children: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  const text = textColor?.trim();

  if (!transparent) {
    // Solid bar. A custom background → drive the text colour too (so e.g. a black
    // bar gets a readable menu/logo) — text wins via the host's menu colour.
    const customBg = bgColor?.trim();
    const style: CSSProperties = {
      background: customBg || "var(--site-surface)",
      borderColor: scrolledBorderColor?.trim() || "var(--site-line)",
      ...(topOffset ? { top: topOffset } : null),
    };
    if (text) {
      (style as Record<string, string>)["--site-ink"] = text;
      (style as Record<string, string>)["--site-mute"] = text;
    }
    return (
      <header
        style={style}
        className={sticky ? "sticky top-0 z-20 border-b" : "border-b"}
      >
        {children}
      </header>
    );
  }

  // Transparent over the hero, fading to a solid background on scroll. Text
  // defaults to white (legible over a hero photo) but the host's menu colour wins.
  return (
    <header
      // The menu's scrolled-state colours (menuStyle.scrolledColor/…) key off this.
      data-scrolled={scrolled ? "true" : "false"}
      style={
        {
          background: scrolled
            ? scrolledBgColor?.trim() || "var(--site-ink)"
            : "transparent",
          borderColor: scrolled
            ? scrolledBorderColor?.trim() || "rgba(255,255,255,0.12)"
            : "transparent",
          "--site-ink": text || "#ffffff",
          "--site-mute": text || "rgba(255,255,255,0.88)",
          ...(topOffset ? { top: `${topOffset}px` } : null),
        } as CSSProperties
      }
      className="fixed inset-x-0 top-0 z-20 border-b transition-colors"
    >
      {children}
    </header>
  );
}
