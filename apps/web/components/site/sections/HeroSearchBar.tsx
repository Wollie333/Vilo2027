"use client";

import { useState } from "react";

import { ThemedDateRange } from "../ThemedDateRange";

// Inline search bar for the "Search" hero. Collects check-in / check-out /
// guests and, on the live site, deep-links into the booking flow at `href`
// (the hero's CTA link, default /explore) with from/to/guests query params —
// the real availability + pricing happen on the destination page. Inert in the
// builder preview (interactive=false) so editing never navigates away.
export function HeroSearchBar({
  href,
  onDark,
  interactive = false,
}: {
  href: string;
  onDark: boolean;
  interactive?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guests, setGuests] = useState("2");

  function go() {
    if (!interactive) return;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (guests) params.set("guests", guests);
    const sep = href.includes("?") ? "&" : "?";
    const qs = params.toString();
    window.location.href = qs ? `${href}${sep}${qs}` : href;
  }

  const fieldStyle = {
    background: "var(--site-surface)",
    border: "1px solid var(--site-line)",
    borderRadius: "var(--site-radius)",
    color: "var(--site-ink)",
  } as const;

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-[14px] p-3 sm:flex-row sm:items-end"
      style={{
        background: onDark ? "rgba(255,255,255,0.12)" : "var(--site-surface)",
        border: `1px solid ${onDark ? "rgba(255,255,255,0.25)" : "var(--site-line)"}`,
        backdropFilter: onDark ? "blur(6px)" : undefined,
      }}
    >
      <div className="flex-1">
        <ThemedDateRange
          from={from}
          to={to}
          onChange={(f, t) => {
            setFrom(f);
            setTo(t);
          }}
          accent="var(--site-accent)"
          ink="var(--site-ink)"
          mute="var(--site-mute)"
          line="var(--site-line)"
          surface="var(--site-surface)"
          radius="12px"
        />
      </div>
      <label className="w-full text-left sm:w-24">
        <span
          className="mb-1 block text-[11px] font-semibold"
          style={{
            color: onDark ? "rgba(255,255,255,0.9)" : "var(--site-mute)",
          }}
        >
          Guests
        </span>
        <input
          type="number"
          min={1}
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          className="w-full px-3 py-2.5 text-sm outline-none"
          style={fieldStyle}
        />
      </label>
      <button
        type="button"
        onClick={go}
        style={{
          background: "var(--site-btn-primary-bg)",
          color: "var(--site-btn-primary-color)",
          border: "var(--site-btn-primary-border)",
          borderRadius: "var(--site-btn-primary-radius)",
        }}
        className="px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        Search
      </button>
    </div>
  );
}
