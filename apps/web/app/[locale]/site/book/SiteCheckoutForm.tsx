"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  PRICING_LABEL,
  type PricingModel,
} from "@/app/[locale]/dashboard/addons/schemas";
import {
  SectionShell,
  SectionHeading,
  Muted,
  Card,
} from "@/components/site/sections/_shared";
import {
  TurnstileWidget,
  turnstileEnabled,
} from "@/components/site/TurnstileWidget";

export type CheckoutRoom = {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  maxGuests: number;
  minGuests: number;
  minNights: number;
};

export type CheckoutAddon = {
  id: string;
  name: string;
  pricingModel: PricingModel;
  unitPrice: number;
  currency: string;
  minQuantity: number;
  maxQuantity: number | null;
  allowCustom: boolean;
  stock: number | null;
  isRequired: boolean;
  /** null = property-wide; otherwise shown only when one of these rooms is picked. */
  roomIds: string[] | null;
};

type Scope = "whole_listing" | "rooms";

const isPerNight = (m: PricingModel) =>
  m === "per_night" || m === "per_guest_per_night";

const fieldStyle: CSSProperties = {
  background: "var(--site-bg)",
  borderColor: "var(--site-line)",
  color: "var(--site-ink)",
  borderRadius: "var(--site-radius)",
};
const inputCls = "w-full border px-3 py-2.5 text-sm outline-none";

