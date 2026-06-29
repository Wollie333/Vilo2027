"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import type { BookingFunnelData, BookableProperty } from "@/lib/site/types";
import type { WebsiteSection } from "@/lib/website/sections.schema";

import { SectionShell, SectionHeading, Muted, Card } from "./_shared";

type Props = Extract<WebsiteSection, { type: "booking_search" }>["props"];

const fieldStyle: CSSProperties = {
  background: "var(--site-bg)",
  borderColor: "var(--site-line)",
  color: "var(--site-ink)",
  borderRadius: "var(--site-radius)",
};
const inputCls = "w-full border px-3 py-2.5 text-sm outline-none";

type QuoteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "result";
      available: boolean;
      nights: number;
      total: number | null;
      currency: string;
      bookHref: string;
    }
  | { kind: "error"; message: string };

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
 * Booking search widget (Phase 6B). Date range + guests → POST /api/website-quote
 * for LIVE availability + a SERVER-RECALCULATED price, then a deep-link into the
 * real checkout. The price is never computed client-side. In the builder preview
 * (`interactive=false`) the widget renders but does not call the endpoint.
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
  const properties = useMemo(() => data?.properties ?? [], [data]);
  const fixed = props.property_id
    ? properties.find((p) => p.id === props.property_id)
    : undefined;
  const choices = fixed ? [fixed] : properties;

  const [propertyId, setPropertyId] = useState<string>(
    fixed?.id ?? properties[0]?.id ?? "",
  );
  const selected: BookableProperty | undefined = useMemo(
    () => properties.find((p) => p.id === propertyId),
    [properties, propertyId],
  );

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [state, setState] = useState<QuoteState>({ kind: "idle" });

  const websiteId = data?.websiteId;
  const live = interactive && Boolean(websiteId) && properties.length > 0;
  const cta = props.ctaLabel ?? "Check availability";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!live || !selected || !checkIn || !checkOut) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/website-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          property_id: selected.id,
          check_in: checkIn,
          check_out: checkOut,
          guests,
        }),
      });
      const json = (await res.json()) as
        | {
            ok: true;
            available: boolean;
            nights: number;
            total: number | null;
            currency: string;
            bookHref: string;
          }
        | { ok: false; error: string };
      if (json.ok) {
        // Continue ON-SITE: build the checkout link from the property's on-site
        // base (server bookHref points at the app domain; we keep the guest on
        // the host's own domain). bookBase always carries `?property=…`.
        const onsiteHref = `${selected.bookBase}&from=${checkIn}&to=${checkOut}&guests=${guests}`;
        setState({
          kind: "result",
          available: json.available,
          nights: json.nights,
          total: json.total,
          currency: json.currency,
          bookHref: onsiteHref,
        });
      } else {
        setState({ kind: "error", message: json.error });
      }
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server." });
    }
  }

  // Nothing configured yet — hint in the builder, render nothing publicly.
  if (properties.length === 0) {
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
          {choices.length > 1 ? (
            <Labelled label="Property">
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setState({ kind: "idle" });
                }}
                style={fieldStyle}
                className={inputCls}
              >
                {choices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Labelled>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Labelled label="Check-in">
              <input
                type="date"
                value={checkIn}
                min={todayIso()}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  setState({ kind: "idle" });
                }}
                style={fieldStyle}
                className={inputCls}
              />
            </Labelled>
            <Labelled label="Check-out">
              <input
                type="date"
                value={checkOut}
                min={checkIn || todayIso()}
                onChange={(e) => {
                  setCheckOut(e.target.value);
                  setState({ kind: "idle" });
                }}
                style={fieldStyle}
                className={inputCls}
              />
            </Labelled>
            <Labelled label="Guests">
              <input
                type="number"
                value={guests}
                min={1}
                max={selected?.maxGuests ?? 20}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setGuests(Math.max(1, n));
                  setState({ kind: "idle" });
                }}
                style={fieldStyle}
                className={inputCls}
              />
            </Labelled>
          </div>

          <button
            type="submit"
            disabled={
              !live || !checkIn || !checkOut || state.kind === "loading"
            }
            style={{
              background: "var(--site-btn-primary-bg)",
              color: "var(--site-btn-primary-color)",
              border: "var(--site-btn-primary-border)",
              borderRadius: "var(--site-btn-primary-radius)",
            }}
            className="inline-flex w-full items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state.kind === "loading" ? "Checking…" : cta}
          </button>

          <QuoteResult state={state} />

          {!interactive ? (
            <p style={{ color: "var(--site-mute)" }} className="text-xs">
              This search is live on your published site.
            </p>
          ) : null}
        </form>
      </Card>
    </SectionShell>
  );
}

function QuoteResult({ state }: { state: QuoteState }) {
  if (state.kind === "error") {
    return <p className="text-sm font-medium text-red-600">{state.message}</p>;
  }
  if (state.kind !== "result") return null;

  if (!state.available) {
    return (
      <div
        style={{ borderColor: "var(--site-line)" }}
        className="rounded-[var(--site-radius)] border border-dashed p-4 text-center"
      >
        <Muted className="text-sm">
          Not available for those dates — try different dates.
        </Muted>
      </div>
    );
  }

  return (
    <div
      style={{ borderColor: "var(--site-line)" }}
      className="flex flex-col items-center gap-3 rounded-[var(--site-radius)] border p-4 text-center"
    >
      <div>
        <p
          style={{ color: "var(--site-ink)" }}
          className="text-lg font-semibold"
        >
          {state.total != null
            ? money(state.total, state.currency)
            : "Available"}
        </p>
        <p style={{ color: "var(--site-mute)" }} className="text-xs">
          {state.total != null
            ? `for ${state.nights} ${state.nights === 1 ? "night" : "nights"} · final price confirmed at checkout`
            : `for ${state.nights} ${state.nights === 1 ? "night" : "nights"} · choose your room at checkout`}
        </p>
      </div>
      <a
        href={state.bookHref}
        data-wielo-book
        style={{
          background: "var(--site-btn-primary-bg)",
          color: "var(--site-btn-primary-color)",
          border: "var(--site-btn-primary-border)",
          borderRadius: "var(--site-btn-primary-radius)",
        }}
        className="inline-flex px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        Continue to book
      </a>
    </div>
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
