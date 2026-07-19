"use client";

import { useEffect } from "react";

import "./site-reveal.css";

/**
 * Shared, dependency-free MOTION runtime for the public tenant sites — the one
 * primitive every theme's scroll-in animation set is built on (Phase A of the
 * theme-differentiation plan). Two effects, both compositor-only and tiny:
 *
 *  1. Scroll-reveal — an IntersectionObserver adds `.in` to `[data-reveal]`
 *     elements as they enter the viewport (unobserving after), so each theme's
 *     scoped `--reveal-*` signature (rise/blur/settle) plays once. Elements
 *     already in view on mount reveal on the next frame (clean load-in), and a
 *     2.3s safety timer force-reveals anything still hidden (mirrors the
 *     reference `royal.js`) so content can never get stuck invisible.
 *  2. Parallax — a single rAF-throttled scroll handler translates
 *     `[data-parallax]` elements by `scrollY * factor`.
 *
 * Motion is OPT-IN via the `wielo-reveal-ready` class this runtime adds to the
 * `.wielo-site-root`: the reveal CSS only hides `[data-reveal]` under that class.
 * So with reduced-motion, no JS, or SSR-before-hydration, nothing is ever hidden
 * → zero CLS and no flash of missing content. It also no-ops entirely inside the
 * page builder (`.wielo-builder`) so editing stays static.
 */
export function SiteReveal() {
  useEffect(() => {
    // Never animate inside the builder canvas — editing must stay static.
    if (document.querySelector(".wielo-builder")) return;
    if (typeof IntersectionObserver === "undefined") return;

    const root = document.querySelector<HTMLElement>(".wielo-site-root");
    if (!root) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const cleanups: Array<() => void> = [];

    // ── Scroll-reveal (motion allowed only) ──────────────────────────────────
    if (!reduce) {
      root.classList.add("wielo-reveal-ready");
      const els = Array.from(
        root.querySelectorAll<HTMLElement>("[data-reveal]"),
      );
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
      );

      // Reveal on the next frame so above-the-fold items animate in on load
      // instead of appearing already-shown (the ready class + `.in` must land
      // on separate frames for the transition to run).
      const raf = requestAnimationFrame(() => {
        const vh = window.innerHeight || document.documentElement.clientHeight;
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.top < vh * 0.95 && r.bottom > 0) el.classList.add("in");
          else io.observe(el);
        }
      });

      // Safety net — never leave anything stuck hidden.
      const safety = window.setTimeout(() => {
        for (const el of els) el.classList.add("in");
      }, 2300);

      cleanups.push(() => {
        cancelAnimationFrame(raf);
        window.clearTimeout(safety);
        io.disconnect();
      });
    }

    // ── Parallax (motion allowed only) ───────────────────────────────────────
    if (!reduce) {
      const px = Array.from(
        root.querySelectorAll<HTMLElement>("[data-parallax]"),
      );
      if (px.length) {
        let ticking = false;
        const run = () => {
          const y = window.scrollY;
          for (const el of px) {
            const f = parseFloat(el.dataset.parallax || "0.15") || 0.15;
            el.style.transform = `translate3d(0, ${(y * f).toFixed(2)}px, 0)`;
          }
          ticking = false;
        };
        const onScroll = () => {
          if (!ticking) {
            requestAnimationFrame(run);
            ticking = true;
          }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        run();
        cleanups.push(() => window.removeEventListener("scroll", onScroll));
      }
    }

    return () => {
      for (const fn of cleanups) fn();
      root.classList.remove("wielo-reveal-ready");
    };
  }, []);

  return null;
}
