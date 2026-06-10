"use client";

import { useEffect, useRef, useState } from "react";

/** Space-grouped thousands, SA-style: 11240 -> "11 240". */
function formatRand(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Floating "Commission saved" hero stat. Counts up from 0 to the real
 * platform-wide total when it scrolls into view, then keeps a soft pulse
 * to draw the eye. Honours prefers-reduced-motion (snaps to final value).
 */
export function CommissionSavedStat({ amount }: { amount: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced) {
      setDisplay(amount);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || ran.current) return;
        ran.current = true;

        const duration = 1600;
        let start: number | null = null;

        const tick = (now: number) => {
          if (start === null) start = now;
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          // easeOutExpo — fast then settle
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setDisplay(amount * eased);
          if (t < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);

  return (
    <div
      ref={ref}
      className="commission-stat absolute -right-3 -top-4 hidden w-[180px] rounded-card border border-brand-line bg-white p-3 shadow-lift sm:block md:-right-6"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        Commission saved
      </div>
      <div className="num-display mt-0.5 font-display text-2xl font-bold tabular-nums text-brand-primary">
        R {formatRand(display)}
      </div>
      <div className="mt-0.5 text-[10px] text-brand-mute">
        vs. OTA 15% · across every host
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-pill bg-brand-line">
        <div className="commission-stat__shimmer h-full w-full bg-brand-secondary" />
      </div>
    </div>
  );
}