function money(total: number | null, currency: string) {
  if (total == null) return null;
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
 * On-site checkout form (Phase 6B/c) — themed with --site-* so it lives on the
 * host's own domain. Collects the stay, party and contact details, shows a
 * SERVER-RECALCULATED running total (POST /api/site-booking-quote) and, on
 * submit, creates the booking + starts payment (POST /api/site-booking) before
 * redirecting to the host's Paystack page (card) or the on-site thank-you (EFT).
 * Nothing about money is computed or trusted client-side.
 */
export function SiteCheckoutForm({
  websiteId,
  propertyId,
  propertyName,
  currency,
  maxGuests,
  basePrice,
  bookingMode,
  rooms,
  addons,
  cardAvailable,
  eftAvailable,
  cancellation,
  initial,
}: {
  websiteId: string;
  propertyId: string;
  propertyName: string;
  currency: string;
  maxGuests: number;
  basePrice: number | null;
  bookingMode: string;
  rooms: CheckoutRoom[];
  addons: CheckoutAddon[];
  cardAvailable: boolean;
  eftAvailable: boolean;
  cancellation: { title: string; note: string } | null;
  initial: {
    from: string;
    to: string;
    guests: number;
    roomId: string | null;
    scope: Scope | null;
  };
}) {
  const canWhole = bookingMode !== "rooms_only" && basePrice != null;
  const canRooms = rooms.length > 0;

  const [scope, setScope] = useState<Scope>(
    initial.scope ?? (canRooms ? "rooms" : "whole_listing"),
  );

  // Per-room selected guest counts (rooms scope).
  const [roomGuests, setRoomGuests] = useState<Record<string, number>>(() => {
    if (initial.roomId) {
      const r = rooms.find((x) => x.id === initial.roomId);
      if (r) return { [r.id]: Math.max(1, r.minGuests) };
    }
    return {};
  });

  const [checkIn, setCheckIn] = useState(initial.from);
  const [checkOut, setCheckOut] = useState(initial.to);
  const [wholeGuests, setWholeGuests] = useState(initial.guests);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");

  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [coupon, setCoupon] = useState("");

  const [method, setMethod] = useState<"paystack" | "eft">(
    cardAvailable ? "paystack" : "eft",
  );
  const [ack, setAck] = useState(false);
  const [tsToken, setTsToken] = useState<string | null>(null);
  const [tsNonce, setTsNonce] = useState(0);

  const [quote, setQuote] = useState<{
    available: boolean;
    total: number | null;
    nights: number;
    couponApplied: boolean;
  } | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedRoomIds = useMemo(
    () => Object.keys(roomGuests).filter((id) => roomGuests[id] > 0),
    [roomGuests],
  );

  const guests =
    scope === "rooms"
      ? selectedRoomIds.reduce((sum, id) => sum + (roomGuests[id] || 0), 0)
      : wholeGuests;

  const datesValid = Boolean(checkIn && checkOut && checkOut > checkIn);
  const nights = useMemo(() => {
    if (!datesValid) return 0;
    return Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
    );
  }, [checkIn, checkOut, datesValid]);

  // Add-ons available for the current selection (property-wide, or scoped to a
  // selected room). Required ones are always shown as "included".
  const visibleAddons = useMemo(
    () =>
      addons.filter(
        (a) =>
          a.roomIds == null ||
          (scope === "rooms" &&
            a.roomIds.some((rid) => selectedRoomIds.includes(rid))),
      ),
    [addons, scope, selectedRoomIds],
  );

  // Optional add-ons the guest picked (required ones are added server-side).
  const selectedAddons = useMemo(
    () =>
      visibleAddons
        .filter((a) => !a.isRequired && (addonQty[a.id] ?? 0) > 0)
        .map((a) => ({ addon_id: a.id, quantity: addonQty[a.id] })),
    [visibleAddons, addonQty],
  );

  // Stable dep keys so the quote effect re-runs on selection changes.
  const roomGuestsKey = JSON.stringify(roomGuests);
  const selectedAddonsKey = JSON.stringify(selectedAddons);

  const selectionValid =
    scope === "rooms" ? selectedRoomIds.length > 0 : canWhole;
  const canQuote = datesValid && selectionValid && guests > 0;

  // Live, server-recalculated quote (debounced).
  useEffect(() => {
    if (!canQuote) {
      setQuote(null);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      setQuoting(true);
      fetch("/api/site-booking-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          property_id: propertyId,
          scope,
          room_ids: scope === "rooms" ? selectedRoomIds : undefined,
          room_guests:
            scope === "rooms"
              ? selectedRoomIds.map((id) => ({
                  room_id: id,
                  guests: roomGuests[id],
                }))
              : [],
          check_in: checkIn,
          check_out: checkOut,
          guests,
          children,
          infants,
          pets,
          selected_addons: selectedAddons,
          coupon_code: coupon.trim() || undefined,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!active) return;
          if (j.ok)
            setQuote({
              available: j.available,
              total: j.total,
              nights: j.nights,
              couponApplied: j.couponApplied,
            });
          else setQuote(null);
        })
        .catch(() => active && setQuote(null))
        .finally(() => active && setQuoting(false));
    }, 500);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canQuote,
    scope,
    checkIn,
    checkOut,
    guests,
    children,
    infants,
    pets,
    roomGuestsKey,
    selectedAddonsKey,
    coupon,
  ]);

  function toggleRoom(r: CheckoutRoom) {
    setRoomGuests((prev) => {
      const next = { ...prev };
      if (next[r.id] > 0) delete next[r.id];
      else next[r.id] = Math.max(1, r.minGuests);
      return next;
    });
  }

  function toggleAddon(a: CheckoutAddon) {
    setAddonQty((prev) => {
      const next = { ...prev };
      if ((next[a.id] ?? 0) > 0) {
        delete next[a.id];
      } else {
        next[a.id] = isPerNight(a.pricingModel)
          ? Math.max(a.minQuantity, nights || 1)
          : Math.max(a.minQuantity, 1);
      }
      return next;
    });
  }

  const formInvalid =
    !canQuote ||
    !name.trim() ||
    !email.trim() ||
    !ack ||
    (!cardAvailable && !eftAvailable) ||
    (turnstileEnabled() && !tsToken);

  async function onSubmit() {
    if (formInvalid || submitting) return;
    setSubmitting(true);
    setError("");

    const u = new URL(window.location.href);
    const siteParam = u.searchParams.get("site");
    let returnPath = u.pathname.replace(/\/$/, "") + "/thank-you";
    if (siteParam) returnPath += `?site=${encodeURIComponent(siteParam)}`;

    try {
      const res = await fetch("/api/site-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          property_id: propertyId,
          scope,
          room_ids: scope === "rooms" ? selectedRoomIds : undefined,
          room_guests:
            scope === "rooms"
              ? selectedRoomIds.map((id) => ({
                  room_id: id,
                  guests: roomGuests[id],
                }))
              : undefined,
          check_in: checkIn,
          check_out: checkOut,
          guests,
          children,
          infants,
          pets,
          selected_addons: selectedAddons,
          coupon_code: coupon.trim() || undefined,
          payment_method: method,
          guest_name: name.trim(),
          guest_email: email.trim(),
          guest_phone: phone.trim() || undefined,
          special_requests: requests.trim() || undefined,
          policy_acknowledged: true,
          return_path: returnPath,
          ts: tsToken,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; redirectTo: string }
        | { ok: false; error: string };
      if (json.ok) {
        window.location.href = json.redirectTo;
      } else {
        setError(json.error);
        setSubmitting(false);
        setTsNonce((n) => n + 1); // refresh the single-use token for a retry
      }
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setSubmitting(false);
      setTsNonce((n) => n + 1);
    }
  }

  if (!canWhole && !canRooms) {
    return (
      <SectionShell width="narrow">
        <Card className="p-8 text-center">
          <Muted>This property isn’t accepting online bookings yet.</Muted>
        </Card>
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      <SectionHeading className="mb-2">Book {propertyName}</SectionHeading>
      <Muted className="mb-8 text-center text-base">
        Reserve your stay directly — no booking fees.
      </Muted>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── Form ── */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* Dates */}
            <Group title="Your dates">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            </Group>

            {/* What to book */}
            {canWhole && canRooms ? (
              <div className="flex gap-2">
                <ScopeTab
                  active={scope === "rooms"}
                  onClick={() => setScope("rooms")}
                >
                  Choose rooms
                </ScopeTab>
                <ScopeTab
                  active={scope === "whole_listing"}
                  onClick={() => setScope("whole_listing")}
                >
                  Whole place
                </ScopeTab>
              </div>
            ) : null}

            {scope === "rooms" ? (
              <Group title="Rooms">
                <div className="space-y-2">
                  {rooms.map((r) => {
                    const sel = roomGuests[r.id] > 0;
                    return (
                      <div
                        key={r.id}
                        style={{
                          borderColor: "var(--site-line)",
                          borderRadius: "var(--site-radius)",
                        }}
                        className="flex items-center justify-between gap-3 border p-3"
                      >
                        <label className="flex flex-1 items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => toggleRoom(r)}
                            className="h-4 w-4"
                          />
                          <span>
                            <span
                              style={{ color: "var(--site-ink)" }}
                              className="text-sm font-medium"
                            >
                              {r.name}
                            </span>
                            {r.price != null ? (
                              <span
                                style={{ color: "var(--site-mute)" }}
                                className="ml-2 text-xs"
                              >
                                from {money(r.price, r.currency)} / night
                              </span>
                            ) : null}
                          </span>
                        </label>
                        {sel ? (
                          <select
                            value={roomGuests[r.id]}
                            onChange={(e) =>
                              setRoomGuests((p) => ({
                                ...p,
                                [r.id]: Number(e.target.value),
                              }))
                            }
                            style={fieldStyle}
                            className="border px-2 py-1.5 text-sm outline-none"
                            aria-label={`Guests in ${r.name}`}
                          >
                            {Array.from(
                              { length: r.maxGuests },
                              (_, i) => i + 1,
                            ).map((n) => (
                              <option key={n} value={n}>
                                {n} {n === 1 ? "guest" : "guests"}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Group>
            ) : (
              <Group title="Guests">
                <Labelled label="Guests">
                  <select
                    value={wholeGuests}
                    onChange={(e) => setWholeGuests(Number(e.target.value))}
                    style={fieldStyle}
                    className={inputCls}
                  >
                    {Array.from({ length: maxGuests }, (_, i) => i + 1).map(
                      (n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "guest" : "guests"}
                        </option>
                      ),
                    )}
                  </select>
                </Labelled>
              </Group>
            )}

            {/* Party extras */}
            <Group title="Anyone else?">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stepper
                  label="Children"
                  value={children}
                  onChange={setChildren}
                />
                <Stepper
                  label="Infants"
                  value={infants}
                  onChange={setInfants}
                />
                <Stepper label="Pets" value={pets} onChange={setPets} />
              </div>
            </Group>

            {/* Add-ons */}
            {visibleAddons.length > 0 ? (
              <Group title="Add extras">
                <div className="space-y-2">
                  {visibleAddons.map((a) => {
                    const on = a.isRequired || (addonQty[a.id] ?? 0) > 0;
                    return (
                      <div
                        key={a.id}
                        style={{
                          borderColor: "var(--site-line)",
                          borderRadius: "var(--site-radius)",
                        }}
                        className="flex items-center justify-between gap-3 border p-3"
                      >
                        <label className="flex flex-1 items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={a.isRequired}
                            onChange={() => toggleAddon(a)}
                            className="h-4 w-4"
                          />
                          <span>
                            <span
                              style={{ color: "var(--site-ink)" }}
                              className="text-sm font-medium"
                            >
                              {a.name}
                              {a.isRequired ? (
                                <span
                                  style={{ color: "var(--site-mute)" }}
                                  className="ml-1.5 text-xs font-normal"
                                >
                                  (included)
                                </span>
                              ) : null}
                            </span>
                            <span
                              style={{ color: "var(--site-mute)" }}
                              className="ml-2 text-xs"
                            >
                              {money(a.unitPrice, a.currency)}{" "}
                              {PRICING_LABEL[a.pricingModel]}
                            </span>
                          </span>
                        </label>
                        {on && !a.isRequired && a.allowCustom ? (
                          <input
                            type="number"
                            min={Math.max(1, a.minQuantity)}
                            max={a.maxQuantity ?? undefined}
                            value={addonQty[a.id] ?? a.minQuantity}
                            onChange={(e) =>
                              setAddonQty((p) => ({
                                ...p,
                                [a.id]: Math.max(
                                  1,
                                  Number(e.target.value) || 1,
                                ),
                              }))
                            }
                            style={fieldStyle}
                            className="w-16 border px-2 py-1.5 text-sm outline-none"
                            aria-label={`Quantity for ${a.name}`}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Group>
            ) : null}

            {/* Contact */}
            <Group title="Your details">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Labelled label="Full name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={fieldStyle}
                      className={inputCls}
                    />
                  </Labelled>
                  <Labelled label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={fieldStyle}
                      className={inputCls}
                    />
                  </Labelled>
                </div>
                <Labelled label="Phone (optional)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={fieldStyle}
                    className={inputCls}
                  />
                </Labelled>
                <Labelled label="Special requests (optional)">
                  <textarea
                    value={requests}
                    onChange={(e) => setRequests(e.target.value)}
                    rows={3}
                    style={fieldStyle}
                    className={`${inputCls} resize-y`}
                  />
                </Labelled>
              </div>
            </Group>
          </div>
        </Card>

        {/* ── Summary / payment ── */}
        <div>
          <Card className="p-6">
            <h3
              style={{ color: "var(--site-ink)" }}
              className="text-base font-semibold"
            >
              Summary
            </h3>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Stay">
                {quote
                  ? `${quote.nights} ${quote.nights === 1 ? "night" : "nights"}`
                  : "—"}
              </Row>
              <Row label="Guests">{guests || "—"}</Row>
              {quote && !quote.available ? (
                <p className="text-sm font-medium text-red-600">
                  Those dates aren’t available — please try different dates.
                </p>
              ) : null}

              {/* Coupon */}
              <div className="pt-1">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Coupon code (optional)"
                  maxLength={40}
                  style={fieldStyle}
                  className={inputCls}
                  aria-label="Coupon code"
                />
                {coupon.trim() && quote ? (
                  <p
                    className={`mt-1 text-xs font-medium ${quote.couponApplied ? "text-green-600" : "text-red-600"}`}
                  >
                    {quote.couponApplied
                      ? "Coupon applied ✓"
                      : "That code doesn’t apply to your order."}
                  </p>
                ) : null}
              </div>

              <div
                style={{ borderColor: "var(--site-line)" }}
                className="mt-3 flex items-center justify-between border-t pt-3"
              >
                <span
                  style={{ color: "var(--site-ink)" }}
                  className="font-semibold"
                >
                  Total
                </span>
                <span
                  style={{ color: "var(--site-ink)" }}
                  className="text-lg font-bold"
                >
                  {quoting
                    ? "…"
                    : (money(quote?.total ?? null, currency) ?? "—")}
                </span>
              </div>
              <Muted className="text-xs">
                Final price is confirmed on the next step.
              </Muted>
            </div>

            {/* Payment method */}
            {cardAvailable || eftAvailable ? (
              <div className="mt-5 space-y-2">
                {cardAvailable ? (
                  <PayChoice
                    active={method === "paystack"}
                    onClick={() => setMethod("paystack")}
                    title="Pay by card"
                    sub="Secure card payment"
                  />
                ) : null}
                {eftAvailable ? (
                  <PayChoice
                    active={method === "eft"}
                    onClick={() => setMethod("eft")}
                    title="Bank transfer (EFT)"
                    sub="Pay by manual EFT"
                  />
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-sm text-red-600">
                Online payment isn’t set up yet — please contact the host.
              </p>
            )}

            {/* Policy */}
            <label className="mt-5 flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span style={{ color: "var(--site-mute)" }}>
                {cancellation ? (
                  <>
                    <strong style={{ color: "var(--site-ink)" }}>
                      {cancellation.title}.
                    </strong>{" "}
                    {cancellation.note} I accept the booking policies.
                  </>
                ) : (
                  "I accept the booking and cancellation policies."
                )}
              </span>
            </label>

            <div className="mt-4">
              <TurnstileWidget onVerify={setTsToken} resetSignal={tsNonce} />
            </div>

            {error ? (
              <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
            ) : null}

            <button
              type="button"
              onClick={onSubmit}
              disabled={formInvalid || submitting}
              style={{
                background: "var(--site-btn-primary-bg)",
                color: "var(--site-btn-primary-color)",
                border: "var(--site-btn-primary-border)",
                borderRadius: "var(--site-btn-primary-radius)",
              }}
              className="mt-5 inline-flex w-full items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting
                ? "Processing…"
                : method === "eft"
                  ? "Reserve & get EFT details"
                  : "Continue to payment"}
            </button>
          </Card>
        </div>
      </div>
    </SectionShell>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3
        style={{ color: "var(--site-ink)" }}
        className="mb-3 text-sm font-semibold"
      >
        {title}
      </h3>
      {children}
    </div>
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

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Labelled label={label}>
      <input
        type="number"
        min={0}
        max={20}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={fieldStyle}
        className={inputCls}
      />
    </Labelled>
  );
}

function ScopeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderColor: active ? "var(--site-accent)" : "var(--site-line)",
        color: active ? "var(--site-accent)" : "var(--site-mute)",
        borderRadius: "var(--site-radius)",
      }}
      className="flex-1 border px-3 py-2 text-sm font-semibold transition"
    >
      {children}
    </button>
  );
}

function PayChoice({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderColor: active ? "var(--site-accent)" : "var(--site-line)",
        borderRadius: "var(--site-radius)",
      }}
      className="flex w-full items-center justify-between border px-4 py-3 text-left transition"
    >
      <span>
        <span
          style={{ color: "var(--site-ink)" }}
          className="block text-sm font-semibold"
        >
          {title}
        </span>
        <span style={{ color: "var(--site-mute)" }} className="block text-xs">
          {sub}
        </span>
      </span>
      <span
        style={{
          borderColor: active ? "var(--site-accent)" : "var(--site-line)",
          background: active ? "var(--site-accent)" : "transparent",
        }}
        className="h-4 w-4 rounded-full border"
      />
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--site-mute)" }}>{label}</span>
      <span style={{ color: "var(--site-ink)" }} className="font-medium">
        {children}
      </span>
    </div>
  );
}
