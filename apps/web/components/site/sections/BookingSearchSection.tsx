"use client";

import {
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

import type { BookingFunnelData } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";
import { ThemedDateRange } from "../ThemedDateRange";

type Props = Extract<WebsiteSection, { type: "booking_search" }>["props"];

const fieldStyle: CSSProperties = {
  background: "var(--site-bg)",
  borderColor: "var(--site-line)",
  color: "var(--site-ink)",
  borderRadius: "var(--site-radius)",
};
const inputCls = "w-full border px-3 py-2.5 text-sm outline-none";

/**
 * Booking search widget. Date range + guests → the site's designed, room-based
 * search-results page (`/search-results?from=&to=&guests=`), which lists every
 * room with live availability + a server-recalculated total and a Book-now
 * deep-link. In the builder preview (`interactive=false`) the form renders but
 * never navigates.
 */
export function BookingSearchSection({
  props,
  data,
  interactive = false,
}: {
  props: Props;
  data?: BookingFunnelData;
  interactive?: boolean;
}) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  const searchHref = data?.searchHref;
  const hasProperties = (data?.properties?.length ?? 0) > 0;
  const live = interactive && Boolean(searchHref) && hasProperties;
  const cta = props.ctaLabel ?? "Check availability";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!live || !searchHref || !checkIn || !checkOut) return;
    // Go to the designed results page; it reads ?from/to/guests and auto-runs.
    const sep = searchHref.includes("?") ? "&" : "?";
    window.location.href = `${searchHref}${sep}from=${checkIn}&to=${checkOut}&guests=${guests}`;
  }

  // Nothing configured yet — hint in the builder, render nothing publicly.
  if (!hasProperties) {
    if (!interactive) return null;
    return (
      <SectionShell surface width="narrow">
        <div
          style={{
            borderColor: "var(--site-line)",
            borderRadius: "var(--site-radius)",
          }}
          className="border border-dashed p-8 text-center"
        >
          <Muted>Add a property to your website to take bookings here.</Muted>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell surface width="narrow">
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {props.body ? (
        <Muted className="mb-6 text-center text-base">{props.body}</Muted>
      ) : null}

      <Card className="mx-auto max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Labelled label="Dates">
              <ThemedDateRange
                from={checkIn}
                to={checkOut}
                onChange={(f, t) => {
                  setCheckIn(f);
                  setCheckOut(t);
                }}
                accent="var(--site-accent, var(--accent, #0a7d4b))"
                ink="var(--site-ink, var(--ink, #16241d))"
                mute="var(--site-mute, var(--ink-soft, #6b7a72))"
                line="var(--site-line, var(--line, #e3e8e5))"
                surface="var(--site-surface, var(--bg-2, #fff))"
                radius="var(--site-radius, 10px)"
              />
            </Labelled>
            <Labelled label="Guests">
              <input
                type="number"
                value={guests}
                min={1}
                max={40}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setGuests(Math.max(1, n));
                }}
                style={fieldStyle}
                className={inputCls}
              />
            </Labelled>
          </div>

          <button
            type="submit"
            disabled={!live || !checkIn || !checkOut}
            style={{
              background: "var(--site-btn-primary-bg)",
              color: "var(--site-btn-primary-color)",
              border: "var(--site-btn-primary-border)",
              borderRadius: "var(--site-btn-primary-radius)",
            }}
            className="inline-flex w-full items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {cta}
          </button>

          {!interactive ? (
            <p style={{ color: "var(--site-mute)" }} className="text-xs">
              This search is live on your published site — it opens your rooms
              results page.
            </p>
          ) : null}
        </form>
      </Card>
    </SectionShell>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span
        style={{ color: "var(--site-ink)" }}
        className="text-sm font-medium"
      >
        {label}
      </span>
      {children}
    </label>
  );
}
