"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { BookableProperty, BookingFunnelData } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "search_results" }>["props"];

const fieldStyle: CSSProperties = {
  background: "var(--site-bg)",
  borderColor: "var(--site-line)",
  color: "var(--site-ink)",
  borderRadius: "var(--site-radius)",
};
const inputCls = "w-full border px-3 py-2.5 text-sm outline-none";

type Match = {
  property: BookableProperty;
  available: boolean;
  nights: number;
  total: number | null;
  currency: string;
  bookHref: string;
};

function money(total: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(total);
  } catch {
    return `${currency} ${total}`;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Search-results template (system page `search_results`). A self-contained search
 * form (dates + guests, pre-filled from the URL query) that quotes EVERY bookable
 * property on the site in parallel via /api/website-quote (server-recalculated
 * price + live availability — never trusted client-side) and lists the available
 * matches with a deep-link into the on-site checkout. Theme-scoped via --site-*.
 * In the builder preview (`interactive=false`) the form renders but never calls
 * the endpoint.
 */
export function SearchResultsSection({
  props,
  data,
  interactive = false,
}: {
  props: Props;
  data?: BookingFunnelData;
  interactive?: boolean;
}) {
  const properties = useMemo(() => data?.properties ?? [], [data]);
  const websiteId = data?.websiteId;

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState("");

  const live = interactive && Boolean(websiteId) && properties.length > 0;

  async function runSearch(ci = checkIn, co = checkOut, g = guests) {
    if (!live || !ci || !co || co <= ci) return;
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all(
        properties.map(async (p) => {
          try {
            const res = await fetch("/api/website-quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                website_id: websiteId,
                property_id: p.id,
                check_in: ci,
                check_out: co,
                guests: g,
              }),
            });
            const json = (await res.json()) as
              | {
                  ok: true;
                  available: boolean;
                  nights: number;
                  total: number | null;
                  currency: string;
                }
              | { ok: false };
            if (!json.ok) return null;
            return {
              property: p,
              available: json.available,
              nights: json.nights,
              total: json.total,
              currency: json.currency,
              bookHref: `${p.bookBase}&from=${ci}&to=${co}&guests=${g}`,
            } satisfies Match;
          } catch {
            return null;
          }
        }),
      );
      setMatches(results.filter((m): m is Match => m !== null));
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  // On mount, hydrate from the URL query (?from=&to=&guests=) — e.g. a hero
  // search box deep-linking here — then auto-run the search. Reading
  // window.location avoids the useSearchParams() Suspense/CSR-bailout at build.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const ci = q.get("from") ?? "";
    const co = q.get("to") ?? "";
    const g = Number(q.get("guests"));
    if (ci) setCheckIn(ci);
    if (co) setCheckOut(co);
    if (Number.isFinite(g) && g > 0) setGuests(g);
    if (live && ci && co && co > ci) {
      void runSearch(ci, co, Number.isFinite(g) && g > 0 ? g : guests);
    }
    // Run once on mount for the URL-provided dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const available = matches.filter((m) => m.available);

  return (
    <SectionShell surface>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {props.body ? (
        <Muted className="mb-6 text-center text-base">{props.body}</Muted>
      ) : null}

      {/* search form */}
      <Card className="mx-auto mb-8 max-w-3xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
          className="grid gap-4 p-5 sm:grid-cols-4"
        >
          <Labelled label="Check-in">
            <input
              type="date"
              value={checkIn}
              min={todayIso()}
              onChange={(e) => setCheckIn(e.target.value)}
              style={fieldStyle}
              className={inputCls}
            />
          </Labelled>
          <Labelled label="Check-out">
            <input
              type="date"
              value={checkOut}
              min={checkIn || todayIso()}
              onChange={(e) => setCheckOut(e.target.value)}
              style={fieldStyle}
              className={inputCls}
            />
          </Labelled>
          <Labelled label="Guests">
            <input
              type="number"
              value={guests}
              min={1}
              max={40}
              onChange={(e) =>
                setGuests(Math.max(1, Number(e.target.value) || 1))
              }
              style={fieldStyle}
              className={inputCls}
            />
          </Labelled>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!live || !checkIn || !checkOut || loading}
              style={{
                background: "var(--site-btn-primary-bg)",
                color: "var(--site-btn-primary-color)",
                border: "var(--site-btn-primary-border)",
                borderRadius: "var(--site-btn-primary-radius)",
              }}
              className="inline-flex w-full items-center justify-center px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
      </Card>

      {/* results */}
      {error ? (
        <p className="text-center text-sm font-medium text-red-600">{error}</p>
      ) : !searched ? (
        <Muted className="text-center text-sm">
          {live
            ? "Enter your dates to see what’s available."
            : "Live availability appears here on your published site."}
        </Muted>
      ) : available.length === 0 ? (
        <Muted className="text-center text-sm">
          No availability for those dates — try different dates.
        </Muted>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((m) => (
            <Card key={m.property.id} className="flex flex-col p-5">
              <h3
                style={{
                  fontFamily: "var(--site-font-heading)",
                  color: "var(--site-ink)",
                }}
                className="text-lg font-semibold"
              >
                {m.property.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  style={{ color: "var(--site-ink)" }}
                  className="text-base font-semibold"
                >
                  {m.total != null ? money(m.total, m.currency) : "Available"}
                </span>
                <span style={{ color: "var(--site-mute)" }} className="text-xs">
                  {m.total != null
                    ? `· ${m.nights} ${m.nights === 1 ? "night" : "nights"}`
                    : `· ${m.nights} ${m.nights === 1 ? "night" : "nights"}`}
                </span>
              </div>
              <p style={{ color: "var(--site-mute)" }} className="mt-1 text-xs">
                Final price confirmed at checkout.
              </p>
              <div className="mt-4 flex flex-1 items-end">
                <a
                  href={m.bookHref}
                  data-wielo-book
                  style={{
                    background: "var(--site-btn-primary-bg)",
                    color: "var(--site-btn-primary-color)",
                    border: "var(--site-btn-primary-border)",
                    borderRadius: "var(--site-btn-primary-radius)",
                  }}
                  className="inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  Book this stay
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
