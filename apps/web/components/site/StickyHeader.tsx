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
  children,
}: {
  sticky: boolean;
  transparent: boolean;
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

  if (!transparent) {
    return (
      <header
        style={{
          background: "var(--site-surface)",
          borderColor: "var(--site-line)",
        }}
        className={`${sticky ? "sticky top-0 z-20" : ""}border-b`}
      >
        {children}
      </header>
    );
  }

  return (
    <header
      style={
        {
          background: scrolled ? "var(--site-ink)" : "transparent",
          borderColor: scrolled ? "rgba(255,255,255,0.12)" : "transparent",
          // Header content is always rendered "dark" (light text + logo) when
          // transparent-over-hero is on, so it reads over both the hero and the
          // solid-dark scrolled state.
          "--site-ink": "#ffffff",
          "--site-mute": "rgba(255,255,255,0.88)",
        } as CSSProperties
      }
      className="fixed inset-x-0 top-0 z-20 border-b transition-colors"
    >
      {children}
    </header>
  );
}
