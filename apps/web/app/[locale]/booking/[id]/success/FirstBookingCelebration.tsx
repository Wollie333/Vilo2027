"use client";

import { PartyPopper, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useBrandName } from "@/components/brand/BrandProvider";

/**
 * One-time "your FIRST booking" celebration — a congratulations modal with the
 * same confetti the signup thank-you step uses (the global `.wielo-confetti-piece`
 * / `@keyframes wielo-confetti-fall` in globals.css). Rendered by
 * BookingConfirmation ONLY when the server has determined this is the guest's
 * first confirmed booking AND atomically stamped the "celebrated" flag, so it
 * can never re-fire on a refresh or revisit.
 */

// Mirror of the signup Confetti() — 60 brand-coloured pieces falling once on
// mount (CSS `forwards`). Kept in sync with signup/host/Wizard.tsx by design.
function Confetti() {
  const pieces = useMemo(() => {
    const colors = [
      "#10B981",
      "#064E3B",
      "#D1FAE5",
      "#34D399",
      "#A7F3D0",
      "#F4A836",
    ];
    return Array.from({ length: 60 }).map((_, i) => ({
      left: Math.random() * 100,
      dx: `${Math.random() * 200 - 100}px`,
      d: `${(3 + Math.random() * 2.5).toFixed(2)}s`,
      delay: `${(Math.random() * 1.2).toFixed(2)}s`,
      bg: colors[i % colors.length],
      rot: Math.random() * 180,
    }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="wielo-confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.bg,
              transform: `rotate(${p.rot}deg)`,
              ["--dx" as never]: p.dx,
              ["--d" as never]: p.d,
              ["--delay" as never]: p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function FirstBookingCelebration({
  guestFirstName,
}: {
  guestFirstName: string;
}) {
  const brandName = useBrandName();
  const [open, setOpen] = useState(true);

  // Close on Escape, and lock body scroll while the celebration is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const name =
    guestFirstName && guestFirstName !== "there" ? guestFirstName : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="First booking celebration"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm"
      />
      {/* confetti rains over the whole viewport, above the backdrop */}
      <Confetti />

      <div className="relative w-full max-w-md overflow-hidden rounded-[20px] bg-white p-8 text-center shadow-lift">
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full text-brand-mute transition hover:bg-brand-light hover:text-brand-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent">
          <PartyPopper className="h-8 w-8 text-brand-primary" />
        </span>

        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-primary">
          Your first booking
        </p>
        <h2 className="mt-2 font-display text-[26px] font-bold leading-tight text-brand-ink">
          {name ? `Congratulations, ${name}! 🎉` : "Congratulations! 🎉"}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-brand-mute">
          You just made your very first booking on {brandName}. Here&apos;s to
          the first of many stays — everything you need is right below.
        </p>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-6 inline-flex w-full items-center justify-center rounded-pill bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-secondary"
        >
          View my booking
        </button>
      </div>
    </div>
  );
}
