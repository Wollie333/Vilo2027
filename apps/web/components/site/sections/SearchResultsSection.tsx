"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type {
  BookableProperty,
  BookingFunnelData,
  RoomCard,
} from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";
import { ThemedDateRange } from "../ThemedDateRange";

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

// Per-room availability + priced total, keyed by room id, from /api/website-search.
type RoomQuote = {
  available: boolean;
  total: number | null;
  currency: string;
  nights: number;
};

/** Append the searched dates/guests to a room's base checkout link. */
function withStay(href: string, from: string, to: string, guests: number) {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${from}&to=${to}&guests=${guests}`;
}

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

// A single result card (room or property). Available → image + price + a Book-now
// deep-link; unavailable → dimmed with a clear "not available" badge + disabled
// button (so ALL rooms show, available first). Styling via --site-*/--el-* so it's
// theme-scoped + builder-editable. Shared by the live results AND the builder demo.
export type ResultCardData = {
  id: string;
  name: string;
  imageUrl?: string | null;
  facts?: string[];
  priceLabel?: string | null;
  subLabel?: string | null;
  available: boolean;
  bookHref?: string;
};

function ResultCard({ r }: { r: ResultCardData }) {
  const on = r.available;
  return (
    <Card
      className="flex flex-col overflow-hidden"
      style={{
        opacity: on ? 1 : 0.72,
        background: "var(--el-card-bg, var(--site-surface))",
        borderRadius: "var(--el-card-radius, var(--site-card-radius))",
      }}
    >
      <div
        className="relative aspect-[4/3] w-full bg-cover bg-center"
        style={{
          backgroundImage: r.imageUrl ? `url("${r.imageUrl}")` : undefined,
          background: r.imageUrl ? undefined : "var(--site-bg)",
          filter: on ? undefined : "grayscale(1)",
        }}
      >
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{
            background: on
              ? "var(--el-badge-bg, var(--site-accent))"
              : "rgba(17,24,39,0.72)",
            color: on
              ? "var(--el-badge-fg, var(--site-accent-ink,#fff))"
              : "#fff",
          }}
        >
          {on ? "Available" : "Not available"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3
          style={{
            fontFamily: "var(--site-font-heading)",
            color: "var(--el-title-fg, var(--site-ink))",
          }}
          className="text-lg font-semibold"
        >
          {r.name}
        </h3>
        {r.facts?.length ? (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {r.facts.map((f) => (
              <span
                key={f}
                style={{ color: "var(--site-mute)" }}
                className="text-xs"
              >
                {f}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex items-baseline gap-2">
          <span
            style={{ color: "var(--el-price-fg, var(--site-ink))" }}
            className="text-base font-semibold"
          >
            {r.priceLabel ?? (on ? "Available" : "—")}
          </span>
          {r.subLabel ? (
            <span style={{ color: "var(--site-mute)" }} className="text-xs">
              · {r.subLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-1 items-end">
          {on && r.bookHref ? (
            <a
              href={r.bookHref}
              data-wielo-book
              style={{
                background: "var(--el-button-bg, var(--site-btn-primary-bg))",
                color: "var(--el-button-fg, var(--site-btn-primary-color))",
                border: "var(--el-button-bd, var(--site-btn-primary-border))",
                borderRadius:
                  "var(--el-button-radius, var(--site-btn-primary-radius))",
              }}
              className="inline-flex w-full items-center justify-center px-4 py-2.5 text-center text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Book now
            </a>
          ) : (
            <span
              style={{
                background: "var(--site-line)",
                color: "var(--site-mute)",
                borderRadius: "var(--site-btn-primary-radius)",
              }}
              className="inline-flex w-full cursor-not-allowed items-center justify-center px-4 py-2.5 text-center text-sm font-semibold"
            >
              Not available for these dates
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

// Designed DEMO results for the builder preview (no network). Two available rooms
// then one unavailable, so BOTH card states are visible + style-editable.
const DEMO_RESULTS: ResultCardData[] = [
  {
    id: "d1",
    name: "Garden Suite",
    imageUrl: "https://picsum.photos/seed/wielo-sr1/640/480",
    facts: ["Sleeps 2", "Private stoep", "Fireplace"],
    priceLabel: "R 1 850",
    subLabel: "3 nights",
    available: true,
    bookHref: "#",
  },
  {
    id: "d2",
    name: "Family Cottage",
    imageUrl: "https://picsum.photos/seed/wielo-sr2/640/480",
    facts: ["Sleeps 4", "Full kitchen", "Garden views"],
    priceLabel: "R 2 200",
    subLabel: "3 nights",
    available: true,
    bookHref: "#",
  },
  {
    id: "d3",
    name: "The Loft",
    imageUrl: "https://picsum.photos/seed/wielo-sr3/640/480",
    facts: ["Sleeps 2", "Cosy", "Pet friendly"],
    priceLabel: null,
    available: false,
  },
];

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
  const rooms = useMemo<RoomCard[]>(() => data?.rooms ?? [], [data]);
  const websiteId = data?.websiteId;
  // Room-based results when the site has visible rooms; otherwise fall back to the
  // legacy property-based path (multi-property sites with no per-room channel set).
  const roomMode = rooms.length > 0;

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [roomQuotes, setRoomQuotes] = useState<Record<string, RoomQuote>>({});
  const [error, setError] = useState("");

  const live =
    interactive &&
    Boolean(websiteId) &&
    (properties.length > 0 || rooms.length > 0);

  // Room search — one request quotes every visible room server-side (availability
  // + a re-priced total per room). The client never computes price.
  async function runRoomSearch(ci = checkIn, co = checkOut, g = guests) {
    if (!live || !ci || !co || co <= ci) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/website-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          room_ids: rooms.map((r) => r.id),
          check_in: ci,
          check_out: co,
          guests: g,
        }),
      });
      const json = (await res.json()) as
        | {
            ok: true;
            results: {
              room_id: string;
              available: boolean;
              total: number | null;
              currency: string;
              nights: number;
            }[];
          }
        | { ok: false; error: string };
      if (json.ok) {
        const map: Record<string, RoomQuote> = {};
        for (const r of json.results) {
          map[r.room_id] = {
            available: r.available,
            total: r.total,
            currency: r.currency,
            nights: r.nights,
          };
        }
        setRoomQuotes(map);
      } else {
        setError(json.error);
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  async function runSearch(ci = checkIn, co = checkOut, g = guests) {
    if (roomMode) return runRoomSearch(ci, co, g);
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

  // Room cards merged with their live quote (available + priced), available first.
  const roomResults: ResultCardData[] = useMemo(() => {
    const cards = rooms.map((r): ResultCardData => {
      const q = roomQuotes[r.id];
      const available = q ? q.available : true;
      return {
        id: r.id,
        name: r.name,
        imageUrl: r.imageUrl,
        facts: r.facts,
        priceLabel:
          q && q.total != null
            ? money(q.total, q.currency)
            : r.price != null
              ? `${money(r.price, r.currency ?? "ZAR")} / night`
              : null,
        subLabel:
          q && q.total != null
            ? `${q.nights} ${q.nights === 1 ? "night" : "nights"}`
            : null,
        available,
        bookHref:
          checkIn && checkOut
            ? withStay(r.bookHref, checkIn, checkOut, guests)
            : r.bookHref,
      };
    });
    return cards.sort((a, b) => Number(b.available) - Number(a.available));
  }, [rooms, roomQuotes, checkIn, checkOut, guests]);

  return (
    <SectionShell tightTop>
      {props.heading ? (
        <SectionHeading className="mb-3">{props.heading}</SectionHeading>
      ) : null}
      {props.body ? (
        <Muted className="mb-6 text-center text-base">{props.body}</Muted>
      ) : null}

      {/* search form — wrapped so the bottom gap is real: the Card sets an inline
          margin-bottom (--el-card-mb) that would override a mb-* class on itself,
          so the gap that keeps result cards off the search box lives on this div. */}
      <div className="mx-auto mb-12 max-w-3xl md:mb-16">
        <Card className="max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch();
            }}
            className="grid gap-4 p-5 sm:grid-cols-[2fr_1fr_1fr]"
          >
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
      </div>

      {/* results */}
      {!interactive ? (
        // Builder preview: designed demo cards (available first + one unavailable)
        // so the host can preview + style the results without a live search.
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_RESULTS.map((r) => (
            <ResultCard key={r.id} r={r} />
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-sm font-medium text-red-600">{error}</p>
      ) : roomMode ? (
        // ROOM-based: show ALL visible rooms (available first). Before a search
        // they list their nightly-from price; after one, each carries the priced
        // total + availability for the chosen dates (unavailable dimmed + badged).
        <>
          {!searched ? (
            <Muted className="mb-6 text-center text-sm">
              Enter your dates to see live prices &amp; availability.
            </Muted>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roomResults.map((r) => (
              <ResultCard key={r.id} r={r} />
            ))}
          </div>
        </>
      ) : !searched ? (
        <Muted className="text-center text-sm">
          Enter your dates to see what’s available.
        </Muted>
      ) : matches.length === 0 ? (
        <Muted className="text-center text-sm">
          No rooms match those dates — try different dates.
        </Muted>
      ) : (
        // ALL results, available first; unavailable shown dimmed with a badge.
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...matches]
            .sort((a, b) => Number(b.available) - Number(a.available))
            .map((m) => (
              <ResultCard
                key={m.property.id}
                r={{
                  id: m.property.id,
                  name: m.property.name,
                  priceLabel:
                    m.total != null ? money(m.total, m.currency) : null,
                  subLabel: `${m.nights} ${m.nights === 1 ? "night" : "nights"}`,
                  available: m.available,
                  bookHref: m.bookHref,
                }}
              />
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
