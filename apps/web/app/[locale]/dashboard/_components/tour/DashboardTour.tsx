"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Link } from "@/i18n/navigation";

import { TOUR_STEPS, type TourPlacement } from "./steps";
import { markTourDone, onStartTour } from "./tourBus";

const PAD = 8; // spotlight padding around the target
const GAP = 16; // tooltip gap from the target
const TIP_W = 320;

/** Position the tooltip card next to the spotlight, clamped to the viewport. */
function tipStyle(
  rect: DOMRect | null,
  placement: TourPlacement,
): React.CSSProperties {
  if (!rect) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (placement === "right") {
    let left = rect.right + GAP;
    if (left + TIP_W > vw - 12) left = Math.max(12, rect.left - GAP - TIP_W);
    const top = Math.max(12, Math.min(rect.top, vh - 240));
    return { left, top };
  }
  // bottom
  let left = rect.left;
  if (left + TIP_W > vw - 12) left = Math.max(12, vw - 12 - TIP_W);
  let top = rect.bottom + GAP;
  if (top + 220 > vh) top = Math.max(12, rect.top - GAP - 220);
  return { left, top };
}

export function DashboardTour() {
  const t = useTranslations("tour");
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const total = TOUR_STEPS.length;
  const step = TOUR_STEPS[i];

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setActive(false);
    markTourDone();
  }, []);

  const start = useCallback(() => {
    setI(0);
    setActive(true);
  }, []);

  // External launch requests only. The first-visit auto-start was removed — the
  // tour no longer pops up on first login; it's launched manually via TourButton.
  useEffect(() => {
    const off = onStartTour(start);
    return () => off();
  }, [start]);

  // Measure the active step's anchor and keep it aligned on scroll/resize.
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const el = step.selector ? document.querySelector(step.selector) : null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // width/height 0 → element hidden (e.g. sidebar on mobile) → centered card.
      setRect(r.width === 0 && r.height === 0 ? null : r);
    };
    const el = step.selector ? document.querySelector(step.selector) : null;
    el?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
    measure();
    const t1 = window.setTimeout(measure, 260);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t1);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step]);

  // Keyboard controls.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setI((n) => Math.min(total - 1, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, total, close]);

  if (!mounted || !active) return null;

  const isLast = i === total - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel")}
    >
      {/* dim + spotlight cutout — clicking the dark area skips the tour */}
      <svg className="absolute inset-0 h-full w-full" onClick={close}>
        <defs>
          <mask id="wielo-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect ? (
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx="12"
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(6,30,20,0.55)"
          mask="url(#wielo-tour-mask)"
        />
      </svg>

      {/* highlight ring around the target */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[12px] ring-2 ring-brand-primary"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : null}

      {/* tooltip card */}
      <div
        className="absolute w-[320px] max-w-[calc(100vw-24px)] rounded-card border border-brand-line bg-white p-5 shadow-card"
        style={tipStyle(rect, step.placement)}
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("skip")}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
          {t("step", { current: i + 1, total })}
        </div>
        <h3 className="mt-1.5 font-display text-[17px] font-bold leading-snug text-brand-ink">
          {t(`${step.key}Title`)}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-brand-mute">
          {t(`${step.key}Body`)}
        </p>

        {/* progress dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {TOUR_STEPS.map((s, idx) => (
            <span
              key={s.key}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-4 bg-brand-primary" : "w-1.5 bg-brand-line"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            className="text-[12.5px] font-medium text-brand-mute transition hover:text-brand-ink"
          >
            {t("skip")}
          </button>
          <div className="flex items-center gap-2">
            {i > 0 ? (
              <button
                type="button"
                onClick={() => setI((n) => Math.max(0, n - 1))}
                className="inline-flex h-9 items-center gap-1 rounded-pill border border-brand-line bg-white px-3.5 text-[12.5px] font-semibold text-brand-ink transition hover:bg-brand-light"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
              </button>
            ) : null}
            {isLast ? (
              <Link
                href="/dashboard/setup"
                onClick={close}
                className="inline-flex h-9 items-center gap-1 rounded-pill bg-brand-primary px-4 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary"
              >
                {t("finish")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setI((n) => Math.min(total - 1, n + 1))}
                className="inline-flex h-9 items-center gap-1 rounded-pill bg-brand-primary px-4 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary"
              >
                {t("next")} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
