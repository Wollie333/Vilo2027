"use client";

import { useEffect, useMemo, useState } from "react";

import { ThemedDateRange } from "@/components/site/ThemedDateRange";

function money(total: number | null | undefined, currency?: string | null) {
  if (total == null) return null;
  const ccy = currency ?? "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(total);
  } catch {
    return `${ccy} ${total}`;
  }
}

/**
 * Room-detail booking form: pick dates → a live, server-recalculated availability
 * check (POST /api/site-booking-quote) → the CTA turns "Reserve · <total>" when
 * available (deep-links into the checkout with THIS room + the chosen dates
 * pre-filled) or a disabled "Unavailable" when not. Every surface reads a
 * `--el-*` var (host-editable via the room_rate element controls) falling back to
 * the theme token, so it themes by default AND styles per element.
 */
export function RoomBookingForm({
  websiteId,
  propertyId,
  roomId,
  roomName,
  price,
  currency,
  bookHref,
  maxGuests,
  cta = "Reserve now",
  heading,
  note,
  interactive = true,
}: {
  websiteId?: string;
  propertyId: string;
  roomId: string;
  roomName: string;
  price?: number | null;
  currency?: string | null;
  bookHref: string;
  maxGuests?: number | null;
  cta?: string;
  heading?: string | null;
  note?: string | null;
  interactive?: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [guests, setGuests] = useState(1);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<{
    available: boolean;
    total: number | null;
    nights: number;
  } | null>(null);

  const hasDates = !!from && !!to && from < to;

  // Live availability + price for the chosen dates (debounced). Only in the live
  // site — the builder preview passes interactive=false so it stays static.
  useEffect(() => {
    if (!interactive || !hasDates) {
      setQuote(null);
      return;
    }
    let active = true;
    setQuoting(true);
    const t = setTimeout(() => {
      fetch("/api/site-booking-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          property_id: propertyId,
          scope: "rooms",
          room_ids: [roomId],
          room_guests: [{ room_id: roomId, guests }],
          check_in: from,
          check_out: to,
          guests,
          children: 0,
          infants: 0,
          pets: 0,
          selected_addons: [],
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!active) return;
          setQuote(
            j.ok
              ? { available: !!j.available, total: j.total, nights: j.nights }
              : { available: false, total: null, nights: 0 },
          );
        })
        .catch(
          () =>
            active && setQuote({ available: false, total: null, nights: 0 }),
        )
        .finally(() => active && setQuoting(false));
    }, 450);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [interactive, hasDates, websiteId, propertyId, roomId, from, to, guests]);

  const checkoutHref = useMemo(() => {
    const sep = bookHref.includes("?") ? "&" : "?";
    return `${bookHref}${sep}from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&guests=${guests}`;
  }, [bookHref, from, to, guests]);

  // Button state: pick-dates → checking → available (link) / unavailable (disabled).
  const unavailable = hasDates && !quoting && quote != null && !quote.available;
  const canBook = hasDates && !quoting && !!quote?.available;
  const label = !hasDates
    ? "Select your dates"
    : quoting
      ? "Checking…"
      : unavailable
        ? "Unavailable"
        : quote?.total != null
          ? `${cta} · ${money(quote.total, currency)}`
          : cta;

  const perNight = money(price, currency);
  const maxG = Math.max(1, maxGuests ?? 1);

  const fieldStyle = {
    background: "var(--el-field-bg, var(--site-bg))",
    borderColor: "var(--el-field-bd, var(--site-line))",
    color: "var(--el-field-fg, var(--site-ink))",
    borderRadius: "var(--el-field-radius, var(--site-radius))",
  } as const;

  const btnStyle = {
    background: canBook
      ? "var(--el-button-bg, var(--site-btn-primary-bg))"
      : "var(--site-line)",
    color: canBook
      ? "var(--el-button-fg, var(--site-btn-primary-color))"
      : "var(--site-mute)",
    border: canBook
      ? "var(--el-button-bd, var(--site-btn-primary-border))"
      : "none",
    borderRadius: "var(--el-button-radius, var(--site-btn-primary-radius))",
  } as const;

  const btnCls =
    "site-rbf-btn mt-4 block w-full px-5 py-3.5 text-center text-sm font-semibold transition-opacity";

  return (
    // Shared sticky-card rule (same as the checkout Summary) so the room-detail
    // booking card follows the scroll + clears the header. No `self-start` — inside
    // a flex-column booking rail the card must keep its full width.
    <div
      className="site-rbf wielo-book-card-sticky"
      style={{
        background: "var(--el-card-bg, var(--site-surface))",
        border: "var(--el-card-bd, var(--site-card-border))",
        borderRadius: "var(--el-card-radius, var(--site-card-radius))",
        boxShadow: "var(--el-card-shadow, var(--site-card-shadow))",
      }}
    >
      <div className="p-5">
        {heading ? (
          <h3
            style={{
              fontFamily: "var(--site-font-heading)",
              color: "var(--el-title-fg, var(--site-ink))",
              fontSize: "var(--el-title-size, 1.125rem)",
            }}
            className="mb-3 font-semibold"
          >
            {heading}
          </h3>
        ) : null}

        {perNight ? (
          <div className="mb-3 flex items-baseline gap-1.5">
            <span
              style={{
                color: "var(--el-price-fg, var(--site-ink))",
                fontSize: "var(--el-price-size, 1.5rem)",
              }}
              className="font-bold"
            >
              {perNight}
            </span>
            <span style={{ color: "var(--site-mute)" }} className="text-sm">
              / night
            </span>
          </div>
        ) : null}

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
          line="var(--el-field-bd, var(--site-line))"
          surface="var(--el-field-bg, var(--site-surface))"
          radius="var(--el-field-radius, var(--site-radius))"
        />

        {maxG > 1 ? (
          <label
            className="mt-3 flex items-center justify-between gap-3 border px-3 py-2.5 text-sm"
            style={fieldStyle}
          >
            <span style={{ color: "var(--site-mute)" }}>Guests</span>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              style={{
                background: "transparent",
                color: "var(--el-field-fg, var(--site-ink))",
              }}
              className="font-medium outline-none"
            >
              {Array.from({ length: maxG }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "guest" : "guests"}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Availability / total feedback */}
        {hasDates && !quoting && quote ? (
          quote.available ? (
            <p
              style={{ color: "var(--site-accent)" }}
              className="mt-3 text-xs font-medium"
            >
              Available for your dates · {quote.nights}{" "}
              {quote.nights === 1 ? "night" : "nights"}
            </p>
          ) : (
            <p className="mt-3 text-xs font-medium text-red-600">
              Not available for those dates — try different dates.
            </p>
          )
        ) : null}

        {canBook ? (
          <a
            href={checkoutHref}
            data-wielo-book
            aria-label={`Reserve ${roomName}`}
            style={btnStyle}
            className={`${btnCls} hover:opacity-90`}
          >
            {label}
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-label={roomName}
            style={btnStyle}
            className={`${btnCls} cursor-not-allowed`}
          >
            {label}
          </button>
        )}

        {note ? (
          <p
            style={{ color: "var(--site-mute)" }}
            className="mt-2 text-center text-xs"
          >
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
