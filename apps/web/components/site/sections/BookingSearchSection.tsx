"use client";

import { useState, type FormEvent } from "react";

import type { BookingFunnelData } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, Muted } from "./_shared";
import { ThemedDateRange } from "../ThemedDateRange";

type Props = Extract<WebsiteSection, { type: "booking_search" }>["props"];

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

  function onSubmit(e?: FormEvent) {
    e?.preventDefault();
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

  // A sleek horizontal availability bar (dates · guests · search) — a floating
  // card, not a form dropped in a section. Self-styled from `--site-*` tokens so
  // it's on-theme everywhere; the Oceans View skin lifts it over the hero.
  const guestMax = 12;
  return (
    <div className="siteab-wrap">
      <style>{`
        .siteab-wrap{max-width:1060px;margin:0 auto;padding:0 20px;}
        .siteab-in{background:var(--site-surface,#fff);border:1px solid var(--site-line,#e9e1d1);border-radius:var(--site-radius-lg,20px);box-shadow:0 30px 70px -30px rgba(10,34,48,.34);display:grid;grid-template-columns:1.6fr 1fr auto;align-items:stretch;overflow:hidden;}
        .siteab-field{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:16px 22px;border-right:1px solid var(--site-line,#e9e1d1);min-width:0;}
        .siteab-field > .siteab-lbl{font-family:var(--site-font-body,inherit);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--site-mute,#5e7884);}
        .siteab-field select{-webkit-appearance:none;appearance:none;border:none;background:none;font-family:var(--site-font-heading,inherit);font-weight:700;font-size:1.02rem;color:var(--site-ink,#0e2c3a);padding:0;outline:none;cursor:pointer;width:100%;}
        .siteab-go{display:flex;align-items:center;padding:12px;}
        .siteab-btn{height:100%;min-height:54px;display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:0 28px;border:none;border-radius:calc(var(--site-radius-lg,20px) - 9px);background:var(--site-btn-primary-bg,var(--site-secondary,var(--site-accent,#12a5b5)));color:var(--site-btn-primary-color,#fff);font-family:var(--site-font-body,inherit);font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap;transition:filter .2s;}
        .siteab-btn:hover{filter:brightness(1.06);}
        .siteab-btn:disabled{opacity:.6;cursor:default;}
        @media(max-width:760px){
          .siteab-in{grid-template-columns:1fr 1fr;}
          .siteab-field:nth-child(2){border-right:none;}
          .siteab-go{grid-column:1 / -1;padding:0 12px 14px;}
          .siteab-btn{width:100%;}
        }
        /* Narrow phones — stack to a single column so the date-range field gets
           full width instead of being squeezed into a half column. */
        @media(max-width:520px){
          .siteab-in{grid-template-columns:1fr;}
          .siteab-field{border-right:none;border-bottom:1px solid var(--site-line,#e9e1d1);padding:14px 18px;}
          .siteab-go{padding:12px 18px 16px;}
        }
      `}</style>
      <div className="siteab-in">
        <div className="siteab-field">
          <span className="siteab-lbl">When</span>
          <ThemedDateRange
            bare
            from={checkIn}
            to={checkOut}
            onChange={(f, t) => {
              setCheckIn(f);
              setCheckOut(t);
            }}
            accent="var(--site-accent, #12a5b5)"
            ink="var(--site-ink, #0e2c3a)"
            mute="var(--site-mute, #5e7884)"
            line="var(--site-line, #e9e1d1)"
            surface="var(--site-surface, #ffffff)"
            radius="var(--site-radius-sm, 12px)"
          />
        </div>
        <div className="siteab-field">
          <span className="siteab-lbl">Guests</span>
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            aria-label="Guests"
          >
            {Array.from({ length: guestMax }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </div>
        <div className="siteab-go">
          <button
            type="button"
            className="siteab-btn"
            onClick={() => onSubmit()}
            disabled={!live || !checkIn || !checkOut}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
