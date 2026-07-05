"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** Nearest ACTUALLY-scrollable ancestor (the builder canvas scrolls a container;
 *  the live site scrolls the window). Requires both a scrolling overflow AND real
 *  overflow (scrollHeight > clientHeight) so a wrapper with `overflow-x:hidden`
 *  (whose computed `overflow-y` becomes `auto` but never scrolls) isn't mistaken
 *  for the scroller. Returns null → use the window. */
function scrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const s = getComputedStyle(el);
    if (
      /(auto|scroll|overlay)/.test(`${s.overflowY} ${s.overflow}`) &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

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
  scrolledShadow,
  scrolledShadowColor,
  scrolledShadowSize,
  borderColor,
  borderWidth,
  trackScroll,
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
  /** Cast a drop-shadow once the header lifts off (scrolled / solid sticky bar). */
  scrolledShadow?: boolean | null;
  /** Shadow colour; blank → a soft black. */
  scrolledShadowColor?: string | null;
  /** Shadow blur (px); blank → 18. */
  scrolledShadowSize?: number | null;
  /** Solid-header bottom border colour; blank → theme hairline. */
  borderColor?: string | null;
  /** Solid-header bottom border width (px); blank → 1. */
  borderWidth?: number | null;
  /** Track scroll (toggle [data-scrolled]) even on a solid bar — set when ANY
   *  scrolled-state styling exists (scrolled menu colour, bg, border, shadow), so
   *  those styles actually take effect on scroll. */
  trackScroll?: boolean;
  /** Header text/menu colour (the host's menu colour). Drives logo + menu so it
   *  stays legible on a custom/transparent background. Blank → sensible default. */
  textColor?: string | null;
  /** Push the sticky/fixed header down by N px (the theme-preview bar height). */
  topOffset?: number;
  children: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Track scroll when the header transitions on scroll: a transparent bar always
  // does (fade to solid); a solid bar does when it has ANY scrolled-state styling
  // (menu colour / bg / border / shadow) so those styles actually apply.
  const wantsScroll =
    transparent || (sticky && !!(scrolledShadow || trackScroll));
  useEffect(() => {
    if (!wantsScroll) return;
    // The scroller is the window on the live site, or the canvas container in the
    // builder. Listen to BOTH (and read whichever actually moved) so the scrolled
    // state fires regardless of which one owns the scroll — robust to wrappers.
    const scroller = scrollParent(headerRef.current);
    const read = () => {
      const top = Math.max(
        scroller ? scroller.scrollTop : 0,
        window.scrollY || 0,
        document.documentElement.scrollTop || 0,
      );
      setScrolled(top > 24);
    };
    read();
    const targets: Array<Window | HTMLElement> = scroller
      ? [scroller, window]
      : [window];
    for (const t of targets)
      t.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      for (const t of targets) t.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [wantsScroll]);

  const text = textColor?.trim();
  // The lift shadow, applied once scrolled (when enabled).
  const liftShadow =
    scrolledShadow && scrolled
      ? `0 4px ${scrolledShadowSize ?? 18}px 0 ${
          scrolledShadowColor?.trim() || "rgba(0,0,0,0.22)"
        }`
      : undefined;

  if (!transparent) {
    // Solid bar. A custom background → drive the text colour too (so e.g. a black
    // bar gets a readable menu/logo) — text wins via the host's menu colour.
    const customBg = bgColor?.trim();
    const scrolledBg = scrolledBgColor?.trim();
    const scrolledBorder = scrolledBorderColor?.trim();
    // Once scrolled, a solid bar swaps to its scrolled background/border (when the
    // host set one) — so the scrolled state is visible on a normal solid header,
    // not only on a transparent-over-hero one.
    const style: CSSProperties = {
      background: (scrolled && scrolledBg) || customBg || "var(--site-surface)",
      borderColor:
        (scrolled && scrolledBorder) ||
        borderColor?.trim() ||
        scrolledBorder ||
        "var(--site-line)",
      ...(borderWidth != null ? { borderBottomWidth: borderWidth } : null),
      ...(liftShadow ? { boxShadow: liftShadow } : null),
      ...(topOffset ? { top: topOffset } : null),
      transition:
        "background-color .25s ease, border-color .25s ease, box-shadow .25s ease",
    };
    if (text) {
      (style as Record<string, string>)["--site-ink"] = text;
      (style as Record<string, string>)["--site-mute"] = text;
    }
    return (
      <header
        ref={headerRef}
        data-scrolled={scrolled ? "true" : "false"}
        style={style}
        className={
          sticky ? "sticky top-0 z-20 border-b transition-shadow" : "border-b"
        }
      >
        {children}
      </header>
    );
  }

  // Transparent over the hero, fading to a solid background on scroll. Text
  // defaults to white (legible over a hero photo) but the host's menu colour wins.
  return (
    <header
      ref={headerRef}
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
          ...(liftShadow ? { boxShadow: liftShadow } : null),
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
